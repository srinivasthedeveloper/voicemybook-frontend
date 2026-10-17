import type { ChapterGen } from "../api/client";
import { formatEta } from "../utils/formatEta";

interface Props {
  chapters: ChapterGen[];
  titles: string[];
  skippable: boolean[];
  activeIndex: number;
  selected: Set<number>;
  onSelectedChange: (next: Set<number>) => void;
  onOpen: (index: number) => void;
  onPlay: (c: ChapterGen) => void;
  onGenerate: (index: number) => void;
  onPause: (index: number) => void;
  onStop: (index: number) => void;
  onStartMany: (indices: number[]) => void;
  downloadUrl: (index: number) => string;
}

const STATUS: Record<ChapterGen["state"], { label: string; tone: string }> = {
  not_started: { label: "Not started", tone: "text-slate-500" },
  queued: { label: "Queued", tone: "text-info" },
  generating: { label: "Generating", tone: "text-warn" },
  paused: { label: "Paused", tone: "text-warn" },
  ready: { label: "Ready", tone: "text-ok" },
  stopped: { label: "Stopped", tone: "text-danger" },
};

const iconBtn =
  "flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:pointer-events-none disabled:opacity-25";

const Icon = {
  play: <path d="M8 5v14l11-7z" fill="currentColor" />,
  pause: <path d="M7 5h3v14H7zM14 5h3v14h-3z" fill="currentColor" />,
  stop: <rect x="6" y="6" width="12" height="12" rx="1.5" fill="currentColor" />,
  generate: <path d="M12 3v3m0 12v3m9-9h-3M6 12H3m15.4-6.4-2.1 2.1M7.7 16.3l-2.1 2.1m12.8 0-2.1-2.1M7.7 7.7 5.6 5.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />,
  download: <path d="M12 4v11m0 0-4-4m4 4 4-4M5 19h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />,
};
const Svg = ({ children }: { children: React.ReactNode }) => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">{children}</svg>
);

function statusLine(c: ChapterGen) {
  const { label } = STATUS[c.state];
  const progress = (c.state === "generating" || c.state === "paused") && c.totalChunks
    ? ` ${c.chunks.length}/${c.totalChunks}`
    : "";
  const eta = c.state === "generating" && c.etaSec != null ? ` · ${formatEta(c.etaSec)} left` : "";
  return `${label}${progress}${eta}`;
}

