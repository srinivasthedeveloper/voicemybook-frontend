import { useCallback } from "react";
import { useDropzone } from "react-dropzone";

interface Props {
  onFile: (file: File) => void;
  disabled?: boolean;
}

const DropZone = ({ onFile, disabled }: Props) => {
  const onDrop = useCallback(
    (accepted: File[]) => {
      if (accepted[0]) onFile(accepted[0]);
    },
    [onFile],
  );

  const { getRootProps, getInputProps, isDragActive, fileRejections } =
    useDropzone({
      onDrop,
      accept: { "application/pdf": [".pdf"] },
      maxFiles: 1,
      maxSize: 50 * 1024 * 1024,
      disabled,
    });

  const rejected = fileRejections[0];

  return (
    <div className="w-full">
      <div
        {...getRootProps()}
        className={`
          relative flex flex-col items-center justify-center gap-4
          rounded-2xl border-2 border-dashed px-8 py-14 text-center
          transition-colors cursor-pointer select-none h-70
          ${disabled ? "cursor-not-allowed opacity-50" : ""}
          ${
            isDragActive
              ? "border-indigo-500 bg-indigo-50"
              : "border-slate-300 bg-slate-50 hover:border-indigo-400 hover:bg-indigo-50/50"
          }
        `}
      >
        <input {...getInputProps()} />

        {/* Icon */}
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100">
          <svg
            className="h-8 w-8 text-indigo-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
            />
          </svg>
        </div>

        {isDragActive ? (
          <p className="text-lg font-medium text-indigo-600">
            Drop your PDF here
          </p>
        ) : (
          <>
            <div>
              <p className="text-lg font-medium text-slate-700">
                Drag & drop your PDF here
              </p>
              <p className="mt-1 text-sm text-slate-500">
                or{" "}
                <span className="font-medium text-indigo-600 underline underline-offset-2">
                  browse files
                </span>
              </p>
            </div>
            <p className="text-xs text-slate-400">PDF files up to 50 MB</p>
          </>
        )}
      </div>

      {rejected && (
        <p className="mt-2 text-sm text-red-500">
          {rejected.errors[0]?.message || "Invalid file"}
        </p>
      )}
    </div>
  );
};

export { DropZone };
