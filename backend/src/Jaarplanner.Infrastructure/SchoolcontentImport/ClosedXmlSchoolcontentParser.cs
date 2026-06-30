using ClosedXML.Excel;
using Jaarplanner.Domain.Schoolcontent;

namespace Jaarplanner.Infrastructure.SchoolcontentImport;

/// <summary>
/// ClosedXML implementation of <see cref="ISchoolcontentParser"/> (Art. VIII — ClosedXML/MIT, no
/// EPPlus). Reads the first worksheet of a school-content import Excel, validates the header and
/// each data row, and maps every well-formed row to a <see cref="SchoolcontentRij"/>, addressing
/// every cell through the single-source <see cref="SchoolcontentKolom"/> mapping (Art. III.3).
/// <para>
/// Validation rules (FR-1.1/1.2):
/// <list type="bullet">
/// <item>The <b>first non-empty row is the header</b>. Every required column (<see
/// cref="SchoolcontentKolommen.Verplicht"/>) must be present there; a missing required header
/// column is a file-level problem and no data rows are processed (the layout is unsafe to read).</item>
/// <item>Fully empty data rows are skipped silently.</item>
/// <item>Each required field must be non-empty on the row; <c>duurWeken</c> must be a positive
/// integer; the activiteit type must map to an <see cref="ActiviteitType"/>. Every violation is
/// <b>reported</b> per row with a clear Dutch message — the row is excluded, never silently dropped
/// (ADR-0006 §4 / Art. V.6). Multiple problems on one row are each reported.</item>
/// <item>Optional list columns (woordenschat, themadoelen, subdoelen) are split on ';'; empty
/// entries are dropped; an absent column yields an empty list.</item>
/// </list>
/// </para>
/// </summary>
public sealed class ClosedXmlSchoolcontentParser : ISchoolcontentParser
{
    private const char LijstScheider = ';';

    /// <inheritdoc />
    public SchoolcontentParseResult Parse(Stream excelStroom)
    {
        ArgumentNullException.ThrowIfNull(excelStroom);

        var rijen = new List<SchoolcontentRij>();
        var problemen = new List<SchoolcontentRijProbleem>();

        using var workbook = new XLWorkbook(excelStroom);
        var sheet = workbook.Worksheets.FirstOrDefault();
        var lastRow = sheet?.LastRowUsed();
        if (sheet is null || lastRow is null)
        {
            problemen.Add(new SchoolcontentRijProbleem(
                0, "Het bestand bevat geen werkblad met gegevens."));
            return new SchoolcontentParseResult(rijen, problemen);
        }

        // The first non-empty row is the header; locate it.
        var headerRowNumber = EersteNietLegeRij(sheet, lastRow.RowNumber());
        if (headerRowNumber is null)
        {
            problemen.Add(new SchoolcontentRijProbleem(
                0, "Het bestand bevat geen koprij; voeg een koprij met de kolomtitels toe."));
            return new SchoolcontentParseResult(rijen, problemen);
        }

        // Validate that every required header column is present. A missing required column makes
        // the layout unsafe to interpret by position, so we report and stop (file-level problem).
        var ontbrekend = OntbrekendeVerplichteKolommen(sheet.Row(headerRowNumber.Value));
        if (ontbrekend.Count > 0)
        {
            var labels = string.Join(", ", ontbrekend.Select(SchoolcontentKolommen.Label));
            problemen.Add(new SchoolcontentRijProbleem(
                headerRowNumber.Value,
                $"Verplichte kolom(men) ontbreken in de koprij: {labels}."));
            return new SchoolcontentParseResult(rijen, problemen);
        }

        for (var rowNumber = headerRowNumber.Value + 1; rowNumber <= lastRow.RowNumber(); rowNumber++)
        {
            var row = sheet.Row(rowNumber);
            if (IsRowEmpty(row))
            {
                continue;
            }

            ValideerEnVoegToe(row, rowNumber, rijen, problemen);
        }

        return new SchoolcontentParseResult(rijen, problemen);
    }

