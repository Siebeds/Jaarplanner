using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using ClosedXML.Excel;
using Jaarplanner.Infrastructure.OpstapImport;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.IntegrationTests.Postgres;

/// <summary>
/// Drives the Op.stap curriculum import <b>over HTTP against real PostgreSQL</b> — E1-15's acceptance
/// criteria ("an initial import and a re-import can both be triggered in a deployed app; the re-import
/// returns its review report; the curriculum stays read-only and existing jaarplannen are untouched").
/// <para>
/// <b>Why these go through the endpoint and the real database.</b> E1-15 exists because
/// <c>OpstapImportServiceTests</c> proved the logic while nothing could run it: a unit test that calls a
/// service directly says nothing about reachability, and it runs on the EF in-memory provider, which
/// enforces no foreign keys. Every assertion below therefore starts at an HTTP request and ends at rows
/// only the real pipeline (controller → parser → import service → Npgsql) could have written, or at a
/// database constraint that only a real server applies.
/// </para>
/// </summary>
public sealed class OpstapImportEndpointsTests : IAsyncLifetime
{
    /// <summary>Wiskunde. Seeded by the migrations, so the required Restrict FK has something to point at.</summary>
    private const string Discipline = "2";

    private PostgresTestDatabase _db = null!;
    private PostgresApiFactory _factory = null!;

    public async Task InitializeAsync()
    {
        if (!PostgresTestDatabase.IsBeschikbaar)
        {
            return; // Every test is a PostgresFact and will report as skipped.
        }

        _db = await PostgresTestDatabase.MaakAsync("opstapimport");
        _factory = new PostgresApiFactory(_db.ConnectionString);
    }

    public async Task DisposeAsync()
    {
        _factory?.Dispose();
        if (_db is not null)
        {
            await _db.DisposeAsync();
        }
    }

    /// <summary>
    /// The initial import (FR-2.1): the leerplandoelen land in the database, with their official content
    /// intact and the review flag clear. Asserted against the database rather than against the response,
    /// because the response is what the old unit tests already covered.
    /// </summary>
    [PostgresFact]
    public async Task Eerste_import_laadt_de_leerplandoelen_in()
    {
        var antwoord = await Upload(Werkboek(
            Rij("WIS-1", tekst: "De leerling telt tot 20.", jaarFase: "L1"),
            Rij("WIS-2", tekst: "De leerling splitst tot 10.", jaarFase: "L1")));

        Assert.True(antwoord.GetProperty("isBestandGeldig").GetBoolean());
        Assert.True(antwoord.GetProperty("isVolledigVerwerkt").GetBoolean());
        Assert.True(antwoord.GetProperty("toegepast").GetBoolean());
        Assert.Equal(
            ["WIS-1", "WIS-2"],
            Codes(antwoord.GetProperty("diff").GetProperty("toegevoegd")));

        await using var context = _db.MaakContext();
        var doelen = await context.Leerplandoelen.OrderBy(l => l.Code).ToListAsync();
        Assert.Equal(2, doelen.Count);
        Assert.Equal("De leerling telt tot 20.", doelen[0].Tekst);
        Assert.Equal("Getallen", doelen[0].Domein);
        Assert.Equal(Discipline, doelen[0].DisciplineNummer);
        Assert.All(doelen, d => Assert.False(d.NietMeerInOpstap));
    }

    /// <summary>The preview writes nothing (FR-2.5): it reports what <i>would</i> land, and the table stays empty.</summary>
    [PostgresFact]
    public async Task Voorbeeld_schrijft_niets()
    {
        var antwoord = await Upload(Werkboek(Rij("WIS-1")), pad: "voorbeeld");

        Assert.False(antwoord.GetProperty("toegepast").GetBoolean());
        Assert.Equal(["WIS-1"], Codes(antwoord.GetProperty("diff").GetProperty("toegevoegd")));

        await using var context = _db.MaakContext();
        Assert.Empty(await context.Leerplandoelen.ToListAsync());
    }

