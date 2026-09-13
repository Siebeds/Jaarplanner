using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Jaarplanner.Api.Infrastructure;
using Jaarplanner.Application.Curriculum.Import;
using Jaarplanner.Application.Planning;
using Jaarplanner.Application.Planning.Generatie;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.Infrastructure.OpstapImport;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Jaarplanner.IntegrationTests.Postgres;

/// <summary>
/// E1-21 over HTTP against real PostgreSQL: the leerplandoelen import from KOV's API through
/// <c>POST /api/opstap-import/leerplandoelen</c> and its preview.
/// <para>
/// <b>What is faked and what is not.</b> Only the source is replaced, by a fixed snapshot, because CI must not depend on
/// KOV's uptime; the live API has its own opt-in tests (<c>CurriculumApiLiveContractTests</c>, and
/// <see cref="OpstapApiLiveImportTests"/> for the whole path into this database). Everything from the controller to the
/// table is real, including the DI registration (<see cref="De_echte_bron_is_geregistreerd"/>), the Restrict FKs and the
/// transaction that makes an apply all-or-nothing, which the in-memory provider cannot show.
/// </para>
/// </summary>
public sealed class OpstapLeerplandoelenImportEndpointsTests : IAsyncLifetime
{
    private const string Pad = "/api/opstap-import/leerplandoelen";

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

