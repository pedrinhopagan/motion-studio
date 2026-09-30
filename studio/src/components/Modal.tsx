import { useEffect, useRef, useId, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/format";

export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useId();
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    dialog.current?.showModal();
    const element = dialog.current;
    return () => element?.close();
  }, []);

  return (
    <dialog
      ref={dialog}
      className={cn("modal", wide && "modal-wide")}
      aria-labelledby={heading}
      onCancel={(event) => {
        event.preventDefault();
        close.current();
      }}
      onClick={(event) => {
        if (event.target === dialog.current) {
          close.current();
        }
      }}
    >
      <div className="modal-header">
        <h2 id={heading}>{title}</h2>
        <button
          className="icon-button"
          aria-label="Fechar"
          data-tooltip="Fechar"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
