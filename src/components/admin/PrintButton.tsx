"use client";

export default function PrintButton({ label = "Print (Ctrl+P)" }: { label?: string }) {
  return (
    <div className="flex gap-2">
      <button
        onClick={() => window.print()}
        className="bg-amber-400 text-slate-900 text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-amber-300 transition"
      >
        🖨️ {label}
      </button>
    </div>
  );
}
