import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/format";

export interface SelectOption<V extends string> {
  value: V;
  label: string;
  hint?: string;
  group?: string;
  icon?: ReactNode;
}

// Combobox só de seleção (WAI-ARIA APG): o foco fica no botão e a lista, na
// camada superior, acompanha a opção ativa por aria-activedescendant.
export function Select<V extends string>({
  value,
  options,
  onChange,
  label,
  placeholder = "Selecione",
  size = "md",
  variant = "field",
  disabled = false,
  className,
}: {
  value: V;
  options: SelectOption<V>[];
  onChange: (value: V) => void;
  label: string;
  placeholder?: string;
  size?: "sm" | "md";
  variant?: "field" | "ghost";
  disabled?: boolean;
  className?: string;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const typed = useRef({ text: "", at: 0 });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const selectedIndex = options.findIndex((option) => option.value === value);
  const selected = options[selectedIndex];

  function show() {
    if (!disabled && !list.current?.matches(":popover-open")) {
      list.current?.showPopover();
    }
  }
  function hide() {
    if (list.current?.matches(":popover-open")) {
      list.current.hidePopover();
    }
  }
  function choose(index: number) {
    const option = options[index];
    if (option) {
      onChange(option.value);
    }
    hide();
    trigger.current?.focus();
  }

  // Posiciona antes de abrir (sem piscar no centro da tela) e corrige depois
  // de abrir, já com a altura real, virando para cima se faltar espaço.
  const place = useCallback(() => {
    const element = list.current;
    const anchor = trigger.current?.getBoundingClientRect();
    if (!element || !anchor) {
      return;
    }
    const height = element.offsetHeight;
    const below = innerHeight - anchor.bottom - 8;
    const flip = height > below && anchor.top > below;
    element.style.minWidth = `${anchor.width}px`;
    element.style.maxHeight = `${Math.max(160, flip ? anchor.top - 12 : below)}px`;
    element.style.left = `${Math.max(8, Math.min(anchor.left, innerWidth - element.offsetWidth - 8))}px`;
    element.style.top = flip
      ? `${Math.max(8, anchor.top - height - 4)}px`
      : `${anchor.bottom + 4}px`;
  }, []);

  useEffect(() => {
    const element = list.current!;
    const handle = (event: ToggleEvent) => {
      if (event.newState === "open") {
        place();
      }
    };
    element.addEventListener("beforetoggle", handle);
    return () => element.removeEventListener("beforetoggle", handle);
  }, [place]);

  useLayoutEffect(() => {
    if (open) {
      place();
    }
  }, [open, place]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const close = (event: Event) => {
      if (!list.current?.contains(event.target as Node)) {
        hide();
      }
    };
    addEventListener("resize", close);
    addEventListener("scroll", close, true);
    return () => {
      removeEventListener("resize", close);
      removeEventListener("scroll", close, true);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      document
        .getElementById(`${id}-${active}`)
        ?.scrollIntoView({ block: "nearest" });
    }
  }, [open, active, id]);

  function handleKey(event: KeyboardEvent) {
    const last = options.length - 1;
    const moves: Record<string, number> = {
      ArrowDown: Math.min(last, active + 1),
      ArrowUp: Math.max(0, active - 1),
      Home: 0,
      End: last,
      PageDown: Math.min(last, active + 8),
      PageUp: Math.max(0, active - 8),
    };
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
        event.preventDefault();
        show();
      }
      return;
    }
    if (event.key in moves) {
      event.preventDefault();
      setActive(moves[event.key]);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(active);
    } else if (event.key === "Tab") {
      hide();
    } else if (event.key.length === 1) {
      const now = performance.now();
      typed.current = {
        text:
          (now - typed.current.at < 600 ? typed.current.text : "") +
          event.key.toLocaleLowerCase(),
        at: now,
      };
      const match = options.findIndex((option) =>
        option.label.toLocaleLowerCase().startsWith(typed.current.text),
      );
      if (match >= 0) {
        setActive(match);
      }
    }
  }

  return (
    <div
      className={cn("select", `select-${size}`, `select-${variant}`, className)}
    >
      <button
        ref={trigger}
        type="button"
        role="combobox"
        className="select-trigger"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        disabled={disabled}
        popoverTarget={`${id}-list`}
        onKeyDown={handleKey}
      >
        {selected?.icon}
        <span className={cn("select-value", !selected && "placeholder")}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown size={size === "sm" ? 13 : 15} aria-hidden />
      </button>
      <div
        ref={list}
        id={`${id}-list`}
        role="listbox"
        aria-label={label}
        className="select-list"
        popover="auto"
        onToggle={(event) => {
          const opened = event.newState === "open";
          if (opened) {
            setActive(Math.max(0, selectedIndex));
          }
          setOpen(opened);
        }}
        onPointerDown={(event) => event.preventDefault()}
      >
        {options.map((option, index) => {
          const group =
            option.group && option.group !== options[index - 1]?.group
              ? option.group
              : undefined;
          return (
            <div key={option.value} className="select-item">
              {group && (
                <div className="select-group" aria-hidden>
                  {group}
                </div>
              )}
              <div
                id={`${id}-${index}`}
                role="option"
                aria-selected={option.value === value}
                className={cn("select-option", index === active && "active")}
                onPointerMove={() => setActive(index)}
                onClick={() => choose(index)}
              >
                {option.icon}
                <span>
                  {option.label}
                  {option.hint && <small>{option.hint}</small>}
                </span>
                {option.value === value && <Check size={14} aria-hidden />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
