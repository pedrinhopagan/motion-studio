import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Play, Pause, Info } from "lucide-react";
import type { Project } from "@shared/contracts";
import { Modal } from "@/components/Modal";
import { mediaUrl } from "@/lib/api";
import { shortTime } from "@/lib/format";
import { useToast } from "@/components/ui/Toast";
import { Select } from "@/components/ui/Select";

export function CompareVersions({
  project,
  origin,
  onClose,
}: {
  project: Project;
  origin: string;
  onClose: () => void;
}) {
  const videos = project.versions
    .flatMap((version) => version.videos)
    .reverse();
  const [left, setLeft] = useState(
    project.latestVideo ?? videos[0]?.path ?? "",
  );
  const [right, setRight] = useState(
    videos.find(
      (file) =>
        file.version !== videos.find((entry) => entry.path === left)?.version,
    )?.path ??
      videos.find((file) => file.path !== left)?.path ??
      "",
  );
  const videoOptions = videos.map((file) => ({
    value: file.path,
    label: `${file.version} · ${file.name}`,
  }));
  const [sync, setSync] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const a = useRef<HTMLVideoElement>(null);
  const b = useRef<HTMLVideoElement>(null);
  const toast = useToast();
  const maxDuration = Math.max(
    project.media[left]?.duration ?? 0,
    project.media[right]?.duration ?? 0,
  );

  useEffect(() => {
    a.current?.pause();
    b.current?.pause();
    setPlaying(false);
    setTime(0);
  }, [left, right]);

  async function handlePlay() {
    if (playing) {
      a.current?.pause();
      b.current?.pause();
      setPlaying(false);
      return;
    }
    try {
      if (sync && a.current && b.current) {
        b.current.currentTime = Math.min(
          a.current.currentTime,
          b.current.duration || 0,
        );
      }
      await Promise.all([a.current?.play(), b.current?.play()]);
      setPlaying(true);
    } catch {
      a.current?.pause();
      b.current?.pause();
      setPlaying(false);
      toast("Não foi possível reproduzir um dos renders.", "error");
    }
  }

  function handleSeek(value: number) {
    setTime(value);
    if (a.current && Number.isFinite(a.current.duration)) {
      a.current.currentTime = Math.min(value, a.current.duration);
    }
    if (b.current && Number.isFinite(b.current.duration)) {
      b.current.currentTime = Math.min(value, b.current.duration);
    }
  }

  return (
    <Modal title="Comparar renders" onClose={onClose} wide>
      <div className="modal-body comparison-body">
        <div className="comparison-grid">
          {[
            { label: "Render A", value: left, change: setLeft, ref: a },
            { label: "Render B", value: right, change: setRight, ref: b },
          ].map((side, index) => (
            <div className="compare-side" key={side.label}>
              <div className="field">
                <span>{side.label}</span>
                <Select
                  label={side.label}
                  value={side.value}
                  options={videoOptions}
                  onChange={side.change}
                />
              </div>
              <div className="compare-stage">
                <video
                  key={side.value}
                  ref={side.ref}
                  src={mediaUrl(origin, side.value)}
                  playsInline
                  muted={index === 1}
                  preload="metadata"
                  onTimeUpdate={
                    index === 0
                      ? () => {
                          if (a.current) {
                            setTime(a.current.currentTime);
                            if (
                              sync &&
                              b.current &&
                              Number.isFinite(b.current.duration) &&
                              Math.abs(
                                b.current.currentTime - a.current.currentTime,
                              ) > 0.2
                            ) {
                              b.current.currentTime = Math.min(
                                a.current.currentTime,
                                b.current.duration,
                              );
                            }
                          }
                        }
                      : undefined
                  }
                  onEnded={() => {
                    a.current?.pause();
                    b.current?.pause();
                    setPlaying(false);
                  }}
                  onError={() =>
                    toast(
                      `Não foi possível abrir o ${side.label.toLowerCase()}.`,
                      "error",
                    )
                  }
                />
              </div>
              <div className="compare-specs">
                <span>
                  {project.media[side.value]?.width} ×{" "}
                  {project.media[side.value]?.height}
                </span>
                <span>
                  {shortTime(project.media[side.value]?.duration ?? 0)}
                </span>
              </div>
            </div>
          ))}
        </div>
        <div className="compare-controls">
          <button className="button primary" onClick={() => void handlePlay()}>
            {playing ? <Pause size={16} /> : <Play size={16} />}
            {playing ? "Pausar ambos" : "Reproduzir ambos"}
          </button>
          <input
            type="range"
            className="range"
            style={
              {
                "--fill": `${(time / (maxDuration || project.manifest.duration)) * 100}%`,
              } as CSSProperties
            }
            min="0"
            max={maxDuration || project.manifest.duration}
            step="0.01"
            value={time}
            aria-label="Tempo da comparação"
            onChange={(event) => handleSeek(Number(event.target.value))}
          />
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={sync}
              onChange={(event) => setSync(event.target.checked)}
            />
            Sincronizar tempo
          </label>
        </div>
        <p className="helper">
          <Info size={14} />O áudio vem do render A. Renders com durações
          diferentes preservam seu tempo original.
        </p>
      </div>
    </Modal>
  );
}
