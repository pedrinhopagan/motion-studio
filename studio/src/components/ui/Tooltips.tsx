import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

// Preserva os data-tooltip existentes, com uma única camada fora dos recortes
// de painéis, cabeçalhos, diálogos e controles fixos.
export function Tooltips() {
  const id = useId();
  const tooltip = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = tooltip.current!;
    let anchor: HTMLElement | undefined;
    let describedBy: string | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;

    function hide() {
      clearTimeout(timer);

      if (element.matches(":popover-open")) {
        element.hidePopover();
      }

      if (anchor) {
        if (describedBy === null) {
          anchor.removeAttribute("aria-describedby");
        } else {
          anchor.setAttribute("aria-describedby", describedBy);
        }
      }

      anchor = undefined;
    }

    function show(target: EventTarget | null, delay: number) {
      const next =
        target instanceof Element
          ? target.closest<HTMLElement>("[data-tooltip]")
          : null;

      if (!next || next.matches(":disabled") || next === anchor) {
        return;
      }

      hide();
      anchor = next;
      describedBy = next.getAttribute("aria-describedby");
      timer = setTimeout(() => {
        const text = next.dataset.tooltip;

        if (!text || !next.isConnected) {
          hide();
          return;
        }

        element.textContent = text;
        next.setAttribute(
          "aria-describedby",
          [describedBy, id].filter(Boolean).join(" "),
        );
        element.showPopover();

        const rect = next.getBoundingClientRect();
        const height = element.offsetHeight;
        const width = element.offsetWidth;
        const below = rect.top < height + 16;
        element.style.left = `${Math.max(8, Math.min(rect.left + (rect.width - width) / 2, innerWidth - width - 8))}px`;
        element.style.top = `${Math.max(8, Math.min(below ? rect.bottom + 8 : rect.top - height - 8, innerHeight - height - 8))}px`;
      }, delay);
    }

    const pointerOver = (event: PointerEvent) => show(event.target, 250);
    const pointerOut = (event: PointerEvent) => {
      if (
        anchor &&
        !(
          event.relatedTarget instanceof Node &&
          anchor.contains(event.relatedTarget)
        )
      ) {
        hide();
      }
    };
    const focusIn = (event: FocusEvent) => show(event.target, 0);
    const focusOut = () => hide();
    const keyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        hide();
      }
    };

    document.addEventListener("pointerover", pointerOver);
    document.addEventListener("pointerout", pointerOut);
    document.addEventListener("focusin", focusIn);
    document.addEventListener("focusout", focusOut);
    document.addEventListener("keydown", keyDown);
    document.addEventListener("pointerdown", hide);
    addEventListener("scroll", hide, true);
    addEventListener("resize", hide);

    return () => {
      hide();
      document.removeEventListener("pointerover", pointerOver);
      document.removeEventListener("pointerout", pointerOut);
      document.removeEventListener("focusin", focusIn);
      document.removeEventListener("focusout", focusOut);
      document.removeEventListener("keydown", keyDown);
      document.removeEventListener("pointerdown", hide);
      removeEventListener("scroll", hide, true);
      removeEventListener("resize", hide);
    };
  }, [id]);

  return createPortal(
    <div
      ref={tooltip}
      id={id}
      className="tooltip-layer"
      role="tooltip"
      popover="manual"
    />,
    document.body,
  );
}
