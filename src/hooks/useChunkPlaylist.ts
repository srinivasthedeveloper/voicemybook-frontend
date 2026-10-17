import { useCallback, useEffect, useRef, useState } from "react";
import { resolveApiUrl, type ChunkInfo } from "../api/client";

/**
 * Plays a chapter's chunks back to back as they arrive.
 * Restarts at chunk 0 when `key` (chapter + run) changes; waits when the next chunk isn't generated yet.
 * The next chunk is prefetched into a blob so playback doesn't stall while the server is busy synthesizing.
 */
export function useChunkPlaylist(
  chunks: ChunkInfo[],
  key: string,
  complete: boolean,
  onFinished: () => void,
) {
  const [pos, setPos] = useState(0);
  const [lastKey, setLastKey] = useState(key);
  if (lastKey !== key) {
    setLastKey(key);
    setPos(0);
  }

  // url -> blob URL, scoped to the current key
  const [blobs, setBlobs] = useState<Record<string, string>>({});
  const pending = useRef(new Set<string>());

  useEffect(() => {
    const started = pending.current;
    return () => {
      started.clear();
      setBlobs((b) => {
        Object.values(b).forEach((u) => URL.revokeObjectURL(u));
        return {};
      });
    };
  }, [key]);

  const byIndex = (i: number) => chunks.find((c) => c.chunkIndex === i);
  const current = byIndex(pos);
  const shown = current ?? byIndex(pos - 1);
  const next = byIndex(pos + 1);
  const waiting = !current && pos > 0 && !complete;

  // Source is picked once per chunk so a late blob never swaps (and restarts) the playing clip
  const [chosen, setChosen] = useState<{ url: string; src: string } | null>(null);
  if (shown && chosen?.url !== shown.url) {
    setChosen({ url: shown.url, src: blobs[shown.url] ?? resolveApiUrl(shown.url) });
  }

  useEffect(() => {
    if (!next || pending.current.has(next.url)) return;
    pending.current.add(next.url);
    fetch(resolveApiUrl(next.url))
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
      .then((blob) => setBlobs((b) => ({ ...b, [next.url]: URL.createObjectURL(blob) })))
      .catch(() => pending.current.delete(next.url));
  }, [next]);

  const onEnded = useCallback(() => {
    const hasNext = chunks.some((c) => c.chunkIndex === pos + 1);
    if (complete && !hasNext) onFinished();
    else setPos(pos + 1);
  }, [chunks, pos, complete, onFinished]);

  const jumpTo = useCallback((i: number) => setPos(i), []);

  return {
    jumpTo,
    src: shown && chosen?.url === shown.url ? chosen.src : null,
    text: shown?.text ?? "",
    position: pos,
    waiting,
    onEnded,
  };
}
