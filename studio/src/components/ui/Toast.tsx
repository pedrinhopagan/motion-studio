import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { CircleCheck, CircleAlert, Info, X } from "lucide-react";

type ToastKind = "success" | "error" | "info";
type ToastItem = { id: number; text: string; kind: ToastKind };
type ShowToast = (text: string, kind?: ToastKind) => void;

const durations: Record<ToastKind, number> = {
  success: 4000,
  info: 5000,
  error: 9000,
};
const icons = { success: CircleCheck, error: CircleAlert, info: Info };
const ToastContext = createContext<ShowToast>(() => {});
let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const region = useRef<HTMLDivElement>(null);
  const show = useCallback<ShowToast>((text, kind = "success") => {
    setToasts((current) =>
      [
        ...current.filter((toast) => toast.text !== text),
        { id: ++nextId, text, kind },
      ].slice(-3),
    );
  }, []);
  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  // A região fica na camada superior e volta ao topo a cada aviso, para não
  // sumir atrás de um <dialog> aberto depois dela.
  useLayoutEffect(() => {
    const element = region.current;
    if (!element?.showPopover) {
      return;
    }
    if (element.matches(":popover-open")) {
      element.hidePopover();
    }
    if (toasts.length) {
      element.showPopover();
    }
  }, [toasts]);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toast-region" ref={region} popover="manual">
        <ol aria-label="Avisos">
          {toasts.map((toast) => (
            <Toast
              key={toast.id}
              toast={toast}
              onDismiss={() => dismiss(toast.id)}
            />
          ))}
        </ol>
      </div>
    </ToastContext.Provider>
  );
}

function Toast({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: () => void;
}) {
  const [paused, setPaused] = useState(false);
  const remaining = useRef(durations[toast.kind]);
  useEffect(() => {
    if (paused) {
      return;
    }
    const started = performance.now();
    const timer = setTimeout(onDismiss, remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current -= performance.now() - started;
    };
  }, [paused, onDismiss]);
  const Icon = icons[toast.kind];

  return (
    <li
      className={`toast ${toast.kind}`}
      role={toast.kind === "error" ? "alert" : "status"}
      data-paused={paused || undefined}
      style={
        { "--toast-duration": `${durations[toast.kind]}ms` } as CSSProperties
      }
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <Icon size={17} />
      <p>{toast.text}</p>
      <button
        className="icon-button"
        aria-label="Fechar aviso"
        onClick={onDismiss}
      >
        <X size={15} />
      </button>
    </li>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

export function useCopy() {
  const toast = useToast();
  return useCallback(
    (text: string, success = "Copiado.") =>
      navigator.clipboard.writeText(text).then(
        () => toast(success),
        () => toast("Não foi possível copiar. Confira a permissão.", "error"),
      ),
    [toast],
  );
}
