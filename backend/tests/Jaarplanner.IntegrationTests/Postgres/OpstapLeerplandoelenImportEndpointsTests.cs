using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using ClosedXML.Excel;
using Jaarplanner.Api.Infrastructure;
using Jaarplanner.Application.Curriculum;
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
        Assert.True(eerste.GetProperty("schrijftIets").GetBoolean());
        Assert.Equal("1.2", _bron.GevraagdeVersie);
        Assert.True(Discipline(tweede, "2").GetProperty("diff").GetProperty("isLeeg").GetBoolean());
        Assert.False(tweede.GetProperty("schrijftIets").GetBoolean());
        Assert.Equal("1.2", tweede.GetProperty("vorigeVersie").GetProperty("versie").GetString());

        await using var context = _db.MaakContext();
        var doelen = await context.Leerplandoelen.OrderBy(l => l.Code).ToListAsync();
        Assert.Equal(["2.1.GL2.1", "2.1.GL3.10", "2.5.GL6.6"], doelen.Select(l => l.Code).ToArray());
        Assert.Null(doelen[0].MinimumdoelRef);
        Assert.Equal(["4-2.1.7", "6-2.5.4"], doelen.Skip(1).Select(l => l.MinimumdoelRef!).ToArray());
        Assert.All(doelen, l => Assert.NotNull(l.OpstapSleutel));
        // One row: the second apply of the same snapshot wrote nothing, so it records no second version (E1-22, antagonist
        // round 1 MAJOR; until then this asserted two rows).
        var versie = Assert.Single(await context.Opstapversies.ToListAsync());
        Assert.Equal(("1.2", "8f470a12-231f-5817-7a8b-6582195e2583"), (versie.Versie, versie.Hash));
    }

    /// <summary>
    /// E1-22, antagonist round 1 MAJOR, on an API-only database: after a snapshot drops a goal and the apply flags it, a
    /// repeat fetch of that snapshot lists the goal as already gone, writes nothing, and a press anyway adds no version row.
    /// </summary>
    [PostgresFact]
    public async Task Een_herhaalde_ophaling_na_een_verdwenen_doel_heeft_niets_te_schrijven()
    {
        _bron.Geef(Wiskunde(G("2.1.GL3.10", "4-2.1.7"), G("2.1.GL3.11", "4-2.1.7")));
        await Post(Pad, new { versie = "1.2" });
        _bron.Geef(Wiskunde(G("2.1.GL3.10", "4-2.1.7")));
        var weg = await Post(Pad, new { versie = "1.2" });

        var herhaling = await Post($"{Pad}/voorbeeld", body: null);
        var toepassing = await Post(Pad, new { versie = "1.2" });

        Assert.Equal(["2.1.GL3.11"], Codes(Discipline(weg, "2").GetProperty("diff").GetProperty("verdwenen")));
        var diff = Discipline(herhaling, "2").GetProperty("diff");
        Assert.Empty(diff.GetProperty("verdwenen").EnumerateArray());
        Assert.Equal(["2.1.GL3.11"], Codes(diff.GetProperty("eerderVerdwenen")));
        Assert.False(diff.GetProperty("schrijftIets").GetBoolean());
        Assert.True(diff.GetProperty("isLeeg").GetBoolean());
        Assert.False(herhaling.GetProperty("schrijftIets").GetBoolean());
        Assert.False(toepassing.GetProperty("schrijftIets").GetBoolean());

        await using var context = _db.MaakContext();
        Assert.Equal(2, await context.Opstapversies.CountAsync());
        Assert.True((await context.Leerplandoelen.SingleAsync(l => l.Code == "2.1.GL3.11")).NietMeerInOpstap);
    }

    /// <summary>
    /// The same on a database with Excel history (the case the worklog first filed as a quirk): a G goal the Excel route
    /// loaded and KOV lacks is flagged by the first API import, and from then on is already gone.
    /// </summary>
    [PostgresFact]
    public async Task Na_een_exceldoel_dat_kov_niet_heeft_heeft_een_herhaalde_ophaling_niets_te_schrijven()
    {
        var excel = await VerstuurWerkboek("/api/opstap-import", "2.1.GK3.6");
        Assert.True(excel.IsSuccessStatusCode, await excel.Content.ReadAsStringAsync());
        _bron.Geef(Wiskunde(G("2.1.GL3.10", "4-2.1.7")));

        var api = await Post(Pad, new { versie = "1.2" });
        var herhaling = await Post($"{Pad}/voorbeeld", body: null);

        Assert.Equal(["2.1.GK3.6"], Codes(Discipline(api, "2").GetProperty("diff").GetProperty("verdwenen")));
        var diff = Discipline(herhaling, "2").GetProperty("diff");
        Assert.Equal(["2.1.GK3.6"], Codes(diff.GetProperty("eerderVerdwenen")));
        Assert.False(diff.GetProperty("schrijftIets").GetBoolean());
        Assert.False(herhaling.GetProperty("schrijftIets").GetBoolean());
    }

    /// <summary>
    /// Owner ruling 2026-09-13 "Reden tonen", on PostgreSQL: the apply stores a reason per minimumdoel from the snapshot,
    /// the register shows it on the row without a bucket, disciplines come in numeric order (2 before 10), and a repeat
    /// fetch has no reason left to change.
    /// </summary>
    [PostgresFact]
    public async Task Het_register_toont_de_reden_per_minimumdoel_zonder_leerplandoel_en_ordent_disciplines_als_getal()
    {
        await using (var context = _db.MaakContext())
        {
            context.Minimumdoelen.AddRange(
                new Minimumdoel("6-7.1.6", "6-", "7.1.6", "De leerlingen kunnen zwemmen."),
                new Minimumdoel("K-1.2.6", "K-", "1.2.6", "De kleuters kunnen luisteren."),
                new Minimumdoel("4-9.9.9", "4-", "9.9.9", "Een doel met een geweigerd leerplandoel."));
            await context.SaveChangesAsync();
        }

        _bron.Verwijzingen =
        [
            new MinimumdoelVerwijzing("6-7.1.6", "Z", Geweigerd: false),
            new MinimumdoelVerwijzing("4-9.9.9", "G", Geweigerd: true),
        ];
        _bron.Geef(
            Wiskunde(G("2.1.GL3.10", "4-2.1.7")),
            new LeerplandoelBronDiscipline("10", "Frans", [G("10.1.GL5.1", "6-2.5.4", jaarFase: "L5", discipline: "10")], [], [], []));

        var toepassing = await Post(Pad, new { versie = "1.2" });
        var register = await Get("/api/minimumdoelen?aantal=200");
        var herhaling = await Post($"{Pad}/voorbeeld", body: null);

        Assert.Equal(3, toepassing.GetProperty("aantalRedenenGewijzigd").GetInt32());
        var regels = register.GetProperty("regels").EnumerateArray().ToDictionary(r => r.GetProperty("ref").GetString()!);
        // One row per minimumdoel (TB-010). None of these five carries the decree's ordering, so all five sit in the group
        // without one; the order within a branch is pinned by MinimumdoelenQueryTests.
        Assert.Equal(5, register.GetProperty("totaal").GetInt32());
        Assert.Equal(1, regels["4-2.1.7"].GetProperty("aantalLeerplandoelen").GetInt32());
        Assert.Equal(["L5"], regels["6-2.5.4"].GetProperty("jaarFasen").EnumerateArray().Select(f => f.GetString()!).ToArray());
        Assert.Equal(JsonValueKind.Null, regels["4-2.1.7"].GetProperty("zonderLeerplandoelReden").ValueKind);
        Assert.Equal("DoelNietIngelezen", regels["4-9.9.9"].GetProperty("zonderLeerplandoelReden").GetString());
        Assert.Equal("AlleenOvergeslagenDoelsets", regels["6-7.1.6"].GetProperty("zonderLeerplandoelReden").GetString());
        Assert.Equal(["Z"], regels["6-7.1.6"].GetProperty("zonderLeerplandoelDoelsets").EnumerateArray().Select(s => s.GetString()!).ToArray());
        Assert.Equal("GeenDoelInOpstap", regels["K-1.2.6"].GetProperty("zonderLeerplandoelReden").GetString());
        Assert.Equal(0, herhaling.GetProperty("aantalRedenenGewijzigd").GetInt32());
        Assert.False(herhaling.GetProperty("schrijftIets").GetBoolean());
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
    /// <item>the minimumdoelen register lists that minimumdoel under the goal's discipline.</item>
    /// </list>
    /// Before E1-21 both were empty for want of a concorded goal. (Until E1-22 the register listed only minimumdoelen with
    /// a concorded goal; it now lists the others too, without a bucket, which
    /// <see cref="Het_register_toont_ook_de_minimumdoelen_zonder_ingeladen_leerplandoel"/> pins.)
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

    /// <summary>
    /// ADR-0032 decision 8, amended 2026-09-13 (antagonist round 1, MAJOR 1), on the real pipeline: after an API import an
    /// Op.stap Excel file answers 409 on the preview and on the apply, and the API's goals stay as they were. Without the
    /// refusal this Wiskunde row would have taken the Excel wording and lost its concordance, and the goal the file lacks
    /// would have been flagged as no longer in Op.stap.
    /// </summary>
    [PostgresFact]
    public async Task Na_een_api_import_weigert_de_excelroute_en_wijzigt_niets()
    {
        _bron.Geef(Wiskunde(G("2.1.GL3.10", "4-2.1.7"), G("2.1.GL2.1", minimumdoelRef: null)));
        await Post(Pad, new { versie = "1.2" });

        var voorbeeld = await VerstuurWerkboek("/api/opstap-import/voorbeeld");
        var toepassing = await VerstuurWerkboek("/api/opstap-import");

        foreach (var response in new[] { voorbeeld, toepassing })
        {
            Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
            var probleem = await response.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal(Probleemsoorten.OpstapExcelNaOpstapApi, probleem.GetProperty("type").GetString());
            Assert.Equal(OpstapImportFout.ExcelNaOpstapApi().Message, probleem.GetProperty("detail").GetString());
        }

        await using var context = _db.MaakContext();
        var doelen = await context.Leerplandoelen.OrderBy(l => l.Code).ToListAsync();
        Assert.Equal(["2.1.GL2.1", "2.1.GL3.10"], doelen.Select(l => l.Code).ToArray());
        Assert.All(doelen, l => Assert.False(l.NietMeerInOpstap));
        Assert.Equal("4-2.1.7", doelen[1].MinimumdoelRef);
        Assert.Equal("De leerlingen kunnen 2.1.GL3.10.", doelen[1].Tekst);
    }

    /// <summary>
    /// E1-04's "concordance is queryable", on the database and over rows the API path wrote (antagonist round 2, MINOR 5):
    /// <see cref="IConcordantieQuery"/> answers from a minimumdoel to its concorded goals and from a goal to its minimumdoel,
    /// and says "none" for a goal Op.stap concords to nothing.
    /// </summary>
    [PostgresFact]
    public async Task Na_de_import_beantwoordt_de_concordantie_beide_richtingen()
    {
        _bron.Geef(Wiskunde(G("2.1.GL3.10", "4-2.1.7"), G("2.1.GL3.11", "4-2.1.7"), G("2.1.GL2.1", minimumdoelRef: null)));
        await Post(Pad, new { versie = "1.2" });

        using var scope = _factory.Services.CreateScope();
        var concordantie = scope.ServiceProvider.GetRequiredService<IConcordantieQuery>();

        var doelen = await concordantie.LeerplandoelenVoorMinimumdoelAsync("4-2.1.7");
        var minimumdoel = await concordantie.MinimumdoelVoorLeerplandoelAsync("2.1.GL3.10");

        Assert.Equal(["2.1.GL3.10", "2.1.GL3.11"], doelen.Select(l => l.Code).ToArray());
        Assert.NotNull(minimumdoel);
        Assert.Equal("4-2.1.7", minimumdoel.Ref);
        Assert.Equal("De leerlingen kunnen tellen tot 1000.", minimumdoel.Omschrijving);
        Assert.Null(await concordantie.MinimumdoelVoorLeerplandoelAsync("2.1.GL2.1"));
        Assert.Empty(await concordantie.LeerplandoelenVoorMinimumdoelAsync("6-2.5.4"));
    }

    /// <summary>
    /// E1-22: the state the import screen orders its flow by. Before an apply it names the stored minimumdoelen and no
    /// version, which is the condition under which the screen still offers the Excel upload; after one it names the
    /// snapshot, the condition under which the Excel route refuses. It reads our database only, so the fake source is
    /// never asked.
    /// </summary>
    [PostgresFact]
    public async Task De_stand_noemt_de_minimumdoelen_en_de_laatst_doorgevoerde_versie()
    {
        _bron.Geef(Wiskunde(G("2.1.GL3.10", "4-2.1.7")));

        var ervoor = await Get("/api/opstap-import/stand");
        var aanroepenErvoor = _bron.Aanroepen;
        await Post(Pad, new { versie = "1.2" });
        var erna = await Get("/api/opstap-import/stand");

        Assert.Equal(0, aanroepenErvoor);
        Assert.Equal(2, ervoor.GetProperty("aantalMinimumdoelen").GetInt32());
        Assert.Equal(JsonValueKind.Null, ervoor.GetProperty("laatsteVersie").ValueKind);
        Assert.Equal(2, erna.GetProperty("aantalMinimumdoelen").GetInt32());
        Assert.Equal("1.2", erna.GetProperty("laatsteVersie").GetProperty("versie").GetString());
        Assert.Equal("8f470a12-231f-5817-7a8b-6582195e2583", erna.GetProperty("laatsteVersie").GetProperty("hash").GetString());
    }

    /// <summary>
    /// E1-22 on the database the ordering and the null handling depend on: a minimumdoel no loaded goal concords (here
    /// <c>6-2.5.4</c>, as <c>6-7.1.6</c> and five others are in snapshot 1.2, ADR-0032 decision 5) is listed once, after the
    /// concorded ones and without a bucket; a search finds it; a taxonomy filter drops it; and the facets count
    /// minimumdoelen, with no empty option. Before the leerplandoelen import both are listed that way.
    /// </summary>
    [PostgresFact]
    public async Task Het_register_toont_ook_de_minimumdoelen_zonder_ingeladen_leerplandoel()
    {
        var voorDeImport = await Get("/api/minimumdoelen");
        Assert.Equal(2, voorDeImport.GetProperty("totaal").GetInt32());
        Assert.All(voorDeImport.GetProperty("regels").EnumerateArray(), r =>
            Assert.Equal(0, r.GetProperty("aantalLeerplandoelen").GetInt32()));

        _bron.Geef(Wiskunde(G("2.1.GL3.10", "4-2.1.7"), G("2.1.GL3.11", "4-2.1.7")));
        await Post(Pad, new { versie = "1.2" });

        var register = await Get("/api/minimumdoelen");
        var regels = register.GetProperty("regels").EnumerateArray().ToList();
        Assert.Equal(2, register.GetProperty("totaal").GetInt32());
        Assert.Equal(["4-2.1.7", "6-2.5.4"], regels.Select(r => r.GetProperty("ref").GetString()!).ToArray());
        Assert.Equal(2, regels[0].GetProperty("aantalLeerplandoelen").GetInt32());
        Assert.Equal(["L3"], regels[0].GetProperty("jaarFasen").EnumerateArray().Select(f => f.GetString()!).ToArray());
        Assert.Equal(0, regels[1].GetProperty("aantalLeerplandoelen").GetInt32());
        Assert.Empty(regels[1].GetProperty("jaarFasen").EnumerateArray());

        var zoek = await Get("/api/minimumdoelen?zoek=kansen");
        Assert.Equal(["6-2.5.4"], zoek.GetProperty("regels").EnumerateArray().Select(r => r.GetProperty("ref").GetString()!).ToArray());
        // The counts follow a search too (TB-010 AC5): the facets and the list share one filter, ILIKE included.
        var zoekFacetten = await Get("/api/minimumdoelen/facetten?zoek=kansen");
        Assert.Equal(1, zoekFacetten.GetProperty("aantalTreffers").GetInt32());
        // The fixture holds a 4- and a 6- minimumdoel; the chips offer the leeftijden that exist, counted under the search.
        Assert.Equal(
            ["4-:0", "6-:1"],
            zoekFacetten.GetProperty("leeftijden").EnumerateArray()
                .Select(l => $"{l.GetProperty("leeftijd").GetString()}:{l.GetProperty("aantal").GetInt32()}").ToArray());

        var gefilterd = await Get("/api/minimumdoelen?domein=Getallenkennis");
        Assert.Equal(["4-2.1.7"], gefilterd.GetProperty("regels").EnumerateArray().Select(r => r.GetProperty("ref").GetString()!).ToArray());

        // Neither fixture minimumdoel carries the decree's ordering, so the tree is empty and both sit apart (TB-010).
        var facetten = await Get("/api/minimumdoelen/facetten");
        Assert.Equal(2, facetten.GetProperty("totaalAantalMinimumdoelen").GetInt32());
        Assert.Equal(2, facetten.GetProperty("aantalTreffers").GetInt32());
        Assert.Equal(2, facetten.GetProperty("aantalZonderOrdening").GetInt32());
        Assert.Empty(facetten.GetProperty("leergebieden").EnumerateArray());

        var gefilterdeFacetten = await Get("/api/minimumdoelen/facetten?domein=Getallenkennis");
        Assert.Equal(1, gefilterdeFacetten.GetProperty("aantalTreffers").GetInt32());

        // The detail lists the concorded goals under their jaar/fase; a ref no minimumdoel carries is a 404.
        var detail = await Get("/api/minimumdoelen/4-2.1.7");
        var l3 = detail.GetProperty("jaarFasen").EnumerateArray().Single(f => f.GetProperty("jaarFase").GetString() == "L3");
        Assert.Equal(["2.1.GL3.10", "2.1.GL3.11"], l3.GetProperty("leerplandoelen").EnumerateArray().Select(l => l.GetProperty("code").GetString()!).ToArray());
        Assert.Equal("Wiskunde", l3.GetProperty("leerplandoelen")[0].GetProperty("disciplineNaam").GetString());
        var onbekend = await _factory.CreateClient().GetAsync("/api/minimumdoelen/K-9.9.9");
        Assert.Equal(HttpStatusCode.NotFound, onbekend.StatusCode);
    }

    /// <summary>
    /// Antagonist round 2, MINOR 1 (a), on PostgreSQL: a goal KOV dropped stays stored, flagged and concorded, so its
    /// minimumdoel keeps its place under the goal's discipline, gets no reason, and the preview counts no change.
    /// </summary>
    [PostgresFact]
    public async Task Een_minimumdoel_waar_een_opgeslagen_verdwenen_doel_naar_verwijst_houdt_zijn_plaats_zonder_reden()
    {
        _bron.Geef(Wiskunde(G("2.1.GL3.10", "4-2.1.7"), G("2.1.GL3.11", "6-2.5.4")));
        await Post(Pad, new { versie = "1.2" });
        _bron.Geef(Wiskunde(G("2.1.GL3.11", "6-2.5.4")));

        var voorbeeld = await Post($"{Pad}/voorbeeld", body: null);
        await Post(Pad, new { versie = "1.2" });
        var register = await Get("/api/minimumdoelen?zoek=4-2.1.7");

        Assert.Equal(["2.1.GL3.10"], Codes(Discipline(voorbeeld, "2").GetProperty("diff").GetProperty("verdwenen")));
        Assert.Equal(0, voorbeeld.GetProperty("aantalRedenenGewijzigd").GetInt32());
        var regel = Assert.Single(register.GetProperty("regels").EnumerateArray());
        // The dropped goal is still stored and concorded, so it still counts, and a minimumdoel with a goal has no reason.
        Assert.Equal(1, regel.GetProperty("aantalLeerplandoelen").GetInt32());
        Assert.Equal(JsonValueKind.Null, regel.GetProperty("zonderLeerplandoelReden").ValueKind);

        await using var context = _db.MaakContext();
        Assert.Null((await context.Minimumdoelen.SingleAsync(m => m.Ref == "4-2.1.7")).ZonderLeerplandoelReden);
        Assert.True((await context.Leerplandoelen.SingleAsync(l => l.Code == "2.1.GL3.10")).NietMeerInOpstap);
    }

    /// <summary>
    /// Antagonist round 2, MINOR 2, on PostgreSQL: a first apply in which no discipline writes (the snapshot's only
    /// discipline is one this application does not know) and no reason changes still records the version, is offered as
    /// something to write, and from then on the Excel route refuses (Art. VII.2).
    /// </summary>
    [PostgresFact]
    public async Task Een_eerste_toepassing_zonder_gewijzigd_doel_legt_de_versie_vast_en_sluit_de_excelroute()
    {
        _bron.Geef(new LeerplandoelBronDiscipline(
            "12",
            "Burgerschap",
            [G("12.1.GL1.1", "4-2.1.7", discipline: "12"), G("12.1.GL1.2", "6-2.5.4", discipline: "12")],
            [],
            [],
            []));

        var voorbeeld = await Post($"{Pad}/voorbeeld", body: null);
        var toepassing = await Post(Pad, new { versie = "1.2" });
        var excel = await VerstuurWerkboek("/api/opstap-import/voorbeeld");

        Assert.Equal(JsonValueKind.Null, voorbeeld.GetProperty("vorigeVersie").ValueKind);
        Assert.True(Discipline(voorbeeld, "12").GetProperty("diff").GetProperty("overgeslagen").GetBoolean());
        Assert.Equal(0, voorbeeld.GetProperty("aantalRedenenGewijzigd").GetInt32());
        Assert.True(voorbeeld.GetProperty("schrijftIets").GetBoolean());
        Assert.True(toepassing.GetProperty("toegepast").GetBoolean());
        Assert.Equal(HttpStatusCode.Conflict, excel.StatusCode);
        Assert.Equal(
            Probleemsoorten.OpstapExcelNaOpstapApi,
            (await excel.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("type").GetString());

        await using var context = _db.MaakContext();
        Assert.Equal("1.2", (await context.Opstapversies.SingleAsync()).Versie);
        Assert.Empty(await context.Leerplandoelen.ToListAsync());
    }

    /// <summary>One Wiskunde goal as the Op.stap Excel route carries it: its own wording, and no concordance in column D.</summary>
    private async Task<HttpResponseMessage> VerstuurWerkboek(string url, string code = "2.1.GL3.10")
    {
        using var werkboek = new XLWorkbook();
        var blad = werkboek.AddWorksheet("Leerplandoelen");
        blad.Cell(1, (int)OpstapKolom.Doelsoort).Value = "Doelsoort";
        blad.Cell(1, (int)OpstapKolom.Code).Value = "Code";
        blad.Cell(2, (int)OpstapKolom.Doelsoort).Value = "G";
        blad.Cell(2, (int)OpstapKolom.Code).Value = code;
        blad.Cell(2, (int)OpstapKolom.JaarFase).Value = "L3";
        blad.Cell(2, (int)OpstapKolom.Domein).Value = "Getallenkennis";
        blad.Cell(2, (int)OpstapKolom.Subdomein).Value = "Natuurlijke getallen";
        blad.Cell(2, (int)OpstapKolom.Tekst).Value = "Tekst uit Excel.";
        using var stroom = new MemoryStream();
        werkboek.SaveAs(stroom);

        using var inhoud = new MultipartFormDataContent();
        var bestand = new ByteArrayContent(stroom.ToArray());
        bestand.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        inhoud.Add(bestand, "bestand", "Wiskunde.xlsx");
        inhoud.Add(new StringContent("2"), "disciplineNummer");

        return await _factory.CreateClient().PostAsync(url, inhoud);
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
    /// An L3 class with a thema placed in its jaarplan, and its L3 subthema, carrying <paramref name="code"/> as a subdoel,
    /// placed in the agenda (Art. V.1).
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
        var subthema = thema.VoegSubthemaToe("Honderdtallen", 2, "L3");
        subthema.VoegSubdoelToe("L3", new DoelKoppeling(code, KoppelingStatus.Manueel));
        context.Themas.Add(thema);

        var jaarplan = new Jaarplan(klas.Id);
        jaarplan.VoegPlaatsingToe(
            thema.Id,
            JaarplanGeneratieService.GeneratieNiveau,
            indeling.Blokken(schooljaar, JaarplanGeneratieService.GeneratieNiveau)[0].Start,
            KoppelingStatus.Aanvaard,
            null);
        context.Jaarplannen.Add(jaarplan);
        context.Subthemaplaatsingen.Add(new Subthemaplaatsing(jaarplan.Id, subthema.Id, new DateOnly(2026, 9, 14), new DateOnly(2026, 9, 25)));

        await context.SaveChangesAsync();
        return klas.Id;
    }

    /// <summary>A source that answers whatever the test last told it to, or fails, and records what it was asked.</summary>
    private sealed class VasteBron : ILeerplandoelBron
    {
        private Func<LeerplandoelBronResultaat> _antwoord = () => throw new InvalidOperationException("no answer set");

        public string? GevraagdeVersie { get; private set; }

        public int Aanroepen { get; private set; }

        /// <summary>The goals that point at a minimumdoel without being imported (E1-22).</summary>
        public IReadOnlyList<MinimumdoelVerwijzing> Verwijzingen { get; set; } = [];

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
                    d.OvergeslagenDoelsets)).ToList(),
                Verwijzingen);

        public void Faal(OpstapBronFout fout) => _antwoord = () => throw fout;

        public Task<LeerplandoelBronResultaat> HaalOpAsync(string? versie, CancellationToken cancellationToken = default)
        {
            Aanroepen++;
            GevraagdeVersie = versie;
            return Task.FromResult(_antwoord());
        }
    }
}
