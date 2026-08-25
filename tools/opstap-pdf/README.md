# Op.stap PDF → goal workbook

Katholiek Onderwijs Vlaanderen delivered the kleuter leerplandoelen as **PDF**, one file per
discipline, and the school cannot obtain them in any other format (owner, 2026-08-25). The backend
already imports the Op.stap **A–M Excel** layout, with a preview, a reviewable diff, idempotency on
`code` and a non-destructive re-import. This converts the PDFs to that layout, once, so none of that
has to be rebuilt and the product never learns a PDF was involved.

If Op.stap later ships a real Excel, delete this directory and upload the file directly. Nothing in
`backend/` or `frontend*/` depends on it.

## Run it

```sh
python -m venv .venv && .venv/Scripts/pip install pdfplumber openpyxl
.venv/Scripts/python opstap_pdf.py ../../assets ../../assets/opstap-xlsx
```

It prints, per discipline, the **discipline number to upload the file under** (the goal Excel has no
discipline column, so the importer takes it as context) plus the counts it is not silently swallowing.

Then, per file, in the app's inladen screen or against the API directly:

```sh
# review first: parses and diffs, writes nothing
curl -X POST http://127.0.0.1:5186/api/opstap-import/voorbeeld \
  -F "bestand=@'../../assets/opstap-xlsx/Wiskunde.xlsx'" -F "disciplineNummer=2"

# then commit
curl -X POST http://127.0.0.1:5186/api/opstap-import \
  -F "bestand=@'../../assets/opstap-xlsx/Wiskunde.xlsx'" -F "disciplineNummer=2"
```

## What it does and does not do

Structure comes from the **font sizes**, identically in all twelve files, because plain text
extraction loses the heading hierarchy and `Domein`/`Subdomein` are `NOT NULL`:

| size | meaning |
|------|---------|
| 18pt | discipline title (ignored; the caller states the discipline) |
| 14pt | domein |
| 12pt | subdomein |
| 11pt | cluster — absent in ICT and godsdienst, and nullable in the model |
| 10pt | fase line, goal code + text, toelichting, examples, page footer |

Measured over all twelve files: **2519 goals, none missing domein, subdomein, jaar/fase or tekst,
and no duplicate code.**

Left alone on purpose:

- **Goal text is verbatim**, including the `(MD)` marker eleven goals carry in their own sentence.
  Op.stap content is read-only reference data (Art. III.5); stripping it would be this tool editing
  the curriculum. The eleven codes are printed instead.
- **Columns B, C, D (LfMD, nrMD, MD) stay empty.** The PDFs carry no concordance: nothing maps a
  leerplandoel to a numbered minimumdoel. So the importer's `OntbrekendeMinimumdoelen` refusal cannot
  fire and these files import today — and minimumdoel-level coverage, the level the onderwijsinspectie
  tests, stays empty until that mapping exists (E1-12).
- **Column M (Woordenschat) stays empty.** Not in the PDFs.
- **Doelsoort `Z` (zwemmen) rows are written out** like any other. The domain enum has no `Z`, so the
  importer refuses those 28 rows by name and imports the other 457 of that file. That is the ruling
  (owner, 2026-08-25: leave Z alone), and dropping them here would let the import screen report a
  clean run for a file that quietly lost 28 goals.

## What is in the delivery, and what is not

Twelve of the thirteen disciplines. **Frans (10) is not coming** (owner, 2026-08-25). Kleuter only:
there is not one L1–L6 goal in any file.

Of the 2519 goals, 1288 carry a kleuterjaar (JK/K2/K3) and 1231 carry a fase instead (P/S routes
`Fase 1`–`Fase 6`, and the swimming routes). A klas measured on its own jaar/fase therefore does not
see that second group, which is the documented consequence of the owner's 2026-08-04 ruling and is
surfaced by `AantalBuitenBereik` and the whole-curriculum switch — not a conversion defect.
