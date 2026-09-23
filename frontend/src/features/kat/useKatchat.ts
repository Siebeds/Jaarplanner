import { useRef, useState } from "react";
import { t } from "../../i18n";
import { ApiError } from "../../lib/api";
import { useActieveSelectie } from "../../lib/selectie";
import { useVraagChuck, useZoekOpnieuw, type Katantwoord, type Katkandidaat, type Katopzoeking } from "./chat";

/**
 * The state of the cat's chat (FB-031): the turns of this conversation, and asking. It lives in the open window only:
 * closing the window unmounts it, and nothing is kept anywhere (ADR-0059 D6).
 */

export interface Beurt {
  id: number;
  /** What she typed, or the candidate she picked. */
  vraag: string;
  antwoord?: Katantwoord;
  fout?: string;
}

export interface Katchat {
  beurten: Beurt[];
  bezig: boolean;
  vraag: (tekst: string) => void;
  kies: (opzoeking: Katopzoeking, kandidaat: Katkandidaat, wat: keyof Katopzoeking) => void;
}

/** The conversation's state, kept by the window so the field and the conversation can sit in different places. */
export function useKatchat(): Katchat {
  const { schooljaarId } = useActieveSelectie();
  const vraagChuck = useVraagChuck();
  const zoekOpnieuw = useZoekOpnieuw();
  const [beurten, setBeurten] = useState<Beurt[]>([]);
  const volgende = useRef(1);

  const voegToe = (vraag: string, verzoek: Promise<Katantwoord>) => {
    const id = volgende.current++;
    setBeurten((b) => [...b, { id, vraag }]);
    verzoek
      .then((antwoord) => setBeurten((b) => b.map((x) => (x.id === id ? { ...x, antwoord } : x))))
      .catch((fout: unknown) => setBeurten((b) => b.map((x) => (x.id === id ? { ...x, fout: foutzin(fout) } : x))));
  };

  return {
    beurten,
    bezig: vraagChuck.isPending || zoekOpnieuw.isPending,
    vraag: (tekst) => voegToe(tekst, vraagChuck.mutateAsync({ vraag: tekst, schooljaarId })),
    kies: (opzoeking, kandidaat, wat) =>
      voegToe(kandidaat.label, zoekOpnieuw.mutateAsync({ opzoeking: { ...opzoeking, [wat]: kandidaat.id }, schooljaarId })),
  };
}

// A cut-off answer (502) carries a Dutch sentence she can act on; anything else gets the plain one.
function foutzin(fout: unknown): string {
  return fout instanceof ApiError && fout.status === 502 && fout.detail ? fout.detail : t("kat.chat.fout");
}
