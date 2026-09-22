import { useIk } from "../../lib/aanmelding";
import { useDekkingsvoortgang } from "../../lib/queries";
import { useActieveSelectie } from "../../lib/selectie";
import { useDeurmat, useKatinstelling } from "./gegevens";
import { bepaalHouding, type Houding } from "./houding";
import { useKatplek } from "./katplek";

/**
 * Whether Chuck is drawn at all: the school turned him on, and someone is signed in. Asks for nothing else, so a
 * school that keeps him off pays one small request per session and no more.
 */
export function useChuckZichtbaar(): boolean {
  const { data: ik } = useIk();
  const instelling = useKatinstelling();
  return Boolean(ik) && instelling.data?.isZichtbaar === true;
}

export type Chuck = {
  houding: Houding;
  /** The klas on screen, which a purr is about. */
  klasnaam: string | null;
  /** He knows what he brought: the deurmat loaded. Until then, and after a failed load, his posture asserts nothing. */
  weet: boolean;
  /** He lies on the corner of the week strip, and his basket is empty. */
  opDeHoek: boolean;
  deurmat: ReturnType<typeof useDeurmat>;
};

/**
 * Everything Chuck's posture is made of, in one place, so the basket and the corner of the week strip can never
 * disagree about where he is (FB-071). His posture is read from the deurmat and the dekking, never kept as state.
 * Call it only where he is drawn.
 */
export function useChuck(): Chuck {
  const deurmat = useDeurmat(true);
  const { klasId, klas } = useActieveSelectie();
  const { data: voortgang } = useDekkingsvoortgang(klasId, "EigenJaarFase");
  const hoekKlasId = useKatplek((s) => s.hoekKlasId);

  const houding = bepaalHouding(deurmat.data, voortgang, hoekKlasId ?? klasId);
  const opDeHoek = houding.soort === "gevaar" && hoekKlasId !== null && houding.gevaar?.klasId === hoekKlasId;
  return { houding, opDeHoek, deurmat, klasnaam: klas?.naam ?? null, weet: deurmat.isSuccess };
}
