import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Field, TextArea, TextInput } from "../../components/ui/Field";
import { IconPencil } from "../../components/Icons";
import { useWijzigThema } from "../../lib/queries";
import type { ThemaWeergave } from "../../lib/types";

/**
 * The thema's own details: duur (in weken), invalshoeken and kernwoordenschat — read at a glance, edited
 * in place via a pencil toggle rather than a separate sheet, since these are the three fields a teacher
 * revisits most often while shaping a thema. Naam and rijkeWoordenschat travel along unchanged on save
 * (the backend PUT replaces the whole record, Art. VIII) since neither is edited here.
 */
export function ThemaDetailsSectie({ thema }: { thema: ThemaWeergave }) {
  const [bewerken, setBewerken] = useState(false);
  const wijzig = useWijzigThema(thema.id);

  if (bewerken) {
    return (
      <ThemaDetailsForm
        thema={thema}
        bezig={wijzig.isPending}
        onAnnuleer={() => setBewerken(false)}
        onOpslaan={(waarden) =>
          wijzig.mutate(
            { naam: thema.naam, rijkeWoordenschat: thema.rijkeWoordenschat, ...waarden },
            { onSuccess: () => setBewerken(false) },
          )
        }
      />
    );
  }

  return (
    <Card>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink-zwak">Details</h2>
        <button
          onClick={() => setBewerken(true)}
          aria-label="Details bewerken"
          className="flex h-9 w-9 items-center justify-center rounded-full text-ink-zacht active:bg-terra-zacht"
        >
          <IconPencil className="h-4 w-4" />
        </button>
      </div>
      <p className="text-sm font-semibold text-ink">{thema.duurWeken} weken</p>
      {thema.invalshoeken ? (
        <p className="mt-2 text-sm text-ink-zacht">{thema.invalshoeken}</p>
      ) : (
        <p className="mt-2 text-sm text-ink-zwak">Nog geen invalshoeken beschreven.</p>
      )}
      {thema.kernwoordenschat.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {thema.kernwoordenschat.map((w) => (
            <span key={w} className="rounded-full bg-terra-zacht px-2 py-0.5 text-xs font-semibold text-terra-diep">
              {w}
            </span>
          ))}
        </div>
      )}
    </Card>
  );
}

function ThemaDetailsForm({
  thema,
  bezig,
  onAnnuleer,
  onOpslaan,
}: {
  thema: ThemaWeergave;
  bezig: boolean;
  onAnnuleer: () => void;
  onOpslaan: (waarden: { duurWeken: number; invalshoeken?: string; kernwoordenschat: string[] }) => void;
}) {
  const [duurWeken, setDuurWeken] = useState(thema.duurWeken);
  const [invalshoeken, setInvalshoeken] = useState(thema.invalshoeken ?? "");
  const [woordenschat, setWoordenschat] = useState(thema.kernwoordenschat.join(", "));

  return (
    <Card>
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-zwak">Details bewerken</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onOpslaan({
            duurWeken,
            invalshoeken: invalshoeken.trim() || undefined,
            kernwoordenschat: woordenschat
              .split(",")
              .map((w) => w.trim())
              .filter(Boolean),
          });
        }}
      >
        <Field label="Duur (in weken)">
          <TextInput
            type="number"
            min={1}
            max={20}
            value={duurWeken}
            onChange={(e) => setDuurWeken(Number(e.target.value))}
          />
        </Field>
        <Field label="Invalshoeken" hint="Waarover gaat dit thema precies? Helpt de AI bij het zoeken naar doelen.">
          <TextArea value={invalshoeken} onChange={(e) => setInvalshoeken(e.target.value)} />
        </Field>
        <Field label="Kernwoordenschat (kommagescheiden)">
          <TextInput value={woordenschat} onChange={(e) => setWoordenschat(e.target.value)} />
        </Field>
        <div className="flex gap-2">
          <Button type="button" variant="geest" onClick={onAnnuleer}>
            Annuleer
          </Button>
          <Button type="submit" className="flex-1" disabled={bezig}>
            {bezig ? "Bezig…" : "Opslaan"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
