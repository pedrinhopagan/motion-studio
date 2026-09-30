import { useSyncExternalStore } from "react";

// Tempo de reprodução fora do estado do React: só os componentes que leem o
// tempo renderizam a cada quadro, e cada um só quando o valor escolhido muda.
export function createClock() {
  let time = 0;
  const listeners = new Set<() => void>();
  return {
    get: () => time,
    set(next: number) {
      if (next !== time) {
        time = next;
        listeners.forEach((listener) => listener());
      }
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}
export type Clock = ReturnType<typeof createClock>;

export function useClock<T>(clock: Clock, select: (time: number) => T): T {
  return useSyncExternalStore(clock.subscribe, () => select(clock.get()));
}
