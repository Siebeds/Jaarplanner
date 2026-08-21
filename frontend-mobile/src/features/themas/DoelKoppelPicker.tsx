import { useState } from "react";
import { useLeerplandoelen } from "../../lib/queries";
import { DoelsoortBadge } from "../../components/ui/Badge";
import { TextInput } from "../../components/ui/Field";
import { IconSearch } from "../../components/Icons";

/**
 * A search-as-you-type picker for manually linking a leerplandoel by code. Reused everywhere a
 * teacher links a doel by hand: themadoelen, subdoelen, activiteit-koppelingen.
 */
export function DoelKoppelPicker({
  onKoppel,
  disabledCodes = [],
  bezig,
}: {
  onKoppel: (code: string) => void;
  disabledCodes?: string[];
  bezig?: boolean;
}) {
  const [zoek, setZoek] = useState("");
  const { data, isFetching } = useLeerplandoelen({ zoek: zoek.length >= 2 ? zoek : undefined, aantal: 8 });

  return (
    <div>
      <div className="relative">
        <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-zwak" />
        <TextInput
          value={zoek}
          onChange={(e) => setZoek(e.target.value)}
          placeholder="Zoek een leerplandoel op code of tekst…"
          className="pl-9"
        />
      </div>
      {zoek.length >= 2 && (
        <ul className="mt-2 flex max-h-64 flex-col gap-1.5 overflow-y-auto">
          {isFetching && <li className="py-2 text-center text-xs text-ink-zwak">Zoeken…</li>}
          {!isFetching && data && data.regels.length === 0 && (
            <li className="py-2 text-center text-xs text-ink-zwak">Geen doelen gevonden.</li>
          )}
          {data?.regels.map((doel) => {
            const alGekoppeld = disabledCodes.includes(doel.code);
            return (
              <li key={doel.code}>
                <button
                  type="button"
                  disabled={alGekoppeld || bezig}
                  onClick={() => {
                    onKoppel(doel.code);
                    setZoek("");
                  }}
                  className="flex w-full items-start gap-2 rounded-xl border border-rand bg-surface-verhoogd p-2.5 text-left disabled:opacity-50 active:bg-terra-zacht"
                >
                  <DoelsoortBadge doelsoort={doel.doelsoort} />
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-xs font-semibold text-ink-zacht">{doel.code}</p>
                    <p className="truncate text-sm text-ink">{doel.tekst}</p>
                  </div>
                  {alGekoppeld && <span className="text-[11px] font-semibold text-ink-zwak">al gekoppeld</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
