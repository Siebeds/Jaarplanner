using System.Net;
using System.Net.Http.Json;
using ClosedXML.Excel;
using Jaarplanner.Application.Planning;
using Jaarplanner.Application.Planning.Generatie;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.Infrastructure.Dekking;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Jaarplanner.IntegrationTests.Postgres;

/// <summary>
/// The coverage export through the real HTTP pipeline against real PostgreSQL (E5-06, FR-9.5, FR-11.2).
/// <para>
/// <b>Why this exists next to the generator's unit tests.</b> Those hand the generator a <c>DekkingWeergave</c> they
/// built themselves, so they prove the rendering rules and nothing about where the record comes from. E7-16 is filed
/// precisely because this repo has eight times shipped a path verified only against a fake or the in-memory provider.
/// The two things only this layer can prove are that the DI container resolves the chain at all (the reachable-vs-tested
/// gap that has cost this project a milestone and five reopened stories), and that <b>the document agrees with the JSON
/// read beside it</b> row for row, which is the whole claim behind "an export reproduces the on-screen coverage
/// faithfully".
/// </para>
/// <para>
/// It also pins the owner ruling of 2026-08-06 at the layer where it is enforceable: the screen's filters are not
/// parameters of this route, so appending them changes nothing.
/// </para>
/// </summary>
public sealed class DekkingExportEndpointTests : IAsyncLifetime
{
    private PostgresTestDatabase _db = null!;
    private PostgresApiFactory _factory = null!;

    public async Task InitializeAsync()
    {
        if (!PostgresTestDatabase.IsBeschikbaar)
        {
            return;
        }

        _db = await PostgresTestDatabase.MaakAsync("dekkingexport");
        _factory = new PostgresApiFactory(_db.ConnectionString);
    }

    public async Task DisposeAsync()
    {
        if (_factory is not null)
        {
            await _factory.DisposeAsync();
        }

        if (_db is not null)
        {
            await _db.DisposeAsync();
        }
    }

    [PostgresFact]
    public async Task De_export_is_een_xlsx_met_een_bestandsnaam_die_de_klas_noemt()
    {
        var klasId = await ZetKlasOpAsync();

        var client = _factory.CreateClient();
        var response = await client.GetAsync($"/api/klassen/{klasId}/dekking/export");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(ClosedXmlDekkingExport.XlsxContentType, response.Content.Headers.ContentType?.MediaType);

        // A browser saves under this name, so it is part of the contract rather than a detail: a school ends up with
        // one of these per class per year and "dekking.xlsx" identifies nothing.
        var naam = response.Content.Headers.ContentDisposition?.FileNameStar
            ?? response.Content.Headers.ContentDisposition?.FileName;
        Assert.NotNull(naam);
        Assert.StartsWith("dekking-k3-", naam.Trim('"'), StringComparison.Ordinal);
        Assert.EndsWith(".xlsx", naam.Trim('"'), StringComparison.Ordinal);
        // The scope is in the name too, so two scopes of one class are two files rather than one name twice. Read out
        // of the ANSWER rather than assumed: a first version of this line asserted "-l3-" because the helper is called
        // ZetKlasOpAsync, and the class it seeds has Leerjaar 0, so it is a kleutergroep measured against JK+K2+K3.
        // Asserting the codes the server says it measured cannot be wrong about that, and it still fails if the scope
        // stops travelling into the name.
        var json = await client.GetFromJsonAsync<DekkingDto>($"/api/klassen/{klasId}/dekking");
        Assert.NotNull(json);
        Assert.NotEmpty(json.GemetenJaarFasen);
        foreach (var code in json.GemetenJaarFasen)
        {
            Assert.Contains(code.ToLowerInvariant(), naam.Trim('"'), StringComparison.Ordinal);
        }
    }

