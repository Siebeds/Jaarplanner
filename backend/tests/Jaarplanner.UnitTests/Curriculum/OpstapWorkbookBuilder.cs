using ClosedXML.Excel;
using Jaarplanner.Infrastructure.OpstapImport;

namespace Jaarplanner.UnitTests.Curriculum;

/// <summary>
/// Builds small, in-memory Op.stap goal workbooks (.xlsx) for the parser tests. Columns are
/// written through the single-source <see cref="OpstapKolom"/> mapping so a fixture row and
/// the parser stay in lock-step with the A–M layout — there is no second column map in tests.
/// </summary>
internal sealed class OpstapWorkbookBuilder
{
    private readonly List<Action<IXLWorksheet, int>> _rows = [];

    /// <summary>Adds a header-style row whose doelsoort cell is not a recognised code.</summary>
    public OpstapWorkbookBuilder MetHeader()
    {
        _rows.Add((sheet, r) =>
        {
            Set(sheet, r, OpstapKolom.Doelsoort, "Doelsoort");
            Set(sheet, r, OpstapKolom.Code, "Code");
            Set(sheet, r, OpstapKolom.Tekst, "Leerplandoel");
        });
        return this;
    }

    /// <summary>Adds a fully blank row.</summary>
    public OpstapWorkbookBuilder MetLegeRij()
    {
        _rows.Add((_, _) => { });
        return this;
    }

    /// <summary>Adds a data row from explicit per-column values (null leaves the cell empty).</summary>
    public OpstapWorkbookBuilder MetRij(
        string? doelsoort = "MD",
        string? leeftijdMd = "K-",
        string? nummerMd = "12",
        string? minimumdoelRef = null,
        string? code = "NC-1.1",
        string? jaarFase = "K3",
        string? domein = "Mondelinge taalvaardigheid",
        string? subdomein = "Luisteren",
        string? cluster = null,
        string? tekst = "De leerling luistert actief.",
        string? voorbeelden = null,
        string? toelichting = null,
        string? woordenschat = null)
    {
        _rows.Add((sheet, r) =>
        {
            Set(sheet, r, OpstapKolom.Doelsoort, doelsoort);
            Set(sheet, r, OpstapKolom.LeeftijdMinimumdoel, leeftijdMd);
            Set(sheet, r, OpstapKolom.NummerMinimumdoel, nummerMd);
            Set(sheet, r, OpstapKolom.MinimumdoelRef, minimumdoelRef);
            Set(sheet, r, OpstapKolom.Code, code);
            Set(sheet, r, OpstapKolom.JaarFase, jaarFase);
            Set(sheet, r, OpstapKolom.Domein, domein);
            Set(sheet, r, OpstapKolom.Subdomein, subdomein);
            Set(sheet, r, OpstapKolom.Cluster, cluster);
            Set(sheet, r, OpstapKolom.Tekst, tekst);
            Set(sheet, r, OpstapKolom.Voorbeelden, voorbeelden);
            Set(sheet, r, OpstapKolom.Toelichting, toelichting);
            Set(sheet, r, OpstapKolom.Woordenschat, woordenschat);
        });
        return this;
    }

    /// <summary>Marks the given A–M column as hidden on the produced sheet.</summary>
    public OpstapWorkbookBuilder MetVerborgenKolom(OpstapKolom kolom)
    {
        _verborgenKolommen.Add(kolom);
        return this;
    }

    private readonly List<OpstapKolom> _verborgenKolommen = [];

    /// <summary>Builds the workbook and returns it as a seekable stream.</summary>
    public MemoryStream Bouw()
    {
        using var workbook = new XLWorkbook();
        var sheet = workbook.AddWorksheet("Leerplandoelen");

        for (var i = 0; i < _rows.Count; i++)
        {
            _rows[i](sheet, i + 1);
        }

        foreach (var kolom in _verborgenKolommen)
        {
            sheet.Column((int)kolom).Hide();
        }

        var stream = new MemoryStream();
        workbook.SaveAs(stream);
        stream.Position = 0;
        return stream;
    }

    private static void Set(IXLWorksheet sheet, int row, OpstapKolom kolom, string? value)
    {
        if (value is not null)
        {
            sheet.Cell(row, (int)kolom).Value = value;
        }
    }
}
