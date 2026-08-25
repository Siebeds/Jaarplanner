"""
Op.stap goal PDFs -> the A-M goal workbook the existing importer already parses.

WHY THIS IS A CONVERTER AND NOT AN IMPORTER. Katholiek Onderwijs Vlaanderen delivered the kleuter
leerplandoelen as PDF, one per discipline, and the school cannot get them in any other format
(owner, 2026-08-25). The backend already has an Op.stap importer for the A-M Excel layout, with a
preview, a reviewable diff, idempotency on `code` and a non-destructive re-import. Teaching it to
read PDF would duplicate all of that against a delivery format that may be replaced by a real Excel
next release. So this converts, once, to the format that already goes in, and the product never
learns that a PDF was involved.

HOW THE STRUCTURE IS RECOVERED. Plain text extraction loses the heading hierarchy, and `Domein` and
`Subdomein` are NOT NULL. The font sizes carry it, identically in all twelve files:

    18pt  the discipline title            -> ignored, the caller states the discipline
    14pt  domein
    12pt  subdomein
    11pt  cluster                         -> absent in ICT and godsdienst; nullable in the model
    10pt  everything else: the fase line, the goal code + text, toelichting, examples, footer

Within the 10pt body, a line is a goal when it starts with an Op.stap code
(`4.1.GK2.1`, and `9-2.1.PF1.1` for the 9.x disciplines, which write the dot as a hyphen). The
remaining lines belong to the goal above them: the sentence continues until it terminates, then the
prose is toelichting, and a `Voorbeeld(en):` label or a bullet switches to examples.

WHAT IS DELIBERATELY LEFT ALONE:

- The goal text is copied VERBATIM, including the `(MD)` marker that eleven goals carry. Op.stap
  content is read-only reference data (Art. III.5) and that marker is in the official sentence as
  delivered; stripping it would be this tool editing the curriculum. It is reported instead, so the
  eleven can be re-flagged when a real concordance arrives.
- Columns B, C, D (LfMD, nrMD, MD) stay empty. The PDFs carry NO concordance: nothing maps a
  leerplandoel to a numbered minimumdoel. The importer's `OntbrekendeMinimumdoelen` refusal
  therefore cannot fire, and minimumdoel-level coverage stays empty until that mapping exists
  (E1-12).
- Column M (Woordenschat) stays empty. The PDFs do not carry it.
- Doelsoort `Z` (zwemmen: Watergewenners/Overlevers/Zwemmers) rows are written out like any other.
  The domain enum has no `Z`, so the importer refuses those 28 rows by name and imports the rest.
  That is on purpose (owner ruling, 2026-08-25: leave Z alone): dropping them here would make the
  import screen report a clean run for a file that silently lost 28 goals.

USAGE
    pip install pdfplumber openpyxl
    python opstap_pdf.py <map-met-pdfs> <uitvoermap>

It prints one line per discipline with the discipline number to upload the file under, because the
goal Excel has no discipline column and the importer takes it as context.
"""
import collections
import glob
import os
import re
import sys

import pdfplumber
from openpyxl import Workbook

CODE = re.compile(r'^(\d[\d\-.]*)\.([A-Z+]{1,2}[A-Z0-9]*)\.(\d+)\s*(.*)$')

# The three kleuter years normalise to the ruled canonical form (owner, 2026-08-03).
FASE = {"jongste kleuter": "JK", "2de kleuter": "K2", "3de kleuter": "K3"}

# The P/S/Z routes carry a fase rather than a kleuterjaar. `Leerplandoel.JaarFase` is a free string
# and Art. VII.1 column F allows exactly this ("or a fase for P/S"), so they pass through unchanged.
# A klas measured on its own jaar/fase does not see them, which the dekking screen already surfaces
# as `AantalBuitenBereik`.
FASE_VRIJ = {"Fase 1", "Fase 2", "Fase 3", "Fase 4", "Fase 5", "Fase 6",
             "Watergewenners", "Overlevers", "Zwemmers"}

VOORBEELDKOP = {"Voorbeeld(en):", "Voorbeelden", "Voorbeelden:", "Voorbeeld(en)"}
VOORBEELD_INLINE = re.compile(r'^Voorbeeld(?:\(en\)|en)\s*:\s*(.+)$')
FOOTER = re.compile(r'^(Leerplanversie|\d{2}/\d{2}/\d{4}|p\.\s*\d+\s*/\s*\d+)')
LEGENDE = re.compile(r'^[A-Z+]\s+Routedoelen:')
BULLET = re.compile(r'^[•\-▪·]\s*')

KOPPEN = ["Doelsoort", "LfMD", "nrMD", "MD", "Code", "Jaar/fase", "Domein", "Subdomein",
          "Cluster", "Leerplandoel", "Voorbeelden", "Toelichting", "Woordenschat"]


def regels(pdf):
    """Every non-empty line as (font size, left edge, text), top to bottom, page by page."""
    for pagina in pdf.pages:
        per_top = collections.defaultdict(list)
        for teken in pagina.chars:
            per_top[round(teken["top"])].append(teken)
        for top in sorted(per_top):
            tekens = sorted(per_top[top], key=lambda c: c["x0"])
            tekst = "".join(c["text"] for c in tekens).strip()
            if tekst:
                yield max(round(c["size"], 1) for c in tekens), round(min(c["x0"] for c in tekens)), tekst


