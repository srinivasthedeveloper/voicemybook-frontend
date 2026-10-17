interface Props {
  onStartOver: () => void;
  onResume: () => void;
  onCancel: () => void;
  busy?: boolean;
}

export default function SettingsApplyBar({ onStartOver, onResume, onCancel, busy }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
      <span className="text-sm text-amber-800">Generation paused — settings changed.</span>
      <button
        onClick={onStartOver}
        disabled={busy}
        className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
      >
        Apply &amp; start over
      </button>
      <button
        onClick={onResume}
        disabled={busy}
        className="rounded-lg border border-indigo-300 px-3 py-1.5 text-sm font-medium text-indigo-700 transition hover:bg-indigo-50 disabled:opacity-50"
      >
        Apply &amp; resume
      </button>
      <button onClick={onCancel} disabled={busy} className="text-sm text-slate-500 underline hover:text-slate-700">
        Cancel
      </button>
    </div>
  );
}
