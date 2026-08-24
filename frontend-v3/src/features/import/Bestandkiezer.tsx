import { useId, useRef, useState, type DragEvent } from "react";
import { IcoonPlus } from "../../components/Iconen";
import { t } from "../../i18n";
import { cn } from "../../lib/cn";

/**
 * Picking one .xlsx.
 *
 * A real `<input type="file">` does the work, and the drop zone is layered on top rather than
 * replacing it: dropping is the fastest route on a desktop and does not exist on a phone, so the
 * button has to be the thing that is always there. The input keeps its own keyboard behaviour, which
 * is why it is a visible control here and not an `sr-only` element behind a fake button.
 *
 * The chosen file is named back to the reader with its size. That line is the only confirmation the
 * browser gives that the right file was picked, and picking the wrong xlsx out of a folder of them
 * is the mistake this screen cannot otherwise catch.
 */
export function Bestandkiezer({
  bestand,
  onKies,
  uitgeschakeld,
}: {
  bestand: File | null;
  onKies: (bestand: File | null) => void;
  uitgeschakeld?: boolean;
}) {
  const id = useId();
  const invoer = useRef<HTMLInputElement>(null);
  const [sleept, setSleept] = useState(false);

  function neem(bestanden: FileList | null) {
    const eerste = bestanden?.[0] ?? null;
    if (eerste) onKies(eerste);
  }

  function opDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setSleept(false);
    if (uitgeschakeld) return;
    neem(e.dataTransfer.files);
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!uitgeschakeld) setSleept(true);
      }}
      onDragLeave={() => setSleept(false)}
      onDrop={opDrop}
      className={cn(
        "rounded-kaart border border-dashed p-4 transition-colors duration-150",
        sleept ? "border-accent bg-accent-zacht" : "border-lijn-sterk bg-kaart",
        uitgeschakeld && "opacity-45",
      )}
    >
      <label htmlFor={id} className="flex items-center gap-2 text-meta font-medium text-inkt">
        <IcoonPlus aria-hidden="true" className="h-4 w-4 shrink-0 text-inkt-zwak" />
        {t("importeren.kiesBestand")}
      </label>

      <input
        ref={invoer}
        id={id}
        type="file"
        accept=".xlsx"
        disabled={uitgeschakeld}
        onChange={(e) => neem(e.target.files)}
        className={cn(
          "mt-2 block w-full cursor-pointer text-meta text-inkt-zacht",
          "file:mr-3 file:min-h-raak file:cursor-pointer file:rounded-veld file:border file:border-lijn-veld",
          "file:bg-kaart file:px-4 file:text-body file:font-medium file:text-inkt",
          "hover:file:border-inkt hover:file:bg-vlak",
        )}
      />

      {bestand ? (
        <p className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-meta text-inkt">
          <span className="min-w-0 break-all font-medium">{bestand.name}</span>
          <span className="mono shrink-0 text-micro text-inkt-zwak">
            {t("importeren.grootte", { kb: Math.max(1, Math.round(bestand.size / 1024)) })}
          </span>
        </p>
      ) : null}
    </div>
  );
}