    [PostgresFact]
    public async Task Het_document_stemt_rij_voor_rij_overeen_met_het_JSON_antwoord()
    {
        // THE ANTI-DRIFT ASSERTION, and the one the story's acceptance criterion actually rests on. Both routes run
        // DekkingService for the same scope, so the document is a rendering of the same computation rather than a
        // second one that happens to agree. If anyone ever gives the export its own query, this fails.
        var (klasId, _) = await ZetGeplaatstThemaOpAsync(KoppelingStatus.Aanvaard, vervallen: false);
        var client = _factory.CreateClient();

        var json = await client.GetFromJsonAsync<DekkingDto>($"/api/klassen/{klasId}/dekking");
        Assert.NotNull(json);

        var rijen = await HaalRijenAsync(client, $"/api/klassen/{klasId}/dekking/export");

        // A mixed pattern rather than all-or-nothing (1 of 2 covered), so a document that lost the gedekt column or
        // wrote it constant cannot coincide with the right answer.
        Assert.Equal(1, json.Doelen.Count(d => d.IsGedekt));
        Assert.Equal(json.Doelen.Count, rijen.Count);

        foreach (var doel in json.Doelen)
        {
            var rij = Assert.Single(rijen, r => r.Code == doel.Code);

            Assert.Equal(doel.IsGedekt ? "Ja" : "Nee", rij.Gedekt);
            // The evidence half of Art. V: the document must say through what, and it must be the same what.
            Assert.Equal(string.Join("; ", doel.DekkendeThemas), rij.DekkendeThemas);
        }
    }

    [PostgresFact]
    public async Task Het_bereik_reist_mee_naar_de_export()
    {
        // The seed holds two K3 doelen and one L6 doel, so the two scopes are distinguishable over HTTP. bereik is
        // part of what the figures MEAN (the same class has two legitimate denominators), which is why it travels
        // while the presentation filters do not.
        var klasId = await ZetKlasOpAsync();
        var client = _factory.CreateClient();

        var eigen = await HaalRijenAsync(client, $"/api/klassen/{klasId}/dekking/export");
        var alles = await HaalRijenAsync(client, $"/api/klassen/{klasId}/dekking/export?bereik=HeelCurriculum");

        Assert.DoesNotContain(eigen, rij => rij.Code == "EXP-L6");
        Assert.Contains(alles, rij => rij.Code == "EXP-L6");
        Assert.True(alles.Count > eigen.Count);
    }

    [PostgresFact]
    public async Task De_schermfilters_veranderen_de_export_niet()
    {
        // Owner ruling 2026-08-06: the export is ALWAYS the full set in scope. Pinned here rather than only in the
        // controller's comment, because the enforcement is an absence (no query parameter), and an absence is exactly
        // what a later story adds back without noticing. The URL below is what a reader would guess by analogy with
        // the screen's own query string.
        var (klasId, _) = await ZetGeplaatstThemaOpAsync(KoppelingStatus.Aanvaard, vervallen: false);
        var client = _factory.CreateClient();

        var kaal = await HaalRijenAsync(client, $"/api/klassen/{klasId}/dekking/export");
        var gefilterd = await HaalRijenAsync(
            client,
            $"/api/klassen/{klasId}/dekking/export?doelsoort=Minimumdoel&ontbrekend=1");

        Assert.Equal(kaal.Select(r => r.Code), gefilterd.Select(r => r.Code));
        // Both a covered and an uncovered doel survive a filter that, on the screen, would have removed one of each.
        Assert.Contains(gefilterd, rij => rij.Gedekt == "Ja");
        Assert.Contains(gefilterd, rij => rij.Gedekt == "Nee");
    }

    [PostgresFact]
    public async Task Een_ingehouden_cijfer_haalt_het_document_niet()
    {
        // The directie ruling of 2026-07-28 travelling the WHOLE chain: a stale placement makes the API withhold the
        // total, and the document must withhold it too. The rows keep their gedekt column in that state, so the number
        // is derivable from what the document already contains, which is why withholding has to be deliberate.
        var (klasId, _) = await ZetGeplaatstThemaOpAsync(KoppelingStatus.Aanvaard, vervallen: true);
        var client = _factory.CreateClient();

        var json = await client.GetFromJsonAsync<DekkingDto>($"/api/klassen/{klasId}/dekking");
        Assert.NotNull(json);
        Assert.False(json.IsBetrouwbaar);
        Assert.Null(json.AantalGedekt);

        var cellen = await HaalKopblokAsync(client, $"/api/klassen/{klasId}/dekking/export");

        Assert.Contains(cellen, tekst => tekst.Contains("Nog geen betrouwbaar cijfer", StringComparison.Ordinal));
        Assert.DoesNotContain(cellen, tekst => tekst.Contains("doelen gedekt", StringComparison.Ordinal));
    }

