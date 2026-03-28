import type { Chapter } from "../store/useJobStore";

interface Props {
  chapters: Chapter[];
  currentTime?: number;
  onSeek: (startSec: number) => void;
}

function formatTime(secs: number) {
  if (!isFinite(secs) || secs < 0) return "0:00";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function ChapterList({
  chapters,
  currentTime = 0,
  onSeek,
}: Props) {
  if (!chapters || chapters.length === 0) return null;

  // Find active chapter
  const activeIdx = [...chapters]
    .reverse()
    .findIndex((ch) => currentTime >= ch.startSec);
  const activeFwd = activeIdx >= 0 ? chapters.length - 1 - activeIdx : 0;

  return (
    <div className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Chapters
      </h3>
      <ul className="divide-y divide-slate-100">
        {chapters.map((ch, i) => (
          <li key={i}>
            <button
              onClick={() => onSeek(ch.startSec)}
              className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5
                          text-left text-sm transition hover:bg-indigo-50
                          ${i === activeFwd ? "bg-indigo-50 font-medium text-indigo-700" : "text-slate-700"}`}
            >
              <span className="flex items-center gap-2.5">
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs
                    ${i === activeFwd ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"}`}
                >
                  {i + 1}
                </span>
                <span className="truncate">{ch.title}</span>
              </span>
              <span className="shrink-0 text-xs text-slate-400">
                {formatTime(ch.startSec)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
