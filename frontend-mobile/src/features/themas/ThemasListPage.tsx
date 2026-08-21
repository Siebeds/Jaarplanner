import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { TopBar } from "../../components/TopBar";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Sheet } from "../../components/ui/Sheet";
import { Field, TextArea, TextInput } from "../../components/ui/Field";
import { Spinner } from "../../components/ui/Spinner";
import { EmptyState, FoutState } from "../../components/ui/EmptyState";
import { IconPlus } from "../../components/Icons";
import { useMaakThema, useThemas } from "../../lib/queries";

export function ThemasListPage() {
  const { data: themas, isLoading, isError } = useThemas();
  const [formOpen, setFormOpen] = useState(false);
  const navigate = useNavigate();
  const maakThema = useMaakThema();

  return (
    <div>
      <TopBar title="Thema's" />
      <div className="px-4 pb-4">
        <p className="mb-3 text-sm text-ink-zacht">
          De thema's van je school: schoolbreed van naam en kernleerdoelen, per klas onderverdeeld in subthema's.
        </p>

        {isLoading && <Spinner label="Thema's laden…" />}
        {isError && <FoutState titel="Kon thema's niet laden" beschrijving="Controleer of de backend draait." />}

        {themas && themas.length === 0 && (
          <EmptyState
            titel="Nog geen thema's"
            beschrijving="Maak je eerste thema, manueel of straks met AI-hulp voor de themadoelen."
            actie={
              <Button onClick={() => setFormOpen(true)}>
                <IconPlus className="h-4 w-4" /> Nieuw thema
              </Button>
            }
          />
        )}

        {themas && themas.length > 0 && (
          <>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {themas.map((thema) => (
                <li key={thema.id}>
                  <Link to={`/themas/${thema.id}`} className="block h-full">
                    <Card className="flex h-full flex-col justify-between gap-2 p-3 active:bg-terra-zacht">
                      <div>
                        <p className="font-bold leading-snug text-ink">{thema.naam}</p>
                        {thema.invalshoeken && (
                          <p className="mt-1 line-clamp-2 text-xs text-ink-zacht">{thema.invalshoeken}</p>
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-ink-zwak">
                          {thema.duurWeken} weken · {thema.subthemas.length} subthema
                          {thema.subthemas.length === 1 ? "" : "'s"}
                        </p>
                        {!thema.heeftVoldoendeThemadoelen && (
                          <span className="mt-1 inline-block rounded-full bg-suggestie-geweigerd/10 px-2 py-0.5 text-[10px] font-semibold text-suggestie-geweigerd">
                            nog themadoelen nodig
                          </span>
                        )}
                      </div>
                    </Card>
                  </Link>
                </li>
              ))}
              <li>
                <button onClick={() => setFormOpen(true)} className="block h-full w-full">
                  <Card className="flex h-full min-h-[92px] flex-col items-center justify-center gap-1 border-dashed border-terra/40 bg-terra-zacht/40 p-3 text-terra-diep active:bg-terra-zacht">
                    <IconPlus className="h-5 w-5" />
                    <span className="text-xs font-semibold">Nieuw thema</span>
                  </Card>
                </button>
              </li>
            </ul>
          </>
        )}
      </div>

      <Sheet open={formOpen} onClose={() => setFormOpen(false)} title="Nieuw thema">
        <ThemaForm
          bezig={maakThema.isPending}
          onOpslaan={(waarden) =>
            maakThema.mutate(waarden, {
              onSuccess: (thema) => {
                setFormOpen(false);
                navigate(`/themas/${thema.id}`);
              },
            })
          }
        />
      </Sheet>
    </div>
  );
}

function ThemaForm({
  bezig,
  onOpslaan,
}: {
  bezig: boolean;
  onOpslaan: (waarden: { naam: string; duurWeken: number; invalshoeken?: string; kernwoordenschat?: string[] }) => void;
}) {
  const [naam, setNaam] = useState("");
  const [duurWeken, setDuurWeken] = useState(5);
  const [invalshoeken, setInvalshoeken] = useState("");
  const [woordenschat, setWoordenschat] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!naam.trim()) return;
        onOpslaan({
          naam: naam.trim(),
          duurWeken,
          invalshoeken: invalshoeken.trim() || undefined,
          kernwoordenschat: woordenschat
            .split(",")
            .map((w) => w.trim())
            .filter(Boolean),
        });
      }}
    >
      <Field label="Naam van het thema">
        <TextInput value={naam} onChange={(e) => setNaam(e.target.value)} placeholder="bv. Water" required autoFocus />
      </Field>
      <Field label="Duur (in weken)">
        <TextInput
          type="number"
          min={1}
          max={20}
          value={duurWeken}
          onChange={(e) => setDuurWeken(Number(e.target.value))}
        />
      </Field>
      <Field label="Invalshoeken (optioneel)" hint="Waarover gaat dit thema precies? Helpt de AI straks bij het zoeken naar doelen.">
        <TextArea
          value={invalshoeken}
          onChange={(e) => setInvalshoeken(e.target.value)}
          placeholder="bv. water in de natuur, water thuis, drijven en zinken…"
        />
      </Field>
      <Field label="Kernwoordenschat (optioneel, kommagescheiden)">
        <TextInput
          value={woordenschat}
          onChange={(e) => setWoordenschat(e.target.value)}
          placeholder="druppel, golf, drijven, zinken"
        />
      </Field>
      <Button type="submit" className="w-full" disabled={bezig || !naam.trim()}>
        {bezig ? "Bezig…" : "Thema aanmaken"}
      </Button>
    </form>
  );
}