    /// <summary>One data row of the exported table, as the document actually holds it.</summary>
    private sealed record Exportrij(string Code, string Gedekt, string DekkendeThemas);

    /// <summary>Downloads the export and reads its data rows back with ClosedXML.</summary>
    private static async Task<List<Exportrij>> HaalRijenAsync(HttpClient client, string pad)
    {
        using var workbook = await HaalWorkbookAsync(client, pad);
        var blad = workbook.Worksheets.First();

        var kopregel = Kopregel(blad);
        var laatste = blad.LastRowUsed()?.RowNumber() ?? kopregel;
        var rijen = new List<Exportrij>();

        for (var rij = kopregel + 1; rij <= laatste; rij++)
        {
            rijen.Add(new Exportrij(
                blad.Cell(rij, (int)DekkingKolom.Code).GetString(),
                blad.Cell(rij, (int)DekkingKolom.Gedekt).GetString(),
                blad.Cell(rij, (int)DekkingKolom.DekkendeThemas).GetString()));
        }

        return rijen;
    }

    /// <summary>The kopblok's text: every used cell above the table header.</summary>
    private static async Task<List<string>> HaalKopblokAsync(HttpClient client, string pad)
    {
        using var workbook = await HaalWorkbookAsync(client, pad);
        var blad = workbook.Worksheets.First();

        var kopregel = Kopregel(blad);

        return blad.CellsUsed()
            .Where(cel => cel.Address.RowNumber < kopregel)
            .Select(cel => cel.GetString())
            .Where(tekst => !string.IsNullOrWhiteSpace(tekst))
            .ToList();
    }

    /// <summary>
    /// Downloads the export and opens it. Returns the workbook rather than the worksheet, because an async method
    /// cannot have an <c>out</c> parameter and the caller has to own the disposable.
    /// </summary>
    private static async Task<XLWorkbook> HaalWorkbookAsync(HttpClient client, string pad)
    {
        var response = await client.GetAsync(pad);
        response.EnsureSuccessStatusCode();

        // Copied into a MemoryStream rather than handed the response stream: ClosedXML needs to seek, and a response
        // body is not guaranteed seekable.
        var bytes = await response.Content.ReadAsByteArrayAsync();

        return new XLWorkbook(new MemoryStream(bytes));
    }

    /// <summary>
    /// The row the table header sits on, found rather than assumed: the kopblok's height varies with the state it
    /// describes, so a fixed row number would silently start reading the wrong thing.
    /// </summary>
    private static int Kopregel(IXLWorksheet blad)
    {
        var label = DekkingKolommen.Label(DekkingKolom.Code);

        return blad.Column((int)DekkingKolom.Code)
            .CellsUsed()
            .First(cel => cel.GetString() == label)
            .Address.RowNumber;
    }

    /// <summary>
    /// A class with a thema placed in its jaarplan, the thema carrying <c>EXP-01</c> as a themadoel. Mirrors
    /// <see cref="DekkingEndpointsTests"/>'s arrangement, including asking the real
    /// <see cref="IPlanningsblokIndeling"/> seam for the block start instead of guessing a date: a hard-coded start
    /// would make the healthy case depend on the grid beginning where the test hoped, and a test that drifts into
    /// asserting the stale path while claiming the healthy one is worse than none.
    /// </summary>
    private async Task<(Guid KlasId, Guid ThemaId)> ZetGeplaatstThemaOpAsync(
        KoppelingStatus plaatsingsstatus,
        bool vervallen)
    {
        var klasId = await ZetKlasOpAsync();

        using var scope = _factory.Services.CreateScope();
        var indeling = scope.ServiceProvider.GetRequiredService<IPlanningsblokIndeling>();
        await using var context = _db.MaakContext();

        var klas = await context.Klassen.SingleAsync(k => k.Id == klasId);
        var schooljaar = await context.Schooljaren.SingleAsync(s => s.Id == klas.SchooljaarId);

        var blokStart = vervallen
            ? schooljaar.Start.AddMonths(-1)
            : indeling.Blokken(schooljaar, JaarplanGeneratieService.GeneratieNiveau)[0].Start;

        var thema = new Thema("Herfstthema", duurWeken: 5);
        thema.VoegThemadoelToe(new DoelKoppeling("EXP-01", KoppelingStatus.Aanvaard, "anchor"));
        context.Themas.Add(thema);

        var jaarplan = new Jaarplan(klasId);
        jaarplan.VoegPlaatsingToe(
            thema.Id,
            JaarplanGeneratieService.GeneratieNiveau,
            blokStart,
            plaatsingsstatus,
            plaatsingsstatus == KoppelingStatus.Voorgesteld ? "past bij de herfst" : null);
        context.Jaarplannen.Add(jaarplan);

        await context.SaveChangesAsync();

        return (klasId, thema.Id);
    }

