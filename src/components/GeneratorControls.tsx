import type { ChapterGen, QueueItem } from "../api/client";
import { formatEta } from "../utils/formatEta";

interface Props {
  chapters: ChapterGen[];
  queue: QueueItem[];
  jobId: string;
  titles: string[];
  charCounts: (number | undefined)[];
  parallel: number;
  msPerChar: number;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onStopAll: () => void;
}

const btn = "rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40";

export default function GeneratorControls({
  chapters, queue, jobId, titles, charCounts, parallel, msPerChar,
  onStart, onPause, onResume, onStop, onStopAll,
}: Props) {
  const has = (...states: ChapterGen["state"][]) => chapters.some((c) => states.includes(c.state));
  const generating = chapters.filter((c) => c.state === "generating");
  const mine = queue.filter((q) => q.jobId === jobId);
  const otherBooks = queue.length - mine.length;

  // Rough finish time for this book: running chapters plus queued text, shared across parallel slots
  const activeSec = generating.reduce((n, c) => n + (c.etaSec ?? 0), 0);
  const queuedSec = mine.reduce((n, q) => n + ((charCounts[q.chapterIndex] ?? 0) * msPerChar) / 1000, 0);
  const longest = Math.max(0, ...generating.map((c) => c.etaSec ?? 0));
  const allDoneSec = msPerChar > 0 ? Math.max(longest, (activeSec + queuedSec) / Math.max(1, parallel)) : null;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Generator
          {parallel > 1 && <span className="ml-2 font-normal normal-case text-slate-400">· {parallel} chapters at a time</span>}
        </h3>
        <span className="text-xs text-slate-500">
          {generating.length === 0 && "Idle"}
          {mine.length > 0 && ` ${mine.length} queued`}
          {otherBooks > 0 && ` · ${otherBooks} from other books`}
          {(generating.length > 0 || mine.length > 0) && allDoneSec != null && ` · all done ${formatEta(allDoneSec)}`}
        </span>
      </div>

      {generating.map((c) => {
        const done = c.chunks.length;
        const total = c.totalChunks ?? 0;
        const pct = total ? Math.round((done / total) * 100) : 0;
        return (
          <div key={c.chapterIndex} className="flex flex-col gap-1">
            <div className="flex justify-between gap-2 text-xs text-slate-600">
              <span className="truncate">
                {titles[c.chapterIndex] ?? `Chapter ${c.chapterIndex + 1}`}: {done}{total ? `/${total}` : ""} parts
              </span>
              <span className="shrink-0 text-slate-500">
                {c.etaSec != null ? `${formatEta(c.etaSec)} left` : "estimating…"}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
      {generating.length > 0 && <p className="text-xs text-slate-400">Each chapter merges into one file when it finishes.</p>}

      <div className="flex flex-wrap gap-2">
        <button onClick={onStart} className={`${btn} bg-indigo-600 text-white hover:bg-indigo-700`}>Start</button>
        <button onClick={onPause} disabled={!has("generating", "queued")} className={`${btn} bg-slate-100 text-slate-700 hover:bg-slate-200`}>Pause</button>
        <button onClick={onResume} disabled={!has("paused")} className={`${btn} bg-slate-100 text-slate-700 hover:bg-slate-200`}>Resume</button>
        <button onClick={onStop} disabled={!has("generating", "queued", "paused")} className={`${btn} bg-red-50 text-red-700 hover:bg-red-100`}>Stop</button>
        <button
          onClick={onStopAll}
          title="Stop every running chapter and clear the queue for every book"
          className={`${btn} ml-auto border border-red-200 text-red-700 hover:bg-red-50`}
        >
          Stop all / clear queue
        </button>
      </div>
    </div>
  );
}
