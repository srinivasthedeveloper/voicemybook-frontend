import { useState, useEffect } from "react";
import type { AnalyzedChapter } from "../store/useJobStore";

interface Props {
  chapters: AnalyzedChapter[];
  onConvert: (selectedIndices: number[]) => void;
  disabled?: boolean;
}

function charCountLabel(chars: number | undefined) {
  if (!chars) return "";
  if (chars >= 1000) return `~${Math.round(chars / 1000)}k chars`;
  return `${chars} chars`;
}

export default function ChapterSelector({ chapters, onConvert, disabled }: Props) {
  // Default: select all non-skippable chapters with enough content
  const [selected, setSelected] = useState<Set<number>>(() => {
    const s = new Set<number>();
    chapters.forEach((ch, i) => {
      if (!ch.isSkippable && (ch.charCount ?? 0) >= 100) s.add(i);
    });
    return s;
  });

  // Re-initialize if chapters list changes
  useEffect(() => {
    const s = new Set<number>();
    chapters.forEach((ch, i) => {
      if (!ch.isSkippable && (ch.charCount ?? 0) >= 100) s.add(i);
    });
    setSelected(s);
  }, [chapters]);

  const eligibleCount = chapters.filter(
    (ch, i) => !ch.isSkippable && (ch.charCount ?? 0) >= 100
  ).length;
  const allSelected = selected.size === eligibleCount;

  function toggle(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  function selectAll() {
    const s = new Set<number>();
    chapters.forEach((ch, i) => {
      if (!ch.isSkippable && (ch.charCount ?? 0) >= 100) s.add(i);
    });
    setSelected(s);
  }

  function deselectAll() {
    setSelected(new Set());
  }

  function handleConvert() {
    onConvert([...selected].sort((a, b) => a - b));
  }

  return (
    <div className="w-full rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Select Chapters ({selected.size} of {chapters.length})
        </h3>
        <div className="flex gap-2">
          <button
            onClick={allSelected ? deselectAll : selectAll}
            className="text-xs text-indigo-600 hover:underline"
            disabled={disabled}
          >
            {allSelected ? "Deselect All" : "Select All"}
          </button>
        </div>
      </div>

      <ul className="mb-5 max-h-72 divide-y divide-slate-100 overflow-y-auto">
        {chapters.map((ch, i) => {
          const isEmpty = (ch.charCount ?? 0) < 100;
          const isChecked = selected.has(i);
          const isDisabled = disabled || ch.isSkippable || isEmpty;

          return (
            <li key={i}>
              <label
                className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5
                  text-sm transition hover:bg-slate-50
                  ${isDisabled ? "cursor-default opacity-50" : ""}
                  ${isChecked && !isDisabled ? "bg-indigo-50/50" : ""}
                `}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => !isDisabled && toggle(i)}
                  disabled={isDisabled}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600
                             accent-indigo-600 disabled:opacity-40"
                />
                <span className="flex-1 min-w-0">
                  <span className="block truncate font-medium text-slate-800">
                    {ch.title}
                  </span>
                  {(ch.isSkippable || isEmpty) && (
                    <span className="text-xs text-slate-400 italic">
                      {ch.isSkippable ? "Table of contents — skipped" : "Empty — skipped"}
                    </span>
                  )}
                </span>
                {ch.charCount != null && !ch.isSkippable && !isEmpty && (
                  <span className="shrink-0 text-xs text-slate-400">
                    {charCountLabel(ch.charCount)}
                  </span>
                )}
              </label>
            </li>
          );
        })}
      </ul>

      <button
        onClick={handleConvert}
        disabled={disabled || selected.size === 0}
        className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white
                   shadow-sm transition hover:bg-indigo-700 active:scale-[0.98]
                   disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {selected.size === 0
          ? "Select at least one chapter"
          : `Convert ${selected.size} chapter${selected.size !== 1 ? "s" : ""}`}
      </button>
    </div>
  );
}