    /// <summary>
    /// A school year with one kleutergroep and three leerplandoelen: two in the class's own scope and one L6, so the
    /// scope is observable over HTTP rather than only in a unit test.
    /// </summary>
    /// <param name="jaarfase">
    /// The jaar/fase the class records, or <c>null</c> for a class that records none.
    /// <para>
    /// <b>Null builds a row the constructor can no longer produce, deliberately.</b> Since 2026-08-30 a
    /// <c>Klas</c> requires one of the nine codes, so the ordinal fallback (<c>Jaarfasen.VoorLeerjaar</c>) is
    /// reachable only for rows that predate that rule. Those rows exist: the migration left a class whose age
    /// could not be derived exactly as it was, and the Instellingen screen has a state that calls them out. The
    /// fallback is therefore still live code and still has to be tested, and the honest way to reach it is to
    /// write the legacy shape the way the database holds it rather than to keep a constructor overload alive
    /// for the tests.
    /// </para>
    /// </param>
    /// <param name="legacyLeerjaar">The ordinal such a row carries. Ignored unless <paramref name="jaarfase"/> is null.</param>
    private async Task<Guid> ZetKlasOpAsync(string? jaarfase = null, int legacyLeerjaar = 0)
    {
        await using var context = _db.MaakContext();

        foreach (var (code, jaarFase) in new[] { ("EXP-01", "K3"), ("EXP-02", "K3"), ("EXP-L6", "L6") })
        {
            if (!await context.Leerplandoelen.AnyAsync(l => l.Code == code))
            {
                context.Leerplandoelen.Add(new Leerplandoel(
                    code,
                    Doelsoort.Gemeenschappelijk,
                    jaarFase,
                    "Natuur",
                    "Levende natuur",
                    "9.1",
                    tekst: $"Tekst van {code}"));
            }
        }

        // Truncated to fit Schooljaar.Naam's varchar(32).
        var schooljaar = new Schooljaar(
            $"2026-2027-{Guid.NewGuid():N}"[..20],
            new DateOnly(2026, 9, 1),
            new DateOnly(2027, 6, 30));
        // A placeholder when the caller wants the legacy shape: the row is written through the domain, then
        // put back into the state a pre-2026-08-30 class is in. Writing it any other way would mean bypassing
        // the constructor's own validation for every class in this file, not just the two that need it.
        var klas = schooljaar.VoegKlasToe($"K3-{Guid.NewGuid():N}", jaarfase ?? "K3");
        context.Schooljaren.Add(schooljaar);

        await context.SaveChangesAsync();

        if (jaarfase is null)
        {
            await context.Database.ExecuteSqlInterpolatedAsync(
                $"""UPDATE klassen SET "Jaarfase" = NULL, "Leerjaar" = {legacyLeerjaar} WHERE "Id" = {klas.Id}""");
        }

        return klas.Id;
    }

    private sealed record DekkingDto(
        bool IsBetrouwbaar,
        int? AantalGedekt,
        int AantalLeerplandoelen,
        List<string> GemetenJaarFasen,
        List<DoelDto> Doelen);

    private sealed record DoelDto(string Code, bool IsGedekt, List<string> DekkendeThemas);
}