    private static void ValideerEnVoegToe(
        IXLRow row,
        int rowNumber,
        List<SchoolcontentRij> rijen,
        List<SchoolcontentRijProbleem> problemen)
    {
        var rijProblemen = new List<SchoolcontentRijProbleem>();

        var themaNaam = Verplicht(row, rowNumber, SchoolcontentKolom.ThemaNaam, rijProblemen);
        var themaDuur = VerplichtPositiefGetal(row, rowNumber, SchoolcontentKolom.ThemaDuurWeken, rijProblemen);
        var subthemaNaam = Verplicht(row, rowNumber, SchoolcontentKolom.SubthemaNaam, rijProblemen);
        var subthemaDuur = VerplichtPositiefGetal(row, rowNumber, SchoolcontentKolom.SubthemaDuurWeken, rijProblemen);
        var klas = Verplicht(row, rowNumber, SchoolcontentKolom.SubthemaKlas, rijProblemen);
        var leeftijd = Verplicht(row, rowNumber, SchoolcontentKolom.SubthemaLeeftijd, rijProblemen);
        var activiteitNaam = Verplicht(row, rowNumber, SchoolcontentKolom.ActiviteitNaam, rijProblemen);
        var activiteitType = VerplichtActiviteitType(row, rowNumber, rijProblemen);

        if (rijProblemen.Count > 0)
        {
            // Report every problem found on the row, but exclude the row from the parsed output.
            problemen.AddRange(rijProblemen);
            return;
        }

        rijen.Add(new SchoolcontentRij
        {
            RijNummer = rowNumber,
            ThemaNaam = themaNaam!,
            ThemaDuurWeken = themaDuur!.Value,
            ThemaInvalshoeken = Optional(row, SchoolcontentKolom.ThemaInvalshoeken),
            Kernwoordenschat = Lijst(row, SchoolcontentKolom.ThemaKernwoordenschat),
            RijkeWoordenschat = Lijst(row, SchoolcontentKolom.ThemaRijkeWoordenschat),
            Themadoelen = Lijst(row, SchoolcontentKolom.Themadoelen),
            SubthemaNaam = subthemaNaam!,
            SubthemaDuurWeken = subthemaDuur!.Value,
            SubthemaKlas = klas!,
            SubthemaLeeftijd = leeftijd!,
            SubthemaProbleemstelling = Optional(row, SchoolcontentKolom.SubthemaProbleemstelling),
            SubthemaOnderzoeksvraag = Optional(row, SchoolcontentKolom.SubthemaOnderzoeksvraag),
            Subdoelen = Lijst(row, SchoolcontentKolom.Subdoelen),
            ActiviteitNaam = activiteitNaam!,
            ActiviteitType = activiteitType!.Value,
            ActiviteitHoek = Optional(row, SchoolcontentKolom.ActiviteitHoek),
            ActiviteitVerwachteUitkomsten = Optional(row, SchoolcontentKolom.ActiviteitVerwachteUitkomsten),
        });
    }

    /// <summary>Reads a required text field; reports a Dutch problem and returns null when missing.</summary>
    private static string? Verplicht(
        IXLRow row,
        int rowNumber,
        SchoolcontentKolom kolom,
        List<SchoolcontentRijProbleem> problemen)
    {
        var value = Cell(row, kolom);
        if (!string.IsNullOrWhiteSpace(value))
        {
            return value;
        }

        problemen.Add(new SchoolcontentRijProbleem(
            rowNumber,
            $"Verplicht veld '{SchoolcontentKolommen.Label(kolom)}' ontbreekt.",
            kolom));
        return null;
    }

