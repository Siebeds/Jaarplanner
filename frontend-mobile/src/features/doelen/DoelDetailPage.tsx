import { useNavigate, useParams } from "react-router-dom";
import { DoelDetailInhoud } from "./DoelDetailInhoud";

export function DoelDetailPage() {
  const { code = "" } = useParams();
  const navigate = useNavigate();

  return (
    <div className="px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-4">
      <button
        onClick={() => navigate(-1)}
        className="mb-3 flex h-touch items-center gap-1 text-sm font-semibold text-terra"
      >
        ← Terug
      </button>
      <DoelDetailInhoud code={code} onNavigeerNaarDoel={(c) => navigate(`/doelen/${encodeURIComponent(c)}`)} />
    </div>
  );
}
