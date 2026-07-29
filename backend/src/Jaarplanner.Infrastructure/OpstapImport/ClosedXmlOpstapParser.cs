using ClosedXML.Excel;
using Jaarplanner.Domain.Curriculum;

namespace Jaarplanner.Infrastructure.OpstapImport;

/// <summary>
/// ClosedXML implementation of <see cref="IOpstapParser"/> (Art. VIII — ClosedXML/MIT).
/// Reads the first worksheet of an Op.stap per-discipline goal Excel and maps each data
/// row to a <see cref="Leerplandoel"/>, addressing every cell through the single-source
/// <see cref="OpstapKolom"/> mapping (Art. III.3, VII.1).
/// <para>
/// Robustness rules (hidden/empty columns may occur — Art. VII.1):
/// <list type="bullet">
/// <item>Fully empty rows are skipped silently.</item>
/// <item>A leading row whose doelsoort cell is not a recognised code is treated as a
/// header and skipped; the same in the body is reported as a problem.</item>
/// <item>Empty/whitespace optional cells (cluster, voorbeelden, toelichting, woordenschat)
/// become <c>null</c>; the entity constructor also trims/normalises.</item>
/// <item>The concordance key (column D) is used when present; otherwise it is derived from
/// LfMD + nrMD (columns B + C) per Art. VII.1.</item>
/// <item>Rows missing a required field (code, jaar/fase, domein, subdomein, tekst) or
/// carrying an unknown doelsoort are <b>reported</b>, never silently dropped (ADR-0006 §4).</item>
/// </list>
/// </para>
/// </summary>
public sealed class ClosedXmlOpstapParser : IOpstapParser
{
    /// <inheritdoc />
    public OpstapParseResult Parse(Stream excelStroom, string disciplineNummer)
    {
        ArgumentNullException.ThrowIfNull(excelStroom);
        if (string.IsNullOrWhiteSpace(disciplineNummer))
        {
            throw new ArgumentException("'disciplineNummer' is required.", nameof(disciplineNummer));
        }

        var leerplandoelen = new List<Leerplandoel>();
        var problemen = new List<OpstapRijProbleem>();

        using var workbook = new XLWorkbook(excelStroom);
        var sheet = workbook.Worksheets.FirstOrDefault();
        if (sheet is null)
        {
            return new OpstapParseResult(disciplineNummer.Trim(), leerplandoelen, problemen);
        }

        var lastRow = sheet.LastRowUsed();
        if (lastRow is null)
        {
            return new OpstapParseResult(disciplineNummer.Trim(), leerplandoelen, problemen);
        }

        var firstNonEmptySeen = false;
        for (var rowNumber = 1; rowNumber <= lastRow.RowNumber(); rowNumber++)
        {
            var row = sheet.Row(rowNumber);

            if (IsRowEmpty(row))
            {
                continue;
            }

            // Header detection is structural, not "first unrecognised doelsoort": only the very
            // first non-empty row is a header candidate, and only when it actually carries the
            // Op.stap header labels (column A reads "Doelsoort"). This guarantees a malformed data
            // row — including the first one in a headerless file — is reported, never swallowed
            // (Art. V.6 / in the spirit of ADR-0006 §4, whose actual text is "validation produces clear, per-row diagnostics before commit").
            if (!firstNonEmptySeen)
            {
                firstNonEmptySeen = true;
                if (IsHeaderRow(row))
                {
                    continue;
                }
            }

            var doelsoortCode = Cell(row, OpstapKolom.Doelsoort);
            if (!DoelsoortCodes.TryFromCode(doelsoortCode, out var doelsoort))
            {
                problemen.Add(new OpstapRijProbleem(
                    rowNumber,
                    $"Unknown or missing doelsoort code '{doelsoortCode}'.",
                    Cell(row, OpstapKolom.Code)));
                continue;
            }

            try
            {
                leerplandoelen.Add(MapRow(row, doelsoort, disciplineNummer.Trim()));
            }
            catch (ArgumentException ex)
            {
                // Required field missing/invalid — surfaced via the entity constructor's guard.
                problemen.Add(new OpstapRijProbleem(rowNumber, ex.Message, Cell(row, OpstapKolom.Code)));
            }
        }

        return new OpstapParseResult(disciplineNummer.Trim(), leerplandoelen, problemen);
    }

    private static Leerplandoel MapRow(IXLRow row, Doelsoort doelsoort, string disciplineNummer) =>
        new(
            code: Cell(row, OpstapKolom.Code),
            doelsoort: doelsoort,
            jaarFase: Cell(row, OpstapKolom.JaarFase),
            domein: Cell(row, OpstapKolom.Domein),
            subdomein: Cell(row, OpstapKolom.Subdomein),
            disciplineNummer: disciplineNummer,
            cluster: Optional(row, OpstapKolom.Cluster),
            tekst: Cell(row, OpstapKolom.Tekst),
            voorbeelden: Optional(row, OpstapKolom.Voorbeelden),
            toelichting: Optional(row, OpstapKolom.Toelichting),
            woordenschat: Optional(row, OpstapKolom.Woordenschat),
            minimumdoelRef: ResolveMinimumdoelRef(row));

    /// <summary>
    /// The concordance key (column D) when present; otherwise derived from LfMD + nrMD
    /// (columns B + C) per Art. VII.1. Null when the row carries no minimumdoel concordance.
    /// </summary>
    private static string? ResolveMinimumdoelRef(IXLRow row)
    {
        var direct = Optional(row, OpstapKolom.MinimumdoelRef);
        if (direct is not null)
        {
            return direct;
        }

        var leeftijd = Optional(row, OpstapKolom.LeeftijdMinimumdoel);
        var nummer = Optional(row, OpstapKolom.NummerMinimumdoel);
        if (leeftijd is null && nummer is null)
        {
            return null;
        }

        // Concatenate the available parts (B+C); a partial key is preserved for diagnosis.
        return $"{leeftijd}{nummer}";
    }

    /// <summary>Reads a cell as trimmed text via the single-source <see cref="OpstapKolom"/> mapping.</summary>
    private static string Cell(IXLRow row, OpstapKolom kolom) =>
        row.Cell((int)kolom).GetString().Trim();

    /// <summary>Reads an optional cell; empty/whitespace becomes null.</summary>
    private static string? Optional(IXLRow row, OpstapKolom kolom)
    {
        var value = Cell(row, kolom);
        return string.IsNullOrWhiteSpace(value) ? null : value;
    }

    /// <summary>
    /// True when the row is the Op.stap column-header row: the doelsoort cell (column A) holds the
    /// literal label <c>"Doelsoort"</c> rather than a doelsoort code. Matched case-insensitively.
    /// </summary>
    private static bool IsHeaderRow(IXLRow row) =>
        string.Equals(Cell(row, OpstapKolom.Doelsoort), "Doelsoort", StringComparison.OrdinalIgnoreCase);

    /// <summary>True when no mapped A–M cell on the row carries content.</summary>
    private static bool IsRowEmpty(IXLRow row)
    {
        foreach (OpstapKolom kolom in Enum.GetValues<OpstapKolom>())
        {
            if (!string.IsNullOrWhiteSpace(Cell(row, kolom)))
            {
                return false;
            }
        }

        return true;
    }
}
