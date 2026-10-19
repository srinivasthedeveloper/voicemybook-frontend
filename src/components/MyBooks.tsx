import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getBookSummaries, type BookStatus, type BookSummary } from "../api/client";
import { forgetBooks, myBookIds } from "../utils/myBooks";

const STATUS: Record<BookStatus, { label: string; tone: string }> = {
  generating: { label: "Generating", tone: "text-warn" },
  stopped: { label: "Stopped", tone: "text-danger" },
  done: { label: "Done", tone: "text-ok" },
  not_started: { label: "Not started", tone: "text-slate-500" },
};
const FILTERS: { key: "all" | BookStatus; label: string }[] = [
  { key: "all", label: "All" },
  { key: "generating", label: "Generating" },
  { key: "stopped", label: "Stopped" },
  { key: "done", label: "Done" },
];

export default function MyBooks() {
  const [books, setBooks] = useState<BookSummary[] | null>(null);
  const [filter, setFilter] = useState<"all" | BookStatus>("all");

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let alive = true;
    async function load() {
      const ids = myBookIds();
      if (!ids.length) return setBooks([]);
      try {
        const found = await getBookSummaries(ids);
        if (!alive) return;
        forgetBooks(ids.filter((id) => !found.some((b) => b.id === id))); // removed by server cleanup
        setBooks(found);
        if (found.some((b) => b.status === "generating")) timer = setTimeout(() => void load(), 10000);
      } catch {
        if (alive) setBooks((b) => b ?? []);
      }
    }
    void load();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, []);

  if (!books?.length) return null;
  const shown = filter === "all" ? books : books.filter((b) => b.status === filter);

  return (
    <section aria-label="Your books" className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-slate-900">Your books</h2>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filter books">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              aria-pressed={filter === f.key}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                filter === f.key ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {f.label} ({f.key === "all" ? books.length : books.filter((b) => b.status === f.key).length})
            </button>
          ))}
        </div>
      </div>
      {shown.length === 0 ? (
        <p className="text-sm text-slate-500">No books here.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-slate-200">
          {shown.map((b) => (
            <li key={b.id}>
              <Link to={`/player/${b.id}`} className="flex items-center gap-3 py-2.5 hover:bg-slate-50">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">{b.filename.replace(/\.pdf$/i, "")}</p>
                  <p className="text-xs text-slate-500">
                    {b.readyChapters}/{b.totalChapters} chapters ready · {new Date(`${b.createdAt}Z`).toLocaleDateString()}
                  </p>
                </div>
                <span className={`shrink-0 text-xs font-medium ${STATUS[b.status].tone}`}>{STATUS[b.status].label}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
