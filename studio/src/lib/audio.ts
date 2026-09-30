import type {
  Audition,
  SoundHit,
  SoundLayer,
  SoundOption,
} from "@shared/contracts";

let context: AudioContext | undefined;
const buffers = new Map<string, Promise<AudioBuffer>>();
const peaks = new WeakMap<AudioBuffer, Float32Array>();
const levels = new WeakMap<AudioBuffer, { peak: number; loudness: number }>();
// Um elemento de mídia aceita um único MediaElementAudioSourceNode na vida toda.
const elementSources = new WeakMap<
  HTMLMediaElement,
  MediaElementAudioSourceNode
>();
const targets = new WeakMap<AudioParam, number>();

export function audioContext() {
  context ??= new AudioContext({ latencyHint: "interactive" });
  return context;
}

async function fetchAudio(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`O áudio respondeu ${response.status}.`);
  }
  return await audioContext().decodeAudioData(await response.arrayBuffer());
}

// Decodifica uma vez e guarda: faixas e sons tocados em sincronia com o vídeo.
export function loadAudio(url: string) {
  let pending = buffers.get(url);
  if (!pending) {
    pending = fetchAudio(url);
    pending.catch(() => buffers.delete(url));
    buffers.set(url, pending);
  }
  return pending;
}

// Só a forma de onda e a duração, sem guardar o áudio decodificado. Uma
// decodificação por vez, para uma lista longa não ocupar memória de uma vez.
let summaries = Promise.resolve();
export function summarizeAudio(url: string) {
  const job = summaries.then(async () => {
    const buffer = await fetchAudio(url);
    return { duration: buffer.duration, peaks: audioPeaks(buffer) };
  });
  summaries = job.then(
    () => {},
    () => {},
  );
  return job;
}

export const peaksPerSecond = 100;

// Pico absoluto a cada centésimo de segundo, para desenhar a forma de onda.
export function audioPeaks(buffer: AudioBuffer) {
  const cached = peaks.get(buffer);
  if (cached) {
    return cached;
  }
  const buckets = Math.max(64, Math.ceil(buffer.duration * peaksPerSecond));
  const result = new Float32Array(buckets);
  const size = buffer.length / buckets;
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel);
    for (let bucket = 0; bucket < buckets; bucket++) {
      let peak = 0;
      const end = Math.min(data.length, Math.floor((bucket + 1) * size));
      for (let index = Math.floor(bucket * size); index < end; index += 2) {
        peak = Math.max(peak, Math.abs(data[index]));
      }
      result[bucket] = Math.max(result[bucket], peak);
    }
  }
  peaks.set(buffer, result);
  return result;
}

// Referências da mixagem do agent (skill motion-studio-sound-effects): música
// em -18,3 LUFS e efeitos com pico de RMS em 30 ms de -24 dBFS, antes do
// volume de cada um. A soma sobe 13 dB, perto do master em -14 LUFS.
const musicReference = -18.3;
const decibels = (value: number) => 10 ** (value / 20);
const effectReference = 10 ** (-24 / 20);
const makeup = 10 ** (13 / 20);

