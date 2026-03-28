import type { AnalyzedChapter } from "../store/useJobStore";

interface ChapterTile {
  index: number;
  title: string;
  status: "pending" | "converting" | "ready";
  audioUrl?: string;
}

interface Props {
  stage: string;
  progress: number;
  message: string;
  chunksTotal?: number;
  chunksDone?: number;
  chapters?: AnalyzedChapter[] | null;
  chapterAudios?: Record<number, string>;
  selectedChapterIndices?: number[];
  onChapterClick?: (chapterIndex: number, audioUrl: string) => void;
}

export default function ProcessingProgress({
  stage,
  progress,
  message,
  chunksTotal,
  chunksDone,
  chapters,
  chapterAudios = {},
  selectedChapterIndices,
  onChapterClick,
}: Props) {
  // Build chapter tiles from analyzed chapters + ready state
  const tiles: ChapterTile[] = [];

  if (chapters && chapters.length > 0) {
    const selectedSet = selectedChapterIndices
      ? new Set(selectedChapterIndices)
      : null;

    chapters.forEach((ch, i) => {
      if (selectedSet && !selectedSet.has(i)) return;
      if (!selectedSet && ch.isSkippable) return;

      const audioUrl = chapterAudios[i];
      let status: ChapterTile["status"] = "pending";
      if (audioUrl) {
        status = "ready";
      } else if (stage === "tts") {
        // The converting chapter is inferred from progress
        const readyCount = Object.keys(chapterAudios).length;
        const idx = [...(selectedSet ?? Object.keys(chapterAudios).map(Number))].sort((a, b) => a - b);
        if (idx[readyCount] === i) status = "converting";
      }

      tiles.push({ index: i, title: ch.title, status, audioUrl });
    });
  }

  const readyCount = Object.keys(chapterAudios).length;
  const totalSelected = tiles.length;
  const overallProgress = totalSelected > 0
    ? Math.round((readyCount / totalSelected) * 100)
    : progress;

  const hasChapterTiles = tiles.length > 0;

  return (
    <div className="w-full rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      {/* Progress bar */}
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-slate-600">{message}</p>
        <span className="text-sm font-semibold text-indigo-600">
          {hasChapterTiles ? `${readyCount}/${totalSelected}` : `${progress}%`}
        </span>
      </div>
      <div className="mb-5 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            stage === "complete" ? "bg-green-500" : "bg-indigo-500"
          }`}
          style={{ width: `${hasChapterTiles ? overallProgress : progress}%` }}
        />
      </div>

      {/* Chunk counter (shown when no chapter tiles yet) */}
      {!hasChapterTiles && stage === "tts" && chunksTotal && chunksTotal > 0 && (
        <p className="mb-4 text-xs text-slate-400">
          {chunksDone} / {chunksTotal} chunks converted
        </p>
      )}

      {/* Chapter tile grid */}
      {hasChapterTiles && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {tiles.map((tile) => (
            <div
              key={tile.index}
              onClick={() => tile.status === "ready" && tile.audioUrl && onChapterClick?.(tile.index, tile.audioUrl)}
              className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition
                ${tile.status === "ready"
                  ? "cursor-pointer border-green-200 bg-green-50 hover:bg-green-100"
                  : tile.status === "converting"
                    ? "border-amber-200 bg-amber-50"
                    : "border-slate-200 bg-slate-50"}
              `}
            >
              {/* Status icon */}
              <span className="shrink-0">
                {tile.status === "ready" ? (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500 text-white text-xs">
                    ▶
                  </span>
                ) : tile.status === "converting" ? (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-white">
                    <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  </span>
                ) : (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-300 text-slate-500 text-xs">
                    ○
                  </span>
                )}
              </span>

              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-slate-800">
                  {tile.title}
                </span>
                <span className={`text-xs ${
                  tile.status === "ready" ? "text-green-600" :
                  tile.status === "converting" ? "text-amber-600" :
                  "text-slate-400"
                }`}>
                  {tile.status === "ready" ? "Ready — click to play" :
                   tile.status === "converting" ? "Converting…" :
                   "Pending"}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
