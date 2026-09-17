using System.Net;
using System.Net.Http.Json;
using Jaarplanner.Application.Dekking;
using Jaarplanner.Application.Planning.Generatie;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.Infrastructure.Dekking;
using Jaarplanner.Infrastructure.Planning;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.IntegrationTests.Postgres;

/// <summary>
/// The dekkingsvooruitzicht (E3-03, FR-5.3) over <b>open AI proposals</b> against real PostgreSQL: nothing is accepted,
/// and the figures say both what the plan covers and what accepting it would cover. Since ADR-0052 a thema placement
/// reaches no leerplandoel, so the forecast is over minimumdoelen (TB-052); a subthema placed in the agenda moves the
/// leerplandoel figure.
/// <para>
/// The generation is switched off (ADR-0053 decision 9), so the proposals are seeded as a run left them: placements
/// with status <c>Voorgesteld</c> and a motivation. Everything that reads them is production: the planning service, the
/// EF storage ports and <see cref="DekkingService"/>.
/// </para>
/// <para>
/// <b>Why it has to run against Postgres</b> (E7-16): the outlook reads the link tables twice with two different
/// thema-id sets, over a <c>Concat</c> of owned-collection projections that the EF in-memory provider evaluates in LINQ
/// and Npgsql has already once refused to translate.
/// </para>
/// </summary>
public sealed class DekkingsvooruitzichtPostgresTests : IAsyncLifetime
{
    private PostgresTestDatabase _db = null!;
    private PostgresApiFactory _factory = null!;

