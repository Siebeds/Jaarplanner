import { useNavigate, useParams } from "react-router-dom";
import { Spinner } from "../../components/ui/Spinner";
import { FoutState } from "../../components/ui/EmptyState";
import { useThema } from "../../lib/queries";
import { ThemaDetailsSectie } from "./ThemaDetailsSectie";
import { ThemadoelenPanel } from "./ThemadoelenPanel";
import { KlasinplanningSectie } from "./KlasinplanningSectie";

export function ThemaDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { data: thema, isLoading, isError } = useThema(id);

  return (
    <div className="px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-6">
      <button
        onClick={() => navigate("/themas")}
        className="mb-3 flex h-touch items-center gap-1 text-sm font-semibold text-terra"
      >
        ← Alle thema's
      </button>

      {isLoading && <Spinner label="Thema laden…" />}
      {isError && <FoutState titel="Thema niet gevonden" />}

      {thema && (
        <>
          <h1 className="mb-3 text-xl font-extrabold text-ink">{thema.naam}</h1>

          <div className="flex flex-col gap-4">
            <ThemaDetailsSectie thema={thema} />

            <ThemadoelenPanel thema={thema} />

            <KlasinplanningSectie thema={thema} />
          </div>
        </>
      )}
    </div>
  );
}