        _db = await PostgresTestDatabase.MaakAsync("leerplandoelimport");
        _basis = new PostgresApiFactory(_db.ConnectionString);
        _factory = _basis.WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
        {
            foreach (var registratie in services.Where(d => d.ServiceType == typeof(ILeerplandoelBron)).ToList())
            {
                services.Remove(registratie);
            }

            services.AddSingleton<ILeerplandoelBron>(_bron);
        }));

        // The decreed minimumdoelen the fixed snapshot concords to, as E1-12's import leaves them.
        await using var context = _db.MaakContext();
        context.Minimumdoelen.AddRange(
            new Minimumdoel("4-2.1.7", "4-", "2.1.7", "De leerlingen kunnen tellen tot 1000."),
            new Minimumdoel("6-2.5.4", "6-", "2.5.4", "De leerlingen kunnen kansen berekenen."));
        await context.SaveChangesAsync();
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

        Assert.IsType<CurriculumApiBron>(scope.ServiceProvider.GetRequiredService<ILeerplandoelBron>());
        Assert.IsType<LeerplandoelImportService>(scope.ServiceProvider.GetRequiredService<ILeerplandoelImportService>());
    }

    [PostgresFact]
    public async Task Het_voorbeeld_schrijft_niets_en_noemt_de_versie()
    {
        _bron.Geef(Wiskunde(G("2.1.GL3.10", "4-2.1.7")));

        var antwoord = await Post($"{Pad}/voorbeeld", body: null);

        Assert.False(antwoord.GetProperty("toegepast").GetBoolean());
        Assert.Equal("1.2", antwoord.GetProperty("versie").GetString());
        Assert.Equal("8f470a12-231f-5817-7a8b-6582195e2583", antwoord.GetProperty("hash").GetString());
        Assert.Equal(JsonValueKind.Null, antwoord.GetProperty("vorigeVersie").ValueKind);
        Assert.Equal(["2.1.GL3.10"], Codes(Discipline(antwoord, "2").GetProperty("diff").GetProperty("toegevoegd")));
        Assert.Null(_bron.GevraagdeVersie);

        await using var context = _db.MaakContext();
        Assert.Empty(await context.Leerplandoelen.ToListAsync());
        Assert.Empty(await context.Opstapversies.ToListAsync());
    }

    /// <summary>
    /// The done-when's core on the database that enforces it: G goals land concorded to the minimumdoelen (a Restrict FK),
    /// with their Op.stap key, and the version is recorded; importing the same version again changes nothing.
    /// </summary>
    [PostgresFact]
    public async Task De_toepassing_laadt_geconcordeerde_G_doelen_en_legt_de_versie_vast()
    {
        _bron.Geef(Wiskunde(G("2.1.GL3.10", "4-2.1.7"), G("2.5.GL6.6", "6-2.5.4", jaarFase: "L6"), G("2.1.GL2.1", minimumdoelRef: null)));

        var eerste = await Post(Pad, new { versie = "1.2" });
        var tweede = await Post(Pad, new { versie = "1.2" });

        Assert.True(eerste.GetProperty("toegepast").GetBoolean());
        Assert.True(eerste.GetProperty("isVolledigVerwerkt").GetBoolean());
        Assert.Equal("1.2", _bron.GevraagdeVersie);
        Assert.True(Discipline(tweede, "2").GetProperty("diff").GetProperty("isLeeg").GetBoolean());
        Assert.Equal("1.2", tweede.GetProperty("vorigeVersie").GetProperty("versie").GetString());

        await using var context = _db.MaakContext();
        var doelen = await context.Leerplandoelen.OrderBy(l => l.Code).ToListAsync();
        Assert.Equal(["2.1.GL2.1", "2.1.GL3.10", "2.5.GL6.6"], doelen.Select(l => l.Code).ToArray());
        Assert.Null(doelen[0].MinimumdoelRef);
        Assert.Equal(["4-2.1.7", "6-2.5.4"], doelen.Skip(1).Select(l => l.MinimumdoelRef!).ToArray());
        Assert.All(doelen, l => Assert.NotNull(l.OpstapSleutel));
        var versies = await context.Opstapversies.ToListAsync();
        Assert.Equal(2, versies.Count);
        Assert.All(versies, v => Assert.Equal(("1.2", "8f470a12-231f-5817-7a8b-6582195e2583"), (v.Versie, v.Hash)));
    }

    [PostgresFact]
    public async Task Een_toepassing_zonder_geldige_versie_geeft_400_en_leest_de_bron_niet()
    {
        _bron.Geef(Wiskunde(G("2.1.GL3.10", "4-2.1.7")));

        var zonder = await _factory.CreateClient().PostAsync(Pad, content: null);
        var latest = await _factory.CreateClient().PostAsJsonAsync(Pad, new { versie = "latest" });
        var voorbeeld = await _factory.CreateClient().PostAsJsonAsync($"{Pad}/voorbeeld", new { versie = "1.2/../x" });

        Assert.Equal(HttpStatusCode.BadRequest, zonder.StatusCode);
        Assert.StartsWith("Geef de Op.stap-versie mee", await Detail(zonder), StringComparison.Ordinal);
        Assert.Equal(HttpStatusCode.BadRequest, latest.StatusCode);
        Assert.Equal("'latest' is geen Op.stap-versie. Een versie is een nummer zoals 1.2.", await Detail(latest));
        Assert.Equal(HttpStatusCode.BadRequest, voorbeeld.StatusCode);
        Assert.Equal(0, _bron.Aanroepen);
    }

    [PostgresFact]
    public async Task Een_onleesbare_bron_geeft_502_met_de_nederlandse_melding_en_wijzigt_niets()
    {
        _bron.Faal(new OpstapBronFout("GET https://api.katholiekonderwijs.vlaanderen/documents/x/snapshots/1.2/krcItems answered 503."));

        var response = await _factory.CreateClient().PostAsJsonAsync(Pad, new { versie = "1.2" });

        Assert.Equal(HttpStatusCode.BadGateway, response.StatusCode);
        var probleem = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(Probleemtitels.OpstapNietOpgehaald, probleem.GetProperty("title").GetString());
        Assert.Equal(OpstapBronFout.Melding, probleem.GetProperty("detail").GetString());
        // The English cause is for the log, never for the person who pressed the button.
        Assert.DoesNotContain("answered", probleem.GetRawText(), StringComparison.Ordinal);

        await using var context = _db.MaakContext();
        Assert.Empty(await context.Leerplandoelen.ToListAsync());
    }

    /// <summary>
    /// The transaction, on the only database that has one. Discipline 2 is written before discipline 3 is refused (a
    /// concordance to a minimumdoel that is not loaded); the 409 then says "er is niets gewijzigd", and that must be true
    /// of discipline 2 as well.
    /// </summary>
    [PostgresFact]
    public async Task Een_weigering_in_een_latere_discipline_draait_de_hele_toepassing_terug()
    {
        _bron.Geef(
            Wiskunde(G("2.1.GL3.10", "4-2.1.7")),
            new LeerplandoelBronDiscipline("3", "Wetenschap en techniek", [G("3.1.GL4.1", "6-9.9.9", discipline: "3")], [], [], []));

        var response = await _factory.CreateClient().PostAsJsonAsync(Pad, new { versie = "1.2" });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Contains("6-9.9.9", await Detail(response), StringComparison.Ordinal);
        await using var context = _db.MaakContext();
        Assert.Empty(await context.Leerplandoelen.ToListAsync());
        Assert.Empty(await context.Opstapversies.ToListAsync());
    }

    /// <summary>
    /// The first API import meets what the Excel route loaded: the same code is updated in place (and gets its key), and a
    /// P goal the G-only import does not take stays exactly as it was, not flagged "niet meer in Op.stap".
    /// </summary>
    [PostgresFact]
    public async Task Een_doel_uit_de_excelroute_wordt_bijgewerkt_en_een_P_doel_blijft_staan()
    {
        await using (var context = _db.MaakContext())
        {
            context.Leerplandoelen.AddRange(
                new Leerplandoel("2.1.GL3.10", Doelsoort.Gemeenschappelijk, "L3", "Getallenkennis", "Natuurlijke getallen", "2", tekst: "Tekst uit Excel."),
                new Leerplandoel("2.1.PF3.1", Doelsoort.Precurriculum, "F3", "Getallenkennis", "Natuurlijke getallen", "2", tekst: "Precurriculair."));
            await context.SaveChangesAsync();
        }

        _bron.Geef(new LeerplandoelBronDiscipline("2", "Wiskunde", [G("2.1.GL3.10", "4-2.1.7")], [], ["2.1.PF3.1"], [new DoelsetTelling("P", 1)]));

        var antwoord = await Post(Pad, new { versie = "1.2" });

        var diff = Discipline(antwoord, "2").GetProperty("diff");
        Assert.Equal(["2.1.GL3.10"], diff.GetProperty("gewijzigd").EnumerateArray().Select(w => w.GetProperty("code").GetString()!).ToArray());
        Assert.Equal(["2.1.PF3.1"], Codes(diff.GetProperty("buitenBereik")));
        Assert.Empty(Codes(diff.GetProperty("verdwenen")));
        Assert.Equal(1, antwoord.GetProperty("overgeslagenDoelsets")[0].GetProperty("aantal").GetInt32());

        await using var na = _db.MaakContext();
        var g = await na.Leerplandoelen.SingleAsync(l => l.Code == "2.1.GL3.10");
        Assert.Equal("De leerlingen kunnen 2.1.GL3.10.", g.Tekst);
        Assert.NotNull(g.OpstapSleutel);
        var p = await na.Leerplandoelen.SingleAsync(l => l.Code == "2.1.PF3.1");
        Assert.False(p.NietMeerInOpstap);
        Assert.Equal("Precurriculair.", p.Tekst);
    }

    /// <summary>
    /// How far minimumdoel level reaches after this story, stated rather than implied. There is no minimumdoel-level
    /// coverage computation yet (E5-04). What E1-21 makes true is its input:
    /// <list type="bullet">
    /// <item>a G goal a class covers now carries a ref to a decreed minimumdoel that exists;</item>
    /// <item>the minimumdoelen register, which only lists minimumdoelen with a concorded goal, lists it.</item>
    /// </list>
    /// Before E1-21 both were empty for want of a concorded goal.
    /// </summary>
    [PostgresFact]
    public async Task Na_de_import_draagt_een_gedekt_G_doel_zijn_minimumdoel_en_staat_dat_in_het_register()
    {
        _bron.Geef(Wiskunde(G("2.1.GL3.10", "4-2.1.7")));
        await Post(Pad, new { versie = "1.2" });
        var klasId = await ZetGeplaatstThemaOpAsync("2.1.GL3.10");

        var dekking = await Get($"/api/klassen/{klasId}/dekking");
        var register = await Get("/api/minimumdoelen?zoek=4-2.1.7");

        var doel = Assert.Single(dekking.GetProperty("doelen").EnumerateArray(), d => d.GetProperty("code").GetString() == "2.1.GL3.10");
        Assert.True(doel.GetProperty("isGedekt").GetBoolean());
        Assert.Equal("4-2.1.7", doel.GetProperty("minimumdoelRef").GetString());
        Assert.Equal(1, register.GetProperty("totaal").GetInt32());
        Assert.Contains("4-2.1.7", register.GetProperty("regels").GetRawText(), StringComparison.Ordinal);
    }

    private static LeerplandoelBronDiscipline Wiskunde(params Leerplandoel[] doelen) =>
        new("2", "Wiskunde", doelen, [], [], []);

    private static Leerplandoel G(string code, string? minimumdoelRef, string jaarFase = "L3", string discipline = "2") =>
        new(code, Doelsoort.Gemeenschappelijk, jaarFase, "Getallenkennis", "Natuurlijke getallen", discipline,
            tekst: $"De leerlingen kunnen {code}.", voorbeelden: "- een voorbeeld", minimumdoelRef: minimumdoelRef,
            opstapSleutel: Guid.NewGuid());

    private static JsonElement Discipline(JsonElement antwoord, string nummer) =>
        antwoord.GetProperty("disciplines").EnumerateArray().Single(d => d.GetProperty("disciplineNummer").GetString() == nummer);

    private static string[] Codes(JsonElement array) =>
        array.EnumerateArray().Select(c => c.GetString()!).OrderBy(c => c, StringComparer.Ordinal).ToArray();

    private async Task<JsonElement> Post(string url, object? body)
    {
        var client = _factory.CreateClient();
        var response = body is null ? await client.PostAsync(url, content: null) : await client.PostAsJsonAsync(url, body);
        Assert.True(response.IsSuccessStatusCode, $"{(int)response.StatusCode}: {await response.Content.ReadAsStringAsync()}");
        return await response.Content.ReadFromJsonAsync<JsonElement>();
    }

    private async Task<JsonElement> Get(string url)
    {
        var response = await _factory.CreateClient().GetAsync(url);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await response.Content.ReadFromJsonAsync<JsonElement>();
    }

    private static async Task<string> Detail(HttpResponseMessage response) =>
        (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("detail").GetString()!;

    /// <summary>
    /// An L3 class with a thema placed in its jaarplan, the thema carrying <paramref name="code"/> as an accepted themadoel.
    /// The block start comes from the real <see cref="IPlanningsblokIndeling"/>, as in <c>DekkingEndpointsTests</c>.
    /// </summary>
    private async Task<Guid> ZetGeplaatstThemaOpAsync(string code)
    {
        using var scope = _factory.Services.CreateScope();
        var indeling = scope.ServiceProvider.GetRequiredService<IPlanningsblokIndeling>();
        await using var context = _db.MaakContext();

        var schooljaar = new Schooljaar($"2026-2027-{Guid.NewGuid():N}"[..20], new DateOnly(2026, 9, 1), new DateOnly(2027, 6, 30));
        var klas = schooljaar.VoegKlasToe($"L3-{Guid.NewGuid():N}", "L3");
        context.Schooljaren.Add(schooljaar);

        var thema = new Thema("Getallen tot 1000", duurWeken: 5);
        thema.VoegThemadoelToe(new DoelKoppeling(code, KoppelingStatus.Aanvaard, "anchor"));
        context.Themas.Add(thema);

        var jaarplan = new Jaarplan(klas.Id);
        jaarplan.VoegPlaatsingToe(
            thema.Id,
            JaarplanGeneratieService.GeneratieNiveau,
            indeling.Blokken(schooljaar, JaarplanGeneratieService.GeneratieNiveau)[0].Start,
            KoppelingStatus.Aanvaard,
            null);
        context.Jaarplannen.Add(jaarplan);

        await context.SaveChangesAsync();
        return klas.Id;
    }

    /// <summary>A source that answers whatever the test last told it to, or fails, and records what it was asked.</summary>
    private sealed class VasteBron : ILeerplandoelBron
    {
        private Func<LeerplandoelBronResultaat> _antwoord = () => throw new InvalidOperationException("no answer set");

        public string? GevraagdeVersie { get; private set; }

        public int Aanroepen { get; private set; }

        public void Geef(params LeerplandoelBronDiscipline[] disciplines) =>
            _antwoord = () => new LeerplandoelBronResultaat(
                "1.2",
                "8f470a12-231f-5817-7a8b-6582195e2583",
                new DateTimeOffset(2026, 8, 27, 10, 3, 7, TimeSpan.Zero),
                "TOEGEVOEGD",
                // Fresh entities per call, as the real source returns.
                disciplines.Select(d => new LeerplandoelBronDiscipline(
                    d.DisciplineNummer,
                    d.DisciplineNaam,
                    d.Leerplandoelen.Select(l => new Leerplandoel(l.Code, l.Doelsoort, l.JaarFase, l.Domein, l.Subdomein,
                        l.DisciplineNummer, l.Cluster, l.Tekst, l.Voorbeelden, l.Toelichting, l.Woordenschat, l.MinimumdoelRef,
                        l.OpstapSleutel)).ToList(),
                    d.Problemen,
                    d.BuitenBereikCodes,
                    d.OvergeslagenDoelsets)).ToList());

        public void Faal(OpstapBronFout fout) => _antwoord = () => throw fout;

        public Task<LeerplandoelBronResultaat> HaalOpAsync(string? versie, CancellationToken cancellationToken = default)
        {
            Aanroepen++;
            GevraagdeVersie = versie;
            return Task.FromResult(_antwoord());
        }
    }
}