// ponytail: loudness como no BS.1770 (blocos de 400 ms, gates de -70 e -10),
// sem a ponderação K; fica a 1 ou 2 dB do LUFS. Aplicar os filtros se o
// equilíbrio divergir do render.
function levelsOf(buffer: AudioBuffer) {
  const cached = levels.get(buffer);
  if (cached) {
    return cached;
  }
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, index) =>
    buffer.getChannelData(index),
  );
  const mono = (index: number) => {
    let sum = 0;
    for (const data of channels) {
      sum += data[index];
    }
    return (sum / channels.length) ** 2;
  };
  const window = Math.min(buffer.length, Math.round(buffer.sampleRate * 0.03));
  const block = Math.round(buffer.sampleRate * 0.4);
  const blocks: number[] = [];
  let running = 0;
  let peak = 0;
  let blockSum = 0;
  for (let index = 0; index < buffer.length; index++) {
    running += mono(index);
    if (index >= window) {
      running -= mono(index - window);
    }
    if (index >= window - 1) {
      peak = Math.max(peak, running / window);
    }
    for (const data of channels) {
      blockSum += data[index] ** 2;
    }
    if ((index + 1) % block === 0) {
      blocks.push((blockSum / block) * 10 ** -0.0691);
      blockSum = 0;
    }
  }
  const mean = (values: number[]) =>
    values.reduce((sum, value) => sum + value, 0) / (values.length || 1);
  const audible = blocks.filter((value) => value > 1e-7);
  const gate = mean(audible) * 0.1;
  const result = {
    peak: Math.sqrt(peak),
    loudness:
      10 * Math.log10(mean(audible.filter((value) => value > gate)) || 1e-10),
  };
  levels.set(buffer, result);
  return result;
}

const musicLevel = (buffer: AudioBuffer) =>
  decibels(musicReference - levelsOf(buffer).loudness);
const effectLevel = (buffer: AudioBuffer) =>
  effectReference / Math.max(levelsOf(buffer).peak, 1e-5);

export function selectedOption(layer: SoundLayer) {
  return layer.options.find((option) => option.file === layer.selected);
}

const smoothing = 0.015;
const openFilter = 20000;
const driftLimit = 0.045;
const lookahead = 0.25;

// Faixa longa (música ou stem) presa ao tempo do vídeo: recomeça no ponto
// certo quando se afasta dele (seek, loop, troca de velocidade).
class FollowingSource {
  private node?: AudioBufferSourceNode;
  private started = { at: 0, offset: 0, rate: 1 };
  private buffer?: AudioBuffer;
  private readonly level: GainNode;

  constructor(
    private readonly ctx: AudioContext,
    output: AudioNode,
  ) {
    this.level = ctx.createGain();
    this.level.connect(output);
  }

  setBuffer(buffer: AudioBuffer | undefined, level: number) {
    if (buffer !== this.buffer) {
      this.stop();
      this.buffer = buffer;
    }
    this.level.gain.value = level;
  }

  follow(position: number, rate: number) {
    const { buffer } = this;
    if (!buffer || position < 0 || position >= buffer.duration) {
      this.stop();
      return;
    }
    const heard = this.node
      ? this.started.offset +
        (this.ctx.currentTime - this.started.at) * this.started.rate
      : Number.NaN;
    if (
      this.node &&
      this.started.rate === rate &&
      Math.abs(heard - position) < driftLimit
    ) {
      return;
    }
    this.stop();
    const node = this.ctx.createBufferSource();
    node.buffer = buffer;
    node.playbackRate.value = rate;
    node.connect(this.level);
    node.onended = () => {
      if (this.node === node) {
        this.node = undefined;
      }
    };
    node.start(0, position);
    this.node = node;
    this.started = { at: this.ctx.currentTime, offset: position, rate };
  }

  stop() {
    if (this.node) {
      this.node.onended = null;
      this.node.stop();
      this.node.disconnect();
      this.node = undefined;
    }
  }

  dispose() {
    this.stop();
    this.level.disconnect();
  }
}

interface LayerNodes {
  volume: GainNode;
  stem: FollowingSource;
  shots: Map<number, AudioBufferSourceNode>;
  signature: string;
}

