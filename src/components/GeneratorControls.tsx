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
  activeChapter?: ChapterGen;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onStopAll: () => void;
}

const btn = "min-h-10 rounded-lg px-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40";

export default function GeneratorControls({
  chapters, queue, jobId, titles, charCounts, parallel, msPerChar,
  activeChapter, onStart, onPause, onResume, onStop, onStopAll,
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
    <section aria-label="Generator" className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="text-base font-semibold text-slate-900">
          {generating.length ? "Generating audio" : "Generator idle"}
        </h2>
        <p className="text-xs text-slate-500">
          {[
            parallel > 1 ? `${parallel} chapters at a time` : null,
            mine.length ? `${mine.length} queued` : null,
            otherBooks ? `${otherBooks} from other books` : null,
            (generating.length || mine.length) && allDoneSec != null ? `all done ${formatEta(allDoneSec)}` : null,
          ].filter(Boolean).join(", ")}
        </p>
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
        {activeChapter && activeChapter.state !== "generating" && activeChapter.state !== "queued" && (
          <button
            onClick={onStart}
            title="Applies to the chapter that's open in the player"
            className={`${btn} ${activeChapter.state === "ready"
              ? "border border-slate-200 text-slate-800 hover:bg-slate-100"
              : "bg-indigo-600 text-bg hover:opacity-90"}`}
          >
            {activeChapter.state === "paused" ? "Resume this chapter"
              : activeChapter.state === "ready" ? "Regenerate this chapter"
              : "Generate this chapter"}
          </button>
        )}
        <button onClick={onPause} disabled={!has("generating", "queued")} className={`${btn} bg-slate-100 text-slate-800 hover:bg-slate-200`}>Pause</button>
        <button onClick={onResume} disabled={!has("paused")} className={`${btn} bg-slate-100 text-slate-800 hover:bg-slate-200`}>Resume</button>
        <button onClick={onStop} disabled={!has("generating", "queued", "paused")} className={`${btn} bg-danger-bg text-danger hover:opacity-80`}>Stop</button>
        <button
          onClick={onStopAll}
          title="Stop every running chapter and clear the queue for every book"
          className={`${btn} border border-slate-200 text-danger hover:bg-danger-bg sm:ml-auto`}
        >
          Stop all books
        </button>
      </div>
    </section>
  );
}
