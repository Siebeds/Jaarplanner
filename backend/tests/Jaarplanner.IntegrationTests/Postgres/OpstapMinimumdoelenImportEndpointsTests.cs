using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using ClosedXML.Excel;
using Jaarplanner.Api.Infrastructure;
using Jaarplanner.Application.Curriculum.Import;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Infrastructure.OpstapImport;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Jaarplanner.IntegrationTests.Postgres;

/// <summary>
/// E1-12 over HTTP against real PostgreSQL (ADR-0032): the decreed minimumdoelen are imported through
/// <c>POST /api/opstap-import/minimumdoelen</c>, and after that an MD-concorded leerplandoel commits where it used to
/// answer 409.
/// <para>
/// <b>What is faked and what is not.</b> Only the source is replaced, by a fixed list, because CI must not depend on KOV's
/// uptime; the live API has its own opt-in contract test (<c>OnderwijsdoelenLiveContractTests</c>). Everything from the
/// controller to the table is real, <b>including the DI registration</b>. Once <c>AddOpstapApi</c> is called from
/// <c>DependencyInjection.cs</c>, the fake replaces an existing registration rather than supplying a missing one. Until
/// then every test here fails with a 500, and <see cref="De_echte_bron_is_geregistreerd"/> is the one that says why: a
/// controller no running application can reach is the defect E1-15 and E2-08 were filed for.
/// </para>
/// </summary>
public sealed class OpstapMinimumdoelenImportEndpointsTests : IAsyncLifetime
{
    /// <summary>Wiskunde. Seeded by the migrations.</summary>
    private const string Discipline = "2";

    private const string Pad = "/api/opstap-import/minimumdoelen";

    private readonly VasteBron _bron = new();
    private PostgresTestDatabase _db = null!;
    private PostgresApiFactory _basis = null!;
    private WebApplicationFactory<Program> _factory = null!;