// O vídeo manda no tempo. Música e stems acompanham o vídeo; efeitos pontuais
// são agendados um pouco antes de cada momento. O áudio original do render
// passa pelo mesmo grafo, para os volumes somarem num limitador.
export class AuditionMixer {
  private readonly ctx = audioContext();
  private readonly output = this.ctx.createGain();
  private readonly original = this.ctx.createGain();
  private readonly audition = this.ctx.createGain();
  private readonly music = this.ctx.createGain();
  private readonly envelope = this.ctx.createGain();
  private readonly filter = this.ctx.createBiquadFilter();
  private readonly limiter = this.ctx.createDynamicsCompressor();
  private readonly track = new FollowingSource(this.ctx, this.music);
  private readonly layers = new Map<string, LayerNodes>();
  private effectBuffers = new Map<string, AudioBuffer>();
  private settings?: Audition;
  private last?: { time: number; at: number; rate: number };
  private preview?: AudioBufferSourceNode;
  private element?: HTMLMediaElement;
  private elementSource?: MediaElementAudioSourceNode;

  constructor() {
    const { limiter, filter } = this;
    limiter.threshold.value = -2;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.12;
    filter.type = "lowpass";
    filter.frequency.value = openFilter;
    filter.Q.value = 0.5;
    this.audition.gain.value = makeup;
    this.music.connect(filter).connect(this.envelope).connect(this.audition);
    this.audition.connect(this.output);
    this.original.connect(this.output);
    this.output.connect(limiter).connect(this.ctx.destination);
  }

  attach(element: HTMLMediaElement) {
    if (this.element === element) {
      return;
    }
    this.elementSource?.disconnect();
    let source = elementSources.get(element);
    if (!source) {
      source = this.ctx.createMediaElementSource(element);
      elementSources.set(element, source);
    }
    source.disconnect();
    source.connect(this.original);
    this.element = element;
    this.elementSource = source;
  }

  async resume() {
    if (this.ctx.state !== "running") {
      await this.ctx.resume();
    }
  }

  setOutput(volume: number, muted: boolean) {
    this.ramp(this.output.gain, muted ? 0 : volume);
  }

  setBuffers(
    music: AudioBuffer | undefined,
    effects: Map<string, AudioBuffer>,
  ) {
    this.track.setBuffer(music, music ? musicLevel(music) : 1);
    this.effectBuffers = effects;
  }

  configure(settings: Audition) {
    this.settings = settings;
    this.ramp(this.music.gain, settings.volume);
    const active =
      !!settings.track || settings.effects.some((layer) => !!layer.selected);
    this.ramp(this.original.gain, active ? settings.originalVolume : 1);
    for (const layer of settings.effects) {
      const nodes = this.layerNodes(layer.id);
      this.ramp(nodes.volume.gain, layer.volume);
      const signature = JSON.stringify([selectedOption(layer), layer.hits]);
      if (signature !== nodes.signature) {
        nodes.signature = signature;
        nodes.stem.stop();
        this.cancel(nodes);
      }
    }
  }

  // Chamado a cada quadro durante a reprodução e em cada seek.
  sync(time: number, duration: number, playing: boolean, rate: number) {
    const { settings } = this;
    if (!settings || !playing) {
      this.stop();
      return;
    }
    const now = this.ctx.currentTime;
    const expected = this.last
      ? this.last.time + (now - this.last.at) * this.last.rate
      : Number.NaN;
    if (this.last?.rate !== rate || !(Math.abs(expected - time) < 0.1)) {
      this.layers.forEach((nodes) => this.cancel(nodes));
    }
    this.last = { time, at: now, rate };
    // O som sai com a latência da saída; adianta o áudio para chegar junto do quadro.
    const heard =
      time + (this.ctx.outputLatency || this.ctx.baseLatency || 0) * rate;

    if (settings.track) {
      this.track.follow(settings.offset + heard, rate);
    } else {
      this.track.stop();
    }
    const fadeIn = settings.fadeIn ? Math.min(1, time / settings.fadeIn) : 1;
    const fadeOut = settings.fadeOut
      ? Math.min(1, Math.max(0, duration - time) / settings.fadeOut)
      : 1;
    this.ramp(this.envelope.gain, fadeIn * fadeOut);
    const muffled = settings.muffle.enabled && time < settings.muffle.until;
    this.ramp(
      this.filter.frequency,
      muffled ? settings.muffle.cutoff : openFilter,
    );

    for (const layer of settings.effects) {
      const nodes = this.layerNodes(layer.id);
      const option = selectedOption(layer);
      const buffer = option && this.effectBuffers.get(option.file);
      if (!option || !buffer || !option.stem) {
        nodes.stem.stop();
      }
      if (!option || !buffer) {
        continue;
      }
      if (option.stem) {
        nodes.stem.setBuffer(
          buffer,
          effectLevel(buffer) * decibels(option.gain),
        );
        nodes.stem.follow(option.start + heard, rate);
        continue;
      }
      layer.hits.forEach((hit, index) => {
        const lead = (hit.time - heard) / rate;
        if (lead > -0.05 && lead < lookahead && !nodes.shots.has(index)) {
          nodes.shots.set(
            index,
            this.shoot(nodes.volume, option, buffer, hit, lead, rate),
          );
        }
      });
    }
  }

