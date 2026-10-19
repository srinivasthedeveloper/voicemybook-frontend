interface Props {
  onStartOver: () => void;
  onResume: () => void;
  onCancel: () => void;
  busy?: boolean;
  resumeDisabled?: boolean;
  note?: string;
}

export default function SettingsApplyBar({ onStartOver, onResume, onCancel, busy, resumeDisabled, note }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-warn bg-warn-bg p-3">
      <span className="text-sm text-slate-900">
        Generation paused while you change settings.{note && <span className="block text-xs text-slate-600">{note}</span>}
      </span>
      <button
        onClick={onStartOver}
        disabled={busy}
        className="min-h-10 rounded-lg bg-indigo-600 px-3 text-sm font-medium text-bg transition hover:opacity-90 disabled:opacity-50"
      >
        Apply &amp; start over
      </button>
      <button
        onClick={onResume}
        disabled={busy || resumeDisabled}
        className="min-h-10 rounded-lg border border-indigo-300 px-3 text-sm font-medium text-indigo-700 transition hover:bg-indigo-50 disabled:opacity-50"
      >
        Apply &amp; resume
      </button>
      <button onClick={onCancel} disabled={busy} className="text-sm text-slate-500 underline hover:text-slate-700">
        Cancel
      </button>
    </div>
  );
}