    public async Task InitializeAsync()
    {
        if (!PostgresTestDatabase.IsBeschikbaar)
        {
            return; // Every test is a PostgresFact and will report as skipped.
        }

        _db = await PostgresTestDatabase.MaakAsync("minimumdoelimport");
        _basis = new PostgresApiFactory(_db.ConnectionString);
        _factory = _basis.WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
        {
            foreach (var registratie in services.Where(d => d.ServiceType == typeof(IMinimumdoelBron)).ToList())
            {
                services.Remove(registratie);
            }

            services.AddSingleton<IMinimumdoelBron>(_bron);
        }));
    }

    public async Task DisposeAsync()
    {
        _factory?.Dispose();
        _basis?.Dispose();
        if (_db is not null)
        {
            await _db.DisposeAsync();
        }
    }

    /// <summary>The application itself reads KOV's API: the fake in the other tests replaces this, it does not stand in for it.</summary>
    [PostgresFact]
    public void De_echte_bron_is_geregistreerd()
    {
        using var scope = _basis.Services.CreateScope();

        Assert.IsType<OnderwijsdoelenApiBron>(scope.ServiceProvider.GetRequiredService<IMinimumdoelBron>());
        Assert.IsType<MinimumdoelImportService>(scope.ServiceProvider.GetRequiredService<IMinimumdoelImportService>());
    }

    [PostgresFact]
    public async Task Het_voorbeeld_schrijft_niets()
    {
        _bron.Geef(Md("K-1.3.9"), Md("4-5.2.1"));

        var antwoord = await Post($"{Pad}/voorbeeld");

        Assert.False(antwoord.GetProperty("toegepast").GetBoolean());
        Assert.Equal(["4-5.2.1", "K-1.3.9"], Refs(antwoord.GetProperty("diff").GetProperty("toegevoegd")));

        await using var context = _db.MaakContext();
        Assert.Empty(await context.Minimumdoelen.ToListAsync());
    }

    [PostgresFact]
    public async Task De_import_laadt_de_decretale_tekst_in_en_een_herimport_wijzigt_niets()
    {
        _bron.Geef(Md("K-1.3.9", "De kleuters kunnen actief deelnemen aan mondelinge interactievormen:\n- elkaar laten uitspreken;"));

        var eerste = await Post(Pad);
        var tweede = await Post(Pad);

        Assert.True(eerste.GetProperty("toegepast").GetBoolean());
        Assert.True(eerste.GetProperty("isVolledigVerwerkt").GetBoolean());
        Assert.True(tweede.GetProperty("diff").GetProperty("isLeeg").GetBoolean());
        Assert.Equal(["K-1.3.9"], Refs(tweede.GetProperty("diff").GetProperty("ongewijzigd")));

        await using var context = _db.MaakContext();
        var doel = await context.Minimumdoelen.SingleAsync();
        Assert.Equal("K-", doel.Leeftijd);
        Assert.Equal("1.3.9", doel.Nr);
        Assert.Equal("De kleuters kunnen actief deelnemen aan mondelinge interactievormen:\n- elkaar laten uitspreken;", doel.Omschrijving);
    }

    /// <summary>
    /// <b>E1-12's done-when, on the database that enforces it:</b> once the decreed minimumdoelen are in, an Op.stap row
    /// concorded to one of them commits. Before E1-12 the same row answered 409 because <c>MinimumdoelRef</c> is a
    /// Restrict FK and no <c>Minimumdoel</c> could exist (the characterisation test in
    /// <see cref="OpstapImportEndpointsTests"/> still pins that for a ref nobody imported).
    /// </summary>
    [PostgresFact]
    public async Task Na_de_import_landt_een_leerplandoel_met_concordantie()
    {
        _bron.Geef(Md("4-5.2.1"));
        await Post(Pad);

        var response = await VerstuurWerkboek(Werkboek(Rij("WIS-1", leeftijdMd: "4-", nummerMd: "5.2.1")));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        await using var context = _db.MaakContext();
        var doel = await context.Leerplandoelen.SingleAsync();
        Assert.Equal("4-5.2.1", doel.MinimumdoelRef);
    }

    /// <summary>
    /// Art. III.4 against the real FK: a minimumdoel the source stops publishing stays, and the leerplandoel that concords
    /// to it is untouched. Deleting it would have failed on the Restrict FK at best, and silently orphaned the concordance
    /// at worst.
    /// </summary>
    [PostgresFact]
    public async Task Een_verdwenen_minimumdoel_waar_een_leerplandoel_naar_verwijst_blijft_staan()
    {
        _bron.Geef(Md("4-5.2.1"), Md("K-1.3.9"));
        await Post(Pad);
        (await VerstuurWerkboek(Werkboek(Rij("WIS-1", leeftijdMd: "4-", nummerMd: "5.2.1")))).EnsureSuccessStatusCode();
        _bron.Geef(Md("K-1.3.9"));

        var antwoord = await Post(Pad);

        var diff = antwoord.GetProperty("diff");
        Assert.Equal(["4-5.2.1"], Refs(diff.GetProperty("verdwenen")));
        Assert.True(diff.GetProperty("vereistReview").GetBoolean());
        Assert.Equal(
            [MinimumdoelImportService.VerdwenenMelding(1)],
            diff.GetProperty("opmerkingen").EnumerateArray().Select(o => o.GetString()!).ToArray());

        await using var context = _db.MaakContext();
        Assert.Equal(["4-5.2.1", "K-1.3.9"], await context.Minimumdoelen.Select(m => m.Ref).OrderBy(r => r).ToListAsync());
        Assert.Equal("4-5.2.1", (await context.Leerplandoelen.SingleAsync()).MinimumdoelRef);
    }

    [PostgresFact]
    public async Task Een_onleesbare_bron_geeft_502_met_de_nederlandse_melding_en_wijzigt_niets()
    {
        _bron.Faal(new OpstapBronFout("GET https://api.katholiekonderwijs.vlaanderen/agodi/onderwijsdoelen/opstap answered 503."));

        var response = await _factory.CreateClient().PostAsync(Pad, content: null);

        Assert.Equal(HttpStatusCode.BadGateway, response.StatusCode);
        var probleem = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(Probleemtitels.OpstapNietOpgehaald, probleem.GetProperty("title").GetString());
        Assert.Equal(OpstapBronFout.Melding, probleem.GetProperty("detail").GetString());
        // The English cause is for the log, never for the person who pressed the button.
        Assert.DoesNotContain("answered", probleem.GetRawText(), StringComparison.Ordinal);

        await using var context = _db.MaakContext();
        Assert.Empty(await context.Minimumdoelen.ToListAsync());
    }

    private static Minimumdoel Md(string minimumdoelRef, string omschrijving = "De leerlingen kennen het verschil tussen bron en bewijs.")
    {
        var streep = minimumdoelRef.IndexOf('-', StringComparison.Ordinal);
        return new Minimumdoel(minimumdoelRef, minimumdoelRef[..(streep + 1)], minimumdoelRef[(streep + 1)..], omschrijving);
    }

    private async Task<JsonElement> Post(string url)
    {
        var response = await _factory.CreateClient().PostAsync(url, content: null);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<JsonElement>();
    }

    private async Task<HttpResponseMessage> VerstuurWerkboek(byte[] werkboek)
    {
        using var inhoud = new MultipartFormDataContent();
        var bestand = new ByteArrayContent(werkboek);
        bestand.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        inhoud.Add(bestand, "bestand", "opstap-wiskunde.xlsx");
        inhoud.Add(new StringContent(Discipline), "disciplineNummer");

        return await _factory.CreateClient().PostAsync("/api/opstap-import", inhoud);
    }

    private static string[] Refs(JsonElement array) =>
        array.EnumerateArray().Select(r => r.GetString()!).OrderBy(r => r, StringComparer.Ordinal).ToArray();

    /// <summary>One Op.stap goal row, addressed through the single-source column mapping (Art. VII.1).</summary>
    private static IReadOnlyDictionary<OpstapKolom, string> Rij(string code, string leeftijdMd, string nummerMd) =>
        new Dictionary<OpstapKolom, string>
        {
            [OpstapKolom.Doelsoort] = "G",
            [OpstapKolom.LeeftijdMinimumdoel] = leeftijdMd,
            [OpstapKolom.NummerMinimumdoel] = nummerMd,
            [OpstapKolom.Code] = code,
            [OpstapKolom.JaarFase] = "L4",
            [OpstapKolom.Domein] = "Getallen",
            [OpstapKolom.Subdomein] = "Getalbegrip",
            [OpstapKolom.Tekst] = "De leerling telt tot 20.",
        };

    private static byte[] Werkboek(params IReadOnlyDictionary<OpstapKolom, string>[] rijen)
    {
        using var workbook = new XLWorkbook();
        var sheet = workbook.AddWorksheet("Leerplandoelen");
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

    /// <summary>A source that answers whatever the test last told it to, or fails.</summary>
    private sealed class VasteBron : IMinimumdoelBron
    {
        private Func<MinimumdoelBronResultaat> _antwoord = () => new MinimumdoelBronResultaat([], []);

        public void Geef(params Minimumdoel[] doelen) =>
            _antwoord = () => new MinimumdoelBronResultaat(
                doelen.Select(d => new Minimumdoel(d.Ref, d.Leeftijd, d.Nr, d.Omschrijving)).ToList(),
                []);

        public void Faal(OpstapBronFout fout) => _antwoord = () => throw fout;

        public Task<MinimumdoelBronResultaat> HaalOpAsync(CancellationToken cancellationToken = default) =>
            Task.FromResult(_antwoord());
    }
}
