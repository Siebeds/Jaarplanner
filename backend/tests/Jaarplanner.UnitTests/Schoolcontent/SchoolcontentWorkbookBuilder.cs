using ClosedXML.Excel;
using Jaarplanner.Infrastructure.SchoolcontentImport;

namespace Jaarplanner.UnitTests.Schoolcontent;

/// <summary>
/// Builds small, in-memory school-content import workbooks (.xlsx) for the parser tests. Columns
/// are written through the single-source <see cref="SchoolcontentKolom"/> mapping (and header
/// labels via <see cref="SchoolcontentKolommen"/>) so a fixture row and the parser stay in lock-step
/// with the layout — there is no second column map in tests. Mirrors the Op.stap
/// <c>OpstapWorkbookBuilder</c>.
/// </summary>
internal sealed class SchoolcontentWorkbookBuilder
{
    private readonly List<Action<IXLWorksheet, int>> _rows = [];

    /// <summary>Adds the standard header row from the single-source column labels.</summary>
    public SchoolcontentWorkbookBuilder MetHeader()
    {
        _rows.Add((sheet, r) =>
        {
            foreach (SchoolcontentKolom kolom in Enum.GetValues<SchoolcontentKolom>())
            {
                sheet.Cell(r, (int)kolom).Value = SchoolcontentKolommen.Label(kolom);
            }
        });
        return this;
    }

    /// <summary>Adds a header row that omits the given required columns (to test missing-header detection).</summary>
    public SchoolcontentWorkbookBuilder MetHeaderZonder(params SchoolcontentKolom[] weggelaten)
    {
        var skip = weggelaten.ToHashSet();
        _rows.Add((sheet, r) =>
        {
            foreach (SchoolcontentKolom kolom in Enum.GetValues<SchoolcontentKolom>())
            {
                if (!skip.Contains(kolom))
                {
                    sheet.Cell(r, (int)kolom).Value = SchoolcontentKolommen.Label(kolom);
                }
            }
        });
        return this;
    }

    /// <summary>Adds a fully blank row.</summary>
    public SchoolcontentWorkbookBuilder MetLegeRij()
    {
        _rows.Add((_, _) => { });
        return this;
    }

    /// <summary>Adds a data row from explicit per-column values (null leaves the cell empty).</summary>
    public SchoolcontentWorkbookBuilder MetRij(
        string? themaNaam = "Herfst",
        string? themaDuurWeken = "5",
        string? invalshoeken = null,
        string? kernwoordenschat = null,
        string? rijkeWoordenschat = null,
        string? themadoelen = null,
        string? subthemaNaam = "Bladeren",
        string? subthemaDuurWeken = "2",
        string? klas = "K3",
        string? leeftijd = "5-6",
        string? probleemstelling = null,
        string? onderzoeksvraag = null,
        string? subdoelen = null,
        string? activiteitNaam = "Bladeren zoeken",
        string? activiteitType = "uitstap",
        string? hoek = null,
        string? verwachteUitkomsten = null)
    {
        _rows.Add((sheet, r) =>
        {
            Set(sheet, r, SchoolcontentKolom.ThemaNaam, themaNaam);
            Set(sheet, r, SchoolcontentKolom.ThemaDuurWeken, themaDuurWeken);
            Set(sheet, r, SchoolcontentKolom.ThemaInvalshoeken, invalshoeken);
            Set(sheet, r, SchoolcontentKolom.ThemaKernwoordenschat, kernwoordenschat);
            Set(sheet, r, SchoolcontentKolom.ThemaRijkeWoordenschat, rijkeWoordenschat);
            Set(sheet, r, SchoolcontentKolom.Themadoelen, themadoelen);
            Set(sheet, r, SchoolcontentKolom.SubthemaNaam, subthemaNaam);
            Set(sheet, r, SchoolcontentKolom.SubthemaDuurWeken, subthemaDuurWeken);
            Set(sheet, r, SchoolcontentKolom.SubthemaKlas, klas);
            Set(sheet, r, SchoolcontentKolom.SubthemaLeeftijd, leeftijd);
            Set(sheet, r, SchoolcontentKolom.SubthemaProbleemstelling, probleemstelling);
            Set(sheet, r, SchoolcontentKolom.SubthemaOnderzoeksvraag, onderzoeksvraag);
            Set(sheet, r, SchoolcontentKolom.Subdoelen, subdoelen);
            Set(sheet, r, SchoolcontentKolom.ActiviteitNaam, activiteitNaam);
            Set(sheet, r, SchoolcontentKolom.ActiviteitType, activiteitType);
            Set(sheet, r, SchoolcontentKolom.ActiviteitHoek, hoek);
            Set(sheet, r, SchoolcontentKolom.ActiviteitVerwachteUitkomsten, verwachteUitkomsten);
        });
        return this;
    }

    /// <summary>Builds the workbook and returns it as a seekable stream.</summary>
    public MemoryStream Bouw()
    {
        using var workbook = new XLWorkbook();
        var sheet = workbook.AddWorksheet("Schoolcontent");

        for (var i = 0; i < _rows.Count; i++)
        {
            _rows[i](sheet, i + 1);
        }

        var stream = new MemoryStream();
        workbook.SaveAs(stream);
        stream.Position = 0;
        return stream;
    }

    /// <summary>Builds an empty workbook (a sheet with no used cells) as a seekable stream.</summary>
    public static MemoryStream LeegWerkboek()
    {
        using var workbook = new XLWorkbook();
        workbook.AddWorksheet("Schoolcontent");
        var stream = new MemoryStream();
        workbook.SaveAs(stream);
        stream.Position = 0;
        return stream;
    }

    private static void Set(IXLWorksheet sheet, int row, SchoolcontentKolom kolom, string? value)
    {
        if (value is not null)
        {
            sheet.Cell(row, (int)kolom).Value = value;
        }
    }
}