def lees(pad):
    """The goals of one discipline PDF, in file order."""
    doelen, domein, subdomein, cluster, fase = [], None, None, None, None
    huidig, modus = None, None

    def sluit():
        nonlocal huidig
        if huidig:
            doelen.append(huidig)
            huidig = None

    with pdfplumber.open(pad) as pdf:
        for maat, _x0, tekst in regels(pdf):
            # A heading at any level ends the goal above it and resets everything finer than itself.
            if maat >= 17:
                continue
            if maat >= 13.5:
                sluit()
                domein, subdomein, cluster, fase = tekst, None, None, None
                continue
            if maat >= 11.5:
                sluit()
                subdomein, cluster, fase = tekst, None, None
                continue
            if maat >= 10.5:
                sluit()
                cluster, fase = tekst, None
                continue

            if FOOTER.match(tekst) or LEGENDE.match(tekst):
                continue
            if tekst in FASE or tekst in FASE_VRIJ:
                sluit()
                fase = FASE.get(tekst, tekst)
                modus = None
                continue

            gevonden = CODE.match(tekst)
            if gevonden:
                sluit()
                huidig = {
                    "code": f"{gevonden.group(1)}.{gevonden.group(2)}.{gevonden.group(3)}",
                    "doelsoort": gevonden.group(2)[:1],
                    "jaarfase": fase,
                    "domein": domein,
                    "subdomein": subdomein,
                    "cluster": cluster,
                    "tekst": gevonden.group(4).strip(),
                    "toelichting": [],
                    "voorbeelden": [],
                }
                modus = "tekst"
                continue

            if huidig is None:
                continue
            if tekst in VOORBEELDKOP:
                modus = "voorbeeld"
                continue
            inline = VOORBEELD_INLINE.match(tekst)
            if inline:
                huidig["voorbeelden"].append(inline.group(1))
                modus = "voorbeeld"
                continue
            if BULLET.match(tekst):
                huidig["voorbeelden"].append(BULLET.sub("", tekst))
                modus = "voorbeeld"
                continue
            if modus == "voorbeeld" and huidig["voorbeelden"]:
                huidig["voorbeelden"][-1] += " " + tekst
                continue
            # The goal sentence wraps until it terminates; after that the prose is toelichting.
            if modus == "tekst" and not huidig["tekst"].rstrip().endswith((".", ";", ":", "?", "!")):
                huidig["tekst"] += " " + tekst
                continue
            modus = "toelichting"
            huidig["toelichting"].append(tekst)
        sluit()

    for doel in doelen:
        doel["toelichting"] = " ".join(doel["toelichting"]).strip() or None
        doel["voorbeelden"] = "\n".join(doel["voorbeelden"]).strip() or None
    return doelen


def disciplinenummer(doelen):
    """
    The discipline the file belongs to, read from its own codes rather than from the filename.

    `9-2.1.PF1.1` means discipline 9.2: the 9.x disciplines write the dot as a hyphen inside a code
    where a dot is already the separator. Derived from the data because a filename is renameable and
    the importer refuses a file uploaded under the wrong number.
    """
    prefixen = {d["code"].split(".")[0] for d in doelen}
    if len(prefixen) != 1:
        return None
    return prefixen.pop().replace("-", ".")


def schrijf(doelen, uit):
    werkboek = Workbook()
    blad = werkboek.active
    blad.title = "Leerplandoelen"
    blad.append(KOPPEN)
    for doel in doelen:
        blad.append([
            doel["doelsoort"], None, None, None,
            doel["code"], doel["jaarfase"], doel["domein"], doel["subdomein"], doel["cluster"],
            doel["tekst"], doel["voorbeelden"], doel["toelichting"], None,
        ])
    werkboek.save(uit)


def main(bronmap, doelmap):
    os.makedirs(doelmap, exist_ok=True)
    paden = sorted(glob.glob(os.path.join(bronmap, "Op.stap - *.pdf")))
    if not paden:
        print(f"Geen 'Op.stap - *.pdf' gevonden in {bronmap}", file=sys.stderr)
        return 1

    totaal, zwem, md_gemarkeerd, codes = 0, [], [], collections.Counter()
    print(f"{'discipline':38} {'nr':>5} {'doelen':>7} {'Z':>4}  bestand")
    for pad in paden:
        doelen = lees(pad)
        naam = os.path.basename(pad).replace("Op.stap - ", "").rsplit(" - ", 1)[0]
        nummer = disciplinenummer(doelen)
        z = [d for d in doelen if d["doelsoort"] == "Z"]
        md_gemarkeerd += [d["code"] for d in doelen if "(MD)" in d["tekst"]]
        for d in doelen:
            codes[d["code"]] += 1
        uit = os.path.join(doelmap, f"{naam}.xlsx")
        schrijf(doelen, uit)
        totaal += len(doelen)
        if z:
            zwem.append((naam, len(z)))
        print(f"{naam:38} {nummer or '?':>5} {len(doelen):7} {len(z):4}  {os.path.basename(uit)}")

    print(f"\n{totaal} doelen in {len(paden)} bestanden.")

    dubbel = [c for c, n in codes.items() if n > 1]
    print(f"dubbele codes: {len(dubbel)}" + (f" -> {dubbel[:10]}" if dubbel else ""))

    # Said out loud rather than left to the import log: these rows are written to the workbook and
    # the importer will refuse them one by one, so the count has to be visible here too.
    if zwem:
        print("\nDoelsoort Z (zwemmen) wordt door de importer geweigerd, per ruling behouden in het bestand:")
        for naam, n in zwem:
            print(f"  {naam}: {n}")

    if md_gemarkeerd:
        print(f"\n{len(md_gemarkeerd)} doelen dragen de markering '(MD)' in hun eigen tekst, verbatim overgenomen.")
        print("  Ze zeggen dat het doel decretaal is, maar noemen geen eindtermnummer, dus ze kunnen")
        print("  de concordantie niet vervangen. Codes:")
        for code in md_gemarkeerd:
            print(f"    {code}")
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(2)
    sys.exit(main(sys.argv[1], sys.argv[2]))