  // Toca um som isolado agora, para ouvir a opção com o vídeo parado.
  play(option: SoundOption, buffer: AudioBuffer, volume: number) {
    this.preview?.stop();
    const level = this.ctx.createGain();
    level.gain.value = volume;
    level.connect(this.audition);
    const hit = { time: 0, gain: 0, pan: 0 };
    this.preview = this.shoot(level, option, buffer, hit, option.attack, 1);
    this.preview.addEventListener("ended", () => level.disconnect());
  }

  stop() {
    this.last = undefined;
    this.track.stop();
    this.layers.forEach((nodes) => {
      nodes.stem.stop();
      this.cancel(nodes);
    });
  }

  dispose() {
    this.stop();
    this.preview?.stop();
    this.track.dispose();
    this.layers.forEach((nodes) => nodes.stem.dispose());
    this.elementSource?.disconnect();
    this.output.disconnect();
  }

  private layerNodes(id: string) {
    let nodes = this.layers.get(id);
    if (!nodes) {
      const volume = this.ctx.createGain();
      volume.connect(this.audition);
      nodes = {
        volume,
        stem: new FollowingSource(this.ctx, volume),
        shots: new Map(),
        signature: "",
      };
      this.layers.set(id, nodes);
    }
    return nodes;
  }

  private cancel(nodes: LayerNodes) {
    nodes.shots.forEach((node) => node.stop());
    nodes.shots.clear();
  }

  // O ataque do som cai quando faltarem `lead` segundos; se já passou, o som
  // começa do ponto em que estaria.
  private shoot(
    destination: AudioNode,
    option: SoundOption,
    buffer: AudioBuffer,
    hit: SoundHit,
    lead: number,
    rate: number,
  ) {
    const now = this.ctx.currentTime;
    const skipped = Math.max(0, option.attack / rate - lead) * rate;
    const when = now + Math.max(0, lead - option.attack / rate);
    const offset = Math.min(buffer.duration, option.start + skipped);
    const length = Math.max(
      0.001,
      Math.min(
        buffer.duration - offset,
        (option.duration ?? Number.POSITIVE_INFINITY) - skipped,
      ),
    );
    const end = when + length / rate;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    const gain = this.ctx.createGain();
    const level = effectLevel(buffer) * decibels(option.gain + hit.gain);
    gain.gain.setValueAtTime(level, when);
    gain.gain.setValueAtTime(level, Math.max(when, end - 0.01));
    gain.gain.linearRampToValueAtTime(0, end);
    const pan = this.ctx.createStereoPanner();
    pan.pan.value = hit.pan;
    source.connect(gain).connect(pan).connect(destination);
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      pan.disconnect();
    };
    source.start(when, offset, length);
    return source;
  }

  private ramp(param: AudioParam, value: number) {
    if (targets.get(param) !== value) {
      targets.set(param, value);
      param.setTargetAtTime(value, this.ctx.currentTime, smoothing);
    }
  }
}