    /// <summary>Re-importing the same file changes nothing (idempotent on <c>code</c>, Art. III.5).</summary>
    [PostgresFact]
    public async Task Herimport_van_hetzelfde_bestand_wijzigt_niets()
    {
        await Upload(Werkboek(Rij("WIS-1")));

        var antwoord = await Upload(Werkboek(Rij("WIS-1")));

        var diff = antwoord.GetProperty("diff");
        Assert.Empty(diff.GetProperty("toegevoegd").EnumerateArray());
        Assert.Empty(diff.GetProperty("gewijzigd").EnumerateArray());
        Assert.Equal(["WIS-1"], Codes(diff.GetProperty("ongewijzigd")));
        Assert.True(diff.GetProperty("isLeeg").GetBoolean());
        Assert.False(diff.GetProperty("vereistReview").GetBoolean());
    }

    /// <summary>
    /// The re-import review report (FR-2.5) reaches the caller with field-level detail: a reworded
    /// leerplandoel is reported as changed, naming the old and the new value, and the stored content is
    /// refreshed to the file's version. Refreshing official content is the <b>import path's</b> privilege
    /// (Art. III.1 forbids the app and its users, not the sanctioned importer).
    /// </summary>
    [PostgresFact]
    public async Task Herimport_rapporteert_de_gewijzigde_velden_en_werkt_de_inhoud_bij()
    {
        await Upload(Werkboek(Rij("WIS-1", tekst: "De leerling telt tot 20.")));

        var antwoord = await Upload(Werkboek(Rij("WIS-1", tekst: "De leerling telt tot 100.")));

        var gewijzigd = Assert.Single(antwoord.GetProperty("diff").GetProperty("gewijzigd").EnumerateArray());
        Assert.Equal("WIS-1", gewijzigd.GetProperty("code").GetString());
        var veld = Assert.Single(gewijzigd.GetProperty("velden").EnumerateArray());
        Assert.Equal("Tekst", veld.GetProperty("veld").GetString());
        Assert.Equal("De leerling telt tot 20.", veld.GetProperty("oudeWaarde").GetString());
        Assert.Equal("De leerling telt tot 100.", veld.GetProperty("nieuweWaarde").GetString());
        Assert.True(antwoord.GetProperty("diff").GetProperty("vereistReview").GetBoolean());

        await using var context = _db.MaakContext();
        var doel = await context.Leerplandoelen.SingleAsync(l => l.Code == "WIS-1");
        Assert.Equal("De leerling telt tot 100.", doel.Tekst);
    }