export default function ChapterPanel({
  chapters, titles, skippable, activeIndex, selected, onSelectedChange,
  onOpen, onPlay, onGenerate, onPause, onStop, onStartMany, downloadUrl,
}: Props) {
  const ready = chapters.filter((c) => c.hasAudio).length;
  const allSelected = selected.size > 0 && selected.size === chapters.length;
  const toggle = (i: number) => {
    const next = new Set(selected);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    onSelectedChange(next);
  };
  const startable = (c: ChapterGen) => c.state !== "queued" && c.state !== "generating";
  const startAll = chapters
    .filter((c) => ["not_started", "paused", "stopped"].includes(c.state) && !skippable[c.chapterIndex])
    .map((c) => c.chapterIndex);

  return (
    <section aria-label="Chapters" className="flex flex-col">
      <div className="sticky top-[110px] z-10 flex flex-col gap-2 border-b border-slate-200 bg-bg px-3 py-3 lg:top-0">
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-semibold text-slate-900">Chapters</h2>
          <span className="text-xs text-slate-500">{ready} of {chapters.length} ready</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex min-h-9 cursor-pointer items-center gap-2 pr-1 text-sm text-slate-600">
            <input
              type="checkbox"
              className="h-4 w-4 accent-indigo-600"
              checked={allSelected}
              ref={(el) => { if (el) el.indeterminate = selected.size > 0 && !allSelected; }}
              onChange={() => onSelectedChange(allSelected ? new Set() : new Set(chapters.map((c) => c.chapterIndex)))}
            />
            All
          </label>
          <button
            disabled={selected.size === 0}
            onClick={() => {
              onStartMany([...selected].filter((i) => startable(chapters[i])));
              onSelectedChange(new Set());
            }}
            className="min-h-9 rounded-lg bg-indigo-600 px-3 text-sm font-medium text-bg transition hover:opacity-90 disabled:opacity-40"
          >
            Generate selected{selected.size ? ` (${selected.size})` : ""}
          </button>
          <button
            disabled={startAll.length === 0}
            onClick={() => onStartMany(startAll)}
            title="Queue every chapter that isn't ready, queued or generating"
            className="min-h-9 rounded-lg border border-indigo-200 px-3 text-sm font-medium text-indigo-700 transition hover:bg-indigo-50 disabled:opacity-40"
          >
            Generate all
          </button>
        </div>
      </div>

      <ul className="flex flex-col gap-0.5 p-1.5">
        {chapters.map((c) => {
          const i = c.chapterIndex;
          const active = i === activeIndex;
          const busy = c.state === "generating" || c.state === "queued";
          const pct = c.totalChunks ? Math.round((c.chunks.length / c.totalChunks) * 100) : 0;
          return (
            <li
              key={i}
              className={`flex items-center gap-2 rounded-lg px-1.5 py-1 ${active ? "bg-indigo-50" : ""}`}
            >
              <input
                type="checkbox"
                aria-label={`Select ${titles[i]}`}
                checked={selected.has(i)}
                onChange={() => toggle(i)}
                className="h-4 w-4 shrink-0 accent-indigo-600"
              />
              <button
                onClick={() => onOpen(i)}
                aria-current={active ? "true" : undefined}
                className="min-w-0 flex-1 rounded-md px-1 py-1 text-left"
              >
                <span className={`block truncate text-sm ${active ? "font-semibold text-indigo-700" : "font-medium text-slate-800"}`}>
                  {titles[i]}
                </span>
                <span className={`block truncate text-xs ${STATUS[c.state].tone}`} title={c.error}>
                  {statusLine(c)}
                </span>
                {c.state === "generating" && c.totalChunks ? (
                  <span className="mt-1 block h-1 overflow-hidden rounded-full bg-slate-200">
                    <span className="block h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${pct}%` }} />
                  </span>
                ) : null}
              </button>
              <div className="flex shrink-0 items-center">
                <button
                  className={iconBtn}
                  disabled={!(c.chunks.length > 0 || c.hasAudio)}
                  onClick={() => onPlay(c)}
                  aria-label={`Play ${titles[i]}`}
                  title="Play"
                >
                  <Svg>{Icon.play}</Svg>
                </button>
                {busy ? (
                  <button className={iconBtn} onClick={() => onPause(i)} aria-label={`Pause generating ${titles[i]}`} title="Pause generating">
                    <Svg>{Icon.pause}</Svg>
                  </button>
                ) : (
                  <button
                    className={iconBtn}
                    onClick={() => onGenerate(i)}
                    aria-label={`${c.state === "paused" ? "Resume" : c.hasAudio ? "Regenerate" : "Generate"} ${titles[i]}`}
                    title={c.state === "paused" ? "Resume generating" : c.hasAudio ? "Regenerate" : "Generate"}
                  >
                    <Svg>{Icon.generate}</Svg>
                  </button>
                )}
                {(busy || c.state === "paused") && (
                  <button className={iconBtn} onClick={() => onStop(i)} aria-label={`Stop generating ${titles[i]}`} title="Stop generating">
                    <Svg>{Icon.stop}</Svg>
                  </button>
                )}
                {c.hasAudio && (
                  <a
                    className={iconBtn}
                    href={downloadUrl(i)}
                    download={`${String(i + 1).padStart(2, "0")} - ${titles[i]}.mp3`}
                    aria-label={`Download ${titles[i]}`}
                    title="Download MP3"
                  >
                    <Svg>{Icon.download}</Svg>
                  </a>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
