import type { CSSProperties } from "react";

export function Slider({
  label,
  value,
  min = 0,
  max = 1,
  step = 0.01,
  disabled,
  format = (current) => `${Math.round(current * 100)}%`,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  format?: (value: number) => string;
  onChange: (value: number) => void;
}) {
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <label className="slider-field">
      <span>
        {label}
        <output>{format(value)}</output>
      </span>
      <input
        type="range"
        className="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        style={{ "--fill": `${fill}%` } as CSSProperties}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}