    /// <summary>
    /// <b>The headline acceptance criterion (Art. III.4).</b> A goal that disappears from Op.stap while a
    /// thema still links it is <b>flagged, never deleted</b>, and the teacher's link survives with its
    /// status untouched. Driven entirely over HTTP: the goal is imported through the import endpoint, the
    /// themadoel is created through the beheer endpoint, and the re-import runs through the import
    /// endpoint again, so the FK that makes this guarantee real (<c>Restrict</c>) is the production one.
    /// </summary>
    [PostgresFact]
    public async Task Verdwenen_maar_gekoppeld_doel_wordt_gemarkeerd_en_de_koppeling_blijft()
    {
        var client = _factory.CreateClient();
        await Upload(Werkboek(Rij("WIS-1"), Rij("WIS-2")), client: client);

        // A teacher anchors a thema on WIS-1 (E1-10's themadoel path, Art. IX.2).
        var thema = await client.PostAsJsonAsync("/api/themas", new { naam = "Meten", duurWeken = 5 });
        thema.EnsureSuccessStatusCode();
        var themaId = (await thema.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
        var themadoel = await client.PostAsJsonAsync(
            $"/api/themas/{themaId}/themadoelen", new { leerplandoelCode = "WIS-1" });
        themadoel.EnsureSuccessStatusCode();

        // Op.stap drops WIS-1 in the next release.
        var antwoord = await Upload(Werkboek(Rij("WIS-2")), client: client);

        var verdwenen = Assert.Single(
            antwoord.GetProperty("diff").GetProperty("verdwenenMaarGekoppeld").EnumerateArray());
        Assert.Equal("WIS-1", verdwenen.GetProperty("code").GetString());
        Assert.Equal(1, verdwenen.GetProperty("aantalKoppelingen").GetInt32());
        Assert.True(antwoord.GetProperty("diff").GetProperty("vereistReview").GetBoolean());

        // Kept and flagged, not deleted.
        await using var context = _db.MaakContext();
        var doel = await context.Leerplandoelen.SingleAsync(l => l.Code == "WIS-1");
        Assert.True(doel.NietMeerInOpstap);

        // And the teacher's link is still there, with its status intact (Art. IV.2).
        var themaNa = await client.GetFromJsonAsync<JsonElement>($"/api/themas/{themaId}");
        var doelen = themaNa.GetProperty("themadoelen").EnumerateArray().ToList();
        var koppeling = Assert.Single(doelen).GetProperty("koppeling");
        Assert.Equal("WIS-1", koppeling.GetProperty("leerplandoelCode").GetString());
        Assert.Equal("Manueel", koppeling.GetProperty("status").GetString());
    }

    /// <summary>
    /// A malformed row is reported with its row number and still lets the good rows through
    /// ("report, never silently drop" — ADR-0006 §4), and the two response flags separate the questions
    /// "did it parse?" from "did everything land?".
    /// </summary>
    [PostgresFact]
    public async Task Ongeldige_rij_wordt_gerapporteerd_en_geldige_rij_gaat_door()
    {
        var antwoord = await Upload(Werkboek(
            Rij("WIS-1"),
            Rij("WIS-2", doelsoort: "ZZ"))); // row 3: not an Op.stap doelsoort code

        Assert.False(antwoord.GetProperty("isBestandGeldig").GetBoolean());
        Assert.False(antwoord.GetProperty("isVolledigVerwerkt").GetBoolean());
        var probleem = Assert.Single(antwoord.GetProperty("problemen").EnumerateArray());
        Assert.Equal(3, probleem.GetProperty("rijNummer").GetInt32());
        Assert.Equal("WIS-2", probleem.GetProperty("code").GetString());

        await using var context = _db.MaakContext();
        Assert.Equal(["WIS-1"], await context.Leerplandoelen.Select(l => l.Code).ToListAsync());
    }

    /// <summary>
    /// An empty or wrong file never wipes a loaded discipline (Art. III.4): the import is skipped with a
    /// notice, nothing is flagged or deleted, and <c>isVolledigVerwerkt</c> is false even though the file
    /// parsed without a single problem. This is why the two flags are separate.
    /// </summary>
    [PostgresFact]
    public async Task Leeg_bestand_slaat_de_import_over_en_laat_de_geladen_doelen_staan()
    {
        await Upload(Werkboek(Rij("WIS-1")));

        var antwoord = await Upload(Werkboek());

        Assert.True(antwoord.GetProperty("isBestandGeldig").GetBoolean());
        Assert.False(antwoord.GetProperty("isVolledigVerwerkt").GetBoolean());
        Assert.False(antwoord.GetProperty("toegepast").GetBoolean());
        var diff = antwoord.GetProperty("diff");
        Assert.True(diff.GetProperty("overgeslagen").GetBoolean());
        Assert.NotEmpty(diff.GetProperty("opmerkingen").EnumerateArray());

        await using var context = _db.MaakContext();
        var doel = await context.Leerplandoelen.SingleAsync();
        Assert.Equal("WIS-1", doel.Code);
        Assert.False(doel.NietMeerInOpstap);
    }

    /// <summary>
    /// The E1-06 discipline-selection seam is honoured <b>through the trigger</b>: with
    /// <c>Opstap:DisciplineSelectie</c> configured to a starter set, an out-of-scope discipline is skipped
    /// with a notice and writes nothing. Configured here, never compiled in (Art. XIV, ADR-0019).
    /// </summary>
    [PostgresFact]
    public async Task Discipline_buiten_de_geconfigureerde_selectie_wordt_overgeslagen()
    {
        using var factory = _factory.WithWebHostBuilder(builder =>
        {
            builder.UseSetting("Opstap:DisciplineSelectie:Modus", "Selectie");
            builder.UseSetting("Opstap:DisciplineSelectie:Disciplines:0", "1");
        });

        var antwoord = await Upload(Werkboek(Rij("WIS-1")), client: factory.CreateClient());

        var diff = antwoord.GetProperty("diff");
        Assert.True(diff.GetProperty("overgeslagen").GetBoolean());
        Assert.False(antwoord.GetProperty("toegepast").GetBoolean());
        Assert.False(antwoord.GetProperty("isVolledigVerwerkt").GetBoolean());

        await using var context = _db.MaakContext();
        Assert.Empty(await context.Leerplandoelen.ToListAsync());
    }

    /// <summary>
    /// <b>Characterisation test for the E1-12 blocker, at the trigger.</b> A real Op.stap file's
    /// MD-concorded rows cannot commit while no <c>Minimumdoel</c> row can exist, because
    /// <c>MinimumdoelRef</c> is a Restrict FK. The endpoint answers <b>409</b> with a Dutch explanation
    /// instead of a 500, and the curriculum is left exactly as it was.
    /// <para>
    /// Flip this to the positive assertion when E1-12 lands; until then it is the honest statement of what
    /// the trigger can and cannot do, and it is the assertion the EF in-memory provider structurally
    /// cannot make.
    /// </para>
    /// </summary>
    [PostgresFact]
    public async Task Doel_met_concordantie_naar_een_onbekend_minimumdoel_geeft_409_en_wijzigt_niets()
    {
        await Upload(Werkboek(Rij("WIS-1")));

        var response = await Verstuur(
            _factory.CreateClient(),
            "/api/opstap-import",
            Werkboek(Rij("WIS-2", doelsoort: "MD", leeftijdMd: "4-", nummerMd: "12")),
            Discipline);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        var probleem = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Contains("minimumdoelen", probleem.GetProperty("detail").GetString()!, StringComparison.Ordinal);

        await using var context = _db.MaakContext();
        Assert.Equal(["WIS-1"], await context.Leerplandoelen.Select(l => l.Code).ToListAsync());
    }

    /// <summary>
    /// A discipline number Op.stap does not have is refused with a 400, answered by the seeded taxonomy in
    /// the database rather than by a list compiled into the controller (Art. VII.0).
    /// </summary>
    [PostgresFact]
    public async Task Onbekend_disciplinenummer_geeft_400()
    {
        var response = await Verstuur(
            _factory.CreateClient(), "/api/opstap-import", Werkboek(Rij("WIS-1")), disciplineNummer: "99");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var probleem = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Contains("99", probleem.GetProperty("detail").GetString()!, StringComparison.Ordinal);
    }

    /// <summary>
    /// A file uploaded under the <b>wrong</b> discipline number, whose codes are already loaded under
    /// another one, is refused with a 409 instead of a 500 — and changes nothing.
    /// <para>
    /// This case was found by driving the endpoint by hand, not by the unit tests: the import diffs
    /// <i>within</i> one discipline, so a code that exists under a different discipline is not
    /// "ongewijzigd" to it, it is an insert on an existing primary key. The EF in-memory provider
    /// enforces no primary key either, so nothing below the endpoint could have surfaced it.
    /// </para>
    /// </summary>
    [PostgresFact]
    public async Task Zelfde_code_onder_een_andere_discipline_geeft_409_en_wijzigt_niets()
    {
        await Upload(Werkboek(Rij("WIS-1", tekst: "De leerling telt tot 20.")));

        // Discipline 3 (Wetenschap en techniek) is seeded too, so this is not the unknown-discipline case.
        var response = await Verstuur(
            _factory.CreateClient(), "/api/opstap-import", Werkboek(Rij("WIS-1")), disciplineNummer: "3");

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        var probleem = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Contains("andere discipline", probleem.GetProperty("detail").GetString()!, StringComparison.Ordinal);

        await using var context = _db.MaakContext();
        var doel = await context.Leerplandoelen.SingleAsync();
        Assert.Equal(Discipline, doel.DisciplineNummer);
        Assert.Equal("De leerling telt tot 20.", doel.Tekst);
    }

    [PostgresFact]
    public async Task Zonder_disciplinenummer_geeft_400()
    {
        var response = await Verstuur(
            _factory.CreateClient(), "/api/opstap-import", Werkboek(Rij("WIS-1")), disciplineNummer: null);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [PostgresFact]
    public async Task Niet_xlsx_bestand_geeft_400()
    {
        using var inhoud = new MultipartFormDataContent();
        inhoud.Add(new ByteArrayContent([1, 2, 3]), "bestand", "doelen.csv");
        inhoud.Add(new StringContent(Discipline), "disciplineNummer");

        var response = await _factory.CreateClient().PostAsync("/api/opstap-import", inhoud);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    private Task<JsonElement> Upload(byte[] werkboek, string? pad = null, HttpClient? client = null) =>
        Upload(client ?? _factory.CreateClient(), werkboek, pad);

    private static async Task<JsonElement> Upload(HttpClient client, byte[] werkboek, string? pad)
    {
        var url = pad is null ? "/api/opstap-import" : $"/api/opstap-import/{pad}";
        var response = await Verstuur(client, url, werkboek, Discipline);
        response.EnsureSuccessStatusCode();

        return await response.Content.ReadFromJsonAsync<JsonElement>();
    }

    private static async Task<HttpResponseMessage> Verstuur(
        HttpClient client,
        string url,
        byte[] werkboek,
        string? disciplineNummer)
    {
        using var inhoud = new MultipartFormDataContent();
        var bestand = new ByteArrayContent(werkboek);
        bestand.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        inhoud.Add(bestand, "bestand", "opstap-wiskunde.xlsx");
        if (disciplineNummer is not null)
        {
            inhoud.Add(new StringContent(disciplineNummer), "disciplineNummer");
        }

        return await client.PostAsync(url, inhoud);
    }

    private static string[] Codes(JsonElement array) =>
        array.EnumerateArray().Select(c => c.GetString()!).OrderBy(c => c, StringComparer.Ordinal).ToArray();

    /// <summary>One Op.stap goal row, written through the single-source column mapping (Art. VII.1).</summary>
    private static IReadOnlyDictionary<OpstapKolom, string> Rij(
        string code,
        string doelsoort = "G",
        string jaarFase = "L1",
        string tekst = "De leerling telt tot 20.",
        string? leeftijdMd = null,
        string? nummerMd = null)
    {
        var cellen = new Dictionary<OpstapKolom, string>
        {
            [OpstapKolom.Doelsoort] = doelsoort,
            [OpstapKolom.Code] = code,
            [OpstapKolom.JaarFase] = jaarFase,
            [OpstapKolom.Domein] = "Getallen",
            [OpstapKolom.Subdomein] = "Getalbegrip",
            [OpstapKolom.Tekst] = tekst,
        };

        if (leeftijdMd is not null)
        {
            cellen[OpstapKolom.LeeftijdMinimumdoel] = leeftijdMd;
        }

        if (nummerMd is not null)
        {
            cellen[OpstapKolom.NummerMinimumdoel] = nummerMd;
        }

        return cellen;
    }

    /// <summary>
    /// Builds an Op.stap goal workbook with the official header row plus the given data rows, addressing
    /// every cell through <see cref="OpstapKolom"/> so the fixture cannot drift from the A–M layout.
    /// </summary>
    private static byte[] Werkboek(params IReadOnlyDictionary<OpstapKolom, string>[] rijen)
    {
        using var workbook = new XLWorkbook();
        var sheet = workbook.AddWorksheet("Leerplandoelen");

        // The header row the parser recognises and skips (column A reads "Doelsoort").
        sheet.Cell(1, (int)OpstapKolom.Doelsoort).Value = "Doelsoort";
        sheet.Cell(1, (int)OpstapKolom.Code).Value = "Code";
        sheet.Cell(1, (int)OpstapKolom.Tekst).Value = "Leerplandoel";

        for (var i = 0; i < rijen.Length; i++)
        {
            foreach (var (kolom, waarde) in rijen[i])
            {
                sheet.Cell(i + 2, (int)kolom).Value = waarde;
            }
        }

        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        return stream.ToArray();
    }
}