    /// <summary>Reads a required positive-integer field; reports a Dutch problem and returns null on failure.</summary>
    private static int? VerplichtPositiefGetal(
        IXLRow row,
        int rowNumber,
        SchoolcontentKolom kolom,
        List<SchoolcontentRijProbleem> problemen)
    {
        var value = Cell(row, kolom);
        if (string.IsNullOrWhiteSpace(value))
        {
            problemen.Add(new SchoolcontentRijProbleem(
                rowNumber,
                $"Verplicht veld '{SchoolcontentKolommen.Label(kolom)}' ontbreekt.",
                kolom));
            return null;
        }

        if (int.TryParse(value, out var getal) && getal > 0)
        {
            return getal;
        }

        problemen.Add(new SchoolcontentRijProbleem(
            rowNumber,
            $"'{SchoolcontentKolommen.Label(kolom)}' moet een positief geheel getal zijn (gevonden: '{value}').",
            kolom));
        return null;
    }

    /// <summary>Reads and resolves the required activiteit type; reports a Dutch problem on failure.</summary>
    private static ActiviteitType? VerplichtActiviteitType(
        IXLRow row,
        int rowNumber,
        List<SchoolcontentRijProbleem> problemen)
    {
        var value = Cell(row, SchoolcontentKolom.ActiviteitType);
        if (string.IsNullOrWhiteSpace(value))
        {
            problemen.Add(new SchoolcontentRijProbleem(
                rowNumber,
                $"Verplicht veld '{SchoolcontentKolommen.Label(SchoolcontentKolom.ActiviteitType)}' ontbreekt.",
                SchoolcontentKolom.ActiviteitType));
            return null;
        }

        if (ActiviteitTypeCode.TryFromCode(value, out var type))
        {
            return type;
        }

        problemen.Add(new SchoolcontentRijProbleem(
            rowNumber,
            $"Onbekend activiteittype '{value}'.",
            SchoolcontentKolom.ActiviteitType));
        return null;
    }

    /// <summary>The required header columns absent from the given header row.</summary>
    private static IReadOnlyList<SchoolcontentKolom> OntbrekendeVerplichteKolommen(IXLRow headerRow)
    {
        var aanwezig = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (SchoolcontentKolom kolom in Enum.GetValues<SchoolcontentKolom>())
        {
            var label = Cell(headerRow, kolom);
            if (!string.IsNullOrWhiteSpace(label))
            {
                aanwezig.Add(label);
            }
        }

        return SchoolcontentKolommen.Verplicht
            .Where(k => !aanwezig.Contains(SchoolcontentKolommen.Label(k)))
            .ToList();
    }

    /// <summary>The number of the first non-empty row (the header), or null when the sheet is empty.</summary>
    private static int? EersteNietLegeRij(IXLWorksheet sheet, int lastRowNumber)
    {
        for (var rowNumber = 1; rowNumber <= lastRowNumber; rowNumber++)
        {
            if (!IsRowEmpty(sheet.Row(rowNumber)))
            {
                return rowNumber;
            }
        }

        return null;
    }

    /// <summary>Reads a cell as trimmed text via the single-source <see cref="SchoolcontentKolom"/> mapping.</summary>
    private static string Cell(IXLRow row, SchoolcontentKolom kolom) =>
        row.Cell((int)kolom).GetString().Trim();

    /// <summary>Reads an optional cell; empty/whitespace becomes null.</summary>
    private static string? Optional(IXLRow row, SchoolcontentKolom kolom)
    {
        var value = Cell(row, kolom);
        return string.IsNullOrWhiteSpace(value) ? null : value;
    }

    /// <summary>Reads a ';'-separated list cell; empty entries dropped; absent column yields an empty list.</summary>
    private static IReadOnlyList<string> Lijst(IXLRow row, SchoolcontentKolom kolom) =>
        Cell(row, kolom)
            .Split(LijstScheider, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .ToList();

    /// <summary>True when no mapped column on the row carries content.</summary>
    private static bool IsRowEmpty(IXLRow row)
    {
        foreach (SchoolcontentKolom kolom in Enum.GetValues<SchoolcontentKolom>())
        {
            if (!string.IsNullOrWhiteSpace(Cell(row, kolom)))
            {
                return false;
            }
        }

        return true;
    }
}
