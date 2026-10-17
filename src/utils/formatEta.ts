export function formatEta(sec: number | null | undefined) {
  if (sec == null) return "";
  if (sec < 60) return "<1 min";
  const m = Math.round(sec / 60);
  return m < 60 ? `~${m} min` : `~${Math.floor(m / 60)}h ${m % 60}m`;
}
