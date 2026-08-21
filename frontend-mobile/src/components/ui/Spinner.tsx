/** A full-height centered spinner, for a screen still loading its data. */
export function Spinner({ label = "Bezig met laden…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-ink-zacht" role="status">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-terra-zacht border-t-terra" />
      <p className="text-sm">{label}</p>
    </div>
  );
}
