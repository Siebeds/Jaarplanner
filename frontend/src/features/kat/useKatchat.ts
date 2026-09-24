import { useRef, useState } from "react";
import { t } from "../../i18n";
import { ApiError } from "../../lib/api";
import { useActieveSelectie } from "../../lib/selectie";
import {
  MAX_BEURTEN,
  useVraagChuck,
  useZoekOpnieuw,
  type Katantwoord,
  type Katbeurt,
  type Katkandidaat,
  type Katopzoeking,
} from "./chat";

/**
 * The state of the cat's chat (FB-031): the turns of this conversation, and asking. It lives in the open window only:
 * closing the window unmounts it, and nothing is kept anywhere (ADR-0059 D6). A question carries the last sealed turns
 * of the conversation, so Chuck understands a follow-up (FB-093); when the server no longer recognises them, the
 * conversation starts again from the next question.
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
  // The first turn of the conversation that still goes along; a turn the server refused starts it again after it.
  const begin = useRef(1);

  const voegToe = (vraag: string, verzoek: () => Promise<Katantwoord>) => {
    const id = volgende.current++;
    setBeurten((b) => [...b, { id, vraag }]);
    verzoek()
      .then((antwoord) => setBeurten((b) => b.map((x) => (x.id === id ? { ...x, antwoord } : x))))
      .catch((fout: unknown) => {
        if (fout instanceof ApiError && fout.status === 409) begin.current = id + 1;
        setBeurten((b) => b.map((x) => (x.id === id ? { ...x, fout: foutzin(fout) } : x)));
      });
  };

  // The sealed turns since the conversation began, at most the last MAX_BEURTEN, oldest first.
  const gesprek = (): Katbeurt[] =>
    beurten
      .filter((b) => b.id >= begin.current)
      .flatMap((b) => (b.antwoord?.beurt ? [b.antwoord.beurt] : []))
      .slice(-MAX_BEURTEN);

  return {
    beurten,
    bezig: vraagChuck.isPending || zoekOpnieuw.isPending,
    vraag: (tekst) => {
      const mee = gesprek();
      voegToe(tekst, () => vraagChuck.mutateAsync({ vraag: tekst, schooljaarId, gesprek: mee }));
    },
    kies: (opzoeking, kandidaat, wat) =>
      voegToe(kandidaat.label, () =>
        zoekOpnieuw.mutateAsync({ opzoeking: { ...opzoeking, [wat]: kandidaat.id }, schooljaarId, vraag: kandidaat.label }),
      ),
  };
}

// A cut-off answer (502) carries a Dutch sentence she can act on; a conversation the server no longer recognises (409)
// starts again; anything else gets the plain one.
function foutzin(fout: unknown): string {
  if (fout instanceof ApiError && fout.status === 409) return t("kat.chat.draadKwijt");
  return fout instanceof ApiError && fout.status === 502 && fout.detail ? fout.detail : t("kat.chat.fout");
}
