import { useState } from "react";
import useJobStore, { isValidRange } from "../store/useJobStore";

interface Props {
  value: number;
  onChange: (speed: number) => void;
  disabled?: boolean;
}

function RangeInput({ label, value, onCommit, disabled }: {
  label: string;
  value: number;
  onCommit: (v: number) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  // Invalid input is dropped and the last valid value shows again
  const commit = () => {
    if (draft !== null) onCommit(Number(draft));
    setDraft(null);
  };
  return (
    <label className="flex items-center gap-1 text-xs text-slate-500">
      {label}
      <input
        type="number"
        step={0.05}
        min={0.5}
        max={2}
        value={draft ?? value}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); }}
        className="w-16 rounded-md border border-slate-300 bg-white px-1.5 py-1 text-xs text-slate-800
                   focus:border-indigo-500 focus:outline-none disabled:opacity-50"
      />
    </label>
  );
}

export default function SpeedSlider({ value, onChange, disabled }: Props) {
  const range = useJobStore((s) => s.speedRange);
  const setSpeedRange = useJobStore((s) => s.setSpeedRange);

  // A speed outside the new range is clamped through onChange, so callers' apply flows still run
  const commitRange = (next: { min: number; max: number }) => {
    if (!isValidRange(next)) return;
    setSpeedRange(next);
    const clamped = Math.min(next.max, Math.max(next.min, value));
    if (clamped !== value) onChange(clamped);
  };

  return (
    <div className="flex w-full flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-slate-700">Speed</label>
        <span className="font-mono text-sm text-indigo-700">{value.toFixed(2)}x</span>
      </div>
      <input
        type="range"
        min={range.min}
        max={range.max}
        step={0.01}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-indigo-600 disabled:opacity-50"
      />
      <div className="flex items-center justify-between gap-2">
        <RangeInput label="min" value={range.min} disabled={disabled}
          onCommit={(v) => commitRange({ min: v, max: range.max })} />
        <RangeInput label="max" value={range.max} disabled={disabled}
          onCommit={(v) => commitRange({ min: range.min, max: v })} />
      </div>
    </div>
  );
}
