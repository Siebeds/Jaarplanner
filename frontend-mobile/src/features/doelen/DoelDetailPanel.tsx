import { useEffect, useState } from "react";
import { SidePanel } from "../../components/ui/SidePanel";
import { DoelDetailInhoud } from "./DoelDetailInhoud";

/**
 * The Doelen-hiërarchie's click-through: a doel opens in a non-blocking SidePanel rather than a
 * full page navigation, so the hiërarchie/filter behind it stays in place. Drill-down into a
 * "gerelateerd doel" swaps the panel's own code (with a back-breadcrumb) instead of navigating away.
 */
export function DoelDetailPanel({ code, open, onClose }: { code: string | null; open: boolean; onClose: () => void }) {
  const [historiek, setHistoriek] = useState<string[]>([]);
  const huidigeCode = historiek[historiek.length - 1] ?? code;

  useEffect(() => {
    if (open) setHistoriek([]);
  }, [open, code]);

  return (
    <SidePanel open={open} onClose={onClose} title="Leerplandoel" voetnoot={null}>
      {historiek.length > 0 && (
        <button
          onClick={() => setHistoriek((h) => h.slice(0, -1))}
          className="mb-3 text-sm font-semibold text-terra"
        >
          ← Terug naar {historiek.length > 1 ? historiek[historiek.length - 2] : code}
        </button>
      )}
      {huidigeCode && (
        <DoelDetailInhoud code={huidigeCode} onNavigeerNaarDoel={(c) => setHistoriek((h) => [...h, c])} />
      )}
    </SidePanel>
  );
}
