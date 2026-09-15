import { ApiError } from "../../lib/api";
import { geenToegangZin } from "../../lib/rechten";
import { t, type Vertaalsleutel } from "../../i18n";

/** A refusal in the server's own Dutch where it gave one, else the catalogue's sentence for this action. */
export function foutzin(fout: unknown, anders: Vertaalsleutel): string {
  return geenToegangZin(fout) ?? (fout instanceof ApiError && fout.detail ? fout.detail : t(anders));
}
