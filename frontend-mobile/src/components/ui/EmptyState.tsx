import type { ReactNode } from "react";

export function EmptyState({
  icoon,
  titel,
  beschrijving,
  actie,
}: {
  icoon?: ReactNode;
  titel: string;
  beschrijving?: string;
  actie?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-rand bg-surface-verhoogd px-6 py-10 text-center">
      {icoon && <div className="text-3xl">{icoon}</div>}
      <p className="font-semibold text-ink">{titel}</p>
      {beschrijving && <p className="max-w-xs text-sm text-ink-zacht">{beschrijving}</p>}
      {actie}
    </div>
  );
}

export function FoutState({ titel, beschrijving }: { titel: string; beschrijving?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-suggestie-geweigerd/30 bg-suggestie-geweigerd/10 px-6 py-8 text-center">
      <div className="text-2xl">⚠️</div>
      <p className="font-semibold text-suggestie-geweigerd">{titel}</p>
      {beschrijving && <p className="max-w-xs text-sm text-ink-zacht">{beschrijving}</p>}
    </div>
  );
}