    public async Task InitializeAsync()
    {
        if (!PostgresTestDatabase.IsBeschikbaar)
        {
            return;
        }

        _db = await PostgresTestDatabase.MaakAsync("vooruitzicht");
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

    /// <summary>
    /// The figures reach the HTTP boundary through the DI-resolved service, the real queries and the serialiser.
    /// </summary>
    [PostgresFact]
    public async Task Het_vooruitzicht_haalt_de_HTTP_grens_met_zijn_minimumdoelcijfers()
    {
        var seed = await SeedAsync();
        await VoegVoorstellenToeAsync(seed.KlasId, seed.HerfstId);

        var response = await _factory.CreateClient()
            .GetAsync($"/api/klassen/{seed.KlasId}/dekking/voortgang");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var vooruitzicht = await response.Content.ReadFromJsonAsync<VooruitzichtDto>();
        Assert.NotNull(vooruitzicht);
        Assert.Equal("EigenJaarFase", vooruitzicht!.Bereik);
        Assert.Equal(["L3"], vooruitzicht.GemetenJaarFasen);
        Assert.Equal(3, vooruitzicht.AantalLeerplandoelen);
        Assert.Equal(0, vooruitzicht.AantalGedekt);
        Assert.Equal(0, vooruitzicht.AantalMinimumdoelenGedekt);
        Assert.Equal(2, vooruitzicht.AantalMinimumdoelenMogelijkGedekt);
        Assert.Equal(3, vooruitzicht.AantalMinimumdoelen);
    }

    /// <summary>
    /// The route a leerplandoel is covered by (Art. V.1): the subthema in the klas's agenda, whatever the thema
    /// placement's status.
    /// </summary>
    [PostgresFact]
    public async Task Een_ingepland_subthema_telt_bij_een_open_voorstel_in_het_leerplandoelcijfer()
    {
        var seed = await SeedAsync();
        await VoegVoorstellenToeAsync(seed.KlasId, seed.HerfstId);

        await using (var context = _db.MaakContext())
        {
            var jaarplanId = await context.Jaarplannen.Where(j => j.KlasId == seed.KlasId).Select(j => j.Id).SingleAsync();
            var van = new DateOnly(2026, 9, 7);
            context.Subthemaplaatsingen.Add(new Subthemaplaatsing(jaarplanId, seed.HerfstSubthemaId, van, van.AddDays(11)));
            await context.SaveChangesAsync();
        }

        await using var lees = _db.MaakContext();
        var vooruitzicht = await MaakDekking(lees).BerekenVooruitzichtAsync(seed.KlasId);

        Assert.Equal(3, vooruitzicht.AantalLeerplandoelen);
        Assert.Equal(1, vooruitzicht.AantalGedekt);
        Assert.Equal(0, vooruitzicht.AantalMinimumdoelenGedekt);
    }

    /// <summary>
    /// Two open proposals and no subthema in the agenda: nothing is covered, and accepting the proposals would cover
    /// every minimumdoel their thema's carry, each once.
    /// </summary>
    [PostgresFact]
    public async Task Open_voorstellen_dekken_nog_niets_en_melden_wat_aanvaarden_zou_opleveren()
    {
        var seed = await SeedAsync();
        await VoegVoorstellenToeAsync(seed.KlasId, seed.HerfstId, seed.WinterId);

        await using var context = _db.MaakContext();
        var dekking = MaakDekking(context);
        var vooruitzicht = await dekking.BerekenVooruitzichtAsync(seed.KlasId);

        Assert.True(vooruitzicht.IsBetrouwbaar);
        Assert.Equal(0, vooruitzicht.AantalGedekt);
        Assert.Equal(3, vooruitzicht.AantalLeerplandoelen);
        Assert.Equal(0, vooruitzicht.AantalMinimumdoelenGedekt);
        Assert.Equal(3, vooruitzicht.AantalMinimumdoelenMogelijkGedekt);
        Assert.Equal(3, vooruitzicht.AantalMinimumdoelen);

        Assert.Equal(Dekkingsbereik.EigenJaarFase, vooruitzicht.Bereik);
        Assert.Equal(["L3"], vooruitzicht.GemetenJaarFasen);
        Assert.Equal(1, vooruitzicht.AantalBuitenBereik);

        var echteDekking = await dekking.BerekenAsync(seed.KlasId);
        Assert.Equal(echteDekking.AantalGedekt, vooruitzicht.AantalGedekt);
        Assert.Equal(echteDekking.AantalLeerplandoelen, vooruitzicht.AantalLeerplandoelen);
        Assert.Equal(echteDekking.AantalMinimumdoelen, vooruitzicht.AantalMinimumdoelen);
    }

    /// <summary>
    /// Accepting one of two proposals covers its minimumdoelen, leaves the ceiling where it was because the shared
    /// minimumdoel counts once, and moves no leerplandoel figure (ADR-0052).
    /// </summary>
    [PostgresFact]
    public async Task Het_aanvaarden_van_een_themavoorstel_dekt_zijn_minimumdoelen_en_geen_leerplandoel()
    {
        var seed = await SeedAsync();
        await VoegVoorstellenToeAsync(seed.KlasId, seed.HerfstId, seed.WinterId);

        await using var context = _db.MaakContext();
        var planning = new JaarplanService(new EfJaarplanOpslag(context));
        var dekking = new DekkingService(planning, new EfDekkingOpslag(context));

        var voor = await dekking.BerekenVooruitzichtAsync(seed.KlasId);
        Assert.Equal(0, voor.AantalGedekt);
        Assert.Equal(0, voor.AantalMinimumdoelenGedekt);
        Assert.Equal(3, voor.AantalMinimumdoelenMogelijkGedekt);

        var herfst = (await planning.HaalJaarplanAsync(seed.KlasId)).Plaatsingen.Single(p => p.ThemaId == seed.HerfstId);
        await planning.WijzigPlaatsingStatusAsync(seed.KlasId, herfst.Id, KoppelingStatus.Aanvaard);

        var na = await dekking.BerekenVooruitzichtAsync(seed.KlasId);

        Assert.Equal(0, na.AantalGedekt);
        Assert.Equal(2, na.AantalMinimumdoelenGedekt);
        Assert.Equal(3, na.AantalMinimumdoelenMogelijkGedekt);
    }

    private sealed record VooruitzichtDto(
        string Bereik,
        List<string> GemetenJaarFasen,
        int AantalLeerplandoelen,
        int? AantalGedekt,
        int? AantalMinimumdoelenGedekt,
        int? AantalMinimumdoelenMogelijkGedekt,
        int AantalMinimumdoelen);

    private static DekkingService MaakDekking(Jaarplanner.Infrastructure.Persistence.AppDbContext context) =>
        new(new JaarplanService(new EfJaarplanOpslag(context)), new EfDekkingOpslag(context));

    /// <summary>
    /// The proposals a generation run left behind: one open placement per thema, one after another from September.
    /// </summary>
    private async Task VoegVoorstellenToeAsync(Guid klasId, params Guid[] themaIds)
    {
        await using var context = _db.MaakContext();
        var jaarplan = new Jaarplan(klasId);
        var van = new DateOnly(2026, 9, 7);
        foreach (var themaId in themaIds)
        {
            // Three weeks each, clear of the herfstvakantie (2–8 November), so no proposal is vervallen.
            jaarplan.VoegPlaatsingToe(themaId, van, van.AddDays(18), KoppelingStatus.Voorgesteld, "seizoen");
            van = van.AddDays(35);
        }

        context.Jaarplannen.Add(jaarplan);
        await context.SaveChangesAsync();
    }

    /// <summary>
    /// A school year with one L3 class, three L3 doelen (two of them subdoelen of an L3 subthema of a thema, one carried
    /// by nothing) plus one out-of-scope K3 doel, and two thema's. Three minimumdoelen of the 4- mijlpaal: Herfst
    /// carries the first two, Winter the last two, so the middle one is shared. A K- minimumdoel is out of scope.
    /// </summary>
    private async Task<(Guid KlasId, Guid HerfstId, Guid WinterId, Guid HerfstSubthemaId)> SeedAsync()
    {
        await using var context = _db.MaakContext();

        var schooljaar = TestSchooljaar.MetVakanties(TestSchooljaar.UniekeNaam("vooruit"));
        var klas = schooljaar.VoegKlasToe($"L3-{Guid.NewGuid():N}", "L3");
        context.Schooljaren.Add(schooljaar);

        var herfstCode = $"L3H-{Guid.NewGuid():N}"[..12];
        var winterCode = $"L3W-{Guid.NewGuid():N}"[..12];
        var wezenCode = $"L3X-{Guid.NewGuid():N}"[..12];
        var kleuterCode = $"K3X-{Guid.NewGuid():N}"[..12];

        foreach (var (code, jaarFase) in new[]
                 {
                     (herfstCode, "L3"),
                     (winterCode, "L3"),
                     // In scope and carried by nothing: the lacune that accepting everything still leaves.
                     (wezenCode, "L3"),
                     // Out of scope for an L3 class, so it must not reach the denominator (owner ruling 2026-08-04).
                     (kleuterCode, "K3"),
                 })
        {
            context.Leerplandoelen.Add(new Leerplandoel(
                code, Doelsoort.Gemeenschappelijk, jaarFase, "Natuur", "Levende natuur", "9.1",
                tekst: $"Tekst van {code}"));
        }

        // Decided links, because only aanvaard/manueel links count (Art. V.1).
        var herfst = new Thema($"Herfst-{Guid.NewGuid():N}", duurWeken: 5);
        var herfstSubthema = herfst.VoegSubthemaToe("Bladeren", 2, "L3");
        herfstSubthema.VoegSubdoelToe("L3", new DoelKoppeling(herfstCode, KoppelingStatus.Manueel));
        var winter = new Thema($"Winter-{Guid.NewGuid():N}", duurWeken: 5);
        winter.VoegSubthemaToe("Sneeuw", 2, "L3").VoegSubdoelToe("L3", new DoelKoppeling(winterCode, KoppelingStatus.Manueel));
        context.Themas.AddRange(herfst, winter);

        string[] minimumdoelRefs = ["VRT-4-1", "VRT-4-2", "VRT-4-3"];
        foreach (var minimumdoelRef in minimumdoelRefs)
        {
            context.Minimumdoelen.Add(new Minimumdoel(minimumdoelRef, "4-", "1", $"Tekst van {minimumdoelRef}"));
        }

        context.Minimumdoelen.Add(new Minimumdoel("VRT-K-1", "K-", "1", "Tekst van VRT-K-1"));
        context.ThemaMinimumdoelen.AddRange(
            herfst.KoppelMinimumdoel("VRT-4-1"),
            herfst.KoppelMinimumdoel("VRT-4-2"),
            winter.KoppelMinimumdoel("VRT-4-2"),
            winter.KoppelMinimumdoel("VRT-4-3"),
            winter.KoppelMinimumdoel("VRT-K-1"));

        await context.SaveChangesAsync();

        return (klas.Id, herfst.Id, winter.Id, herfstSubthema.Id);
    }
}
