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
/// and the figures say both what the plan covers (nothing) and what accepting it would cover.
/// <para>
/// The generation is switched off (ADR-0049 decision 9), so the proposals are seeded as a run left them: placements
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
    /// The figures reach the HTTP boundary through the DI-resolved service, the real queries and the serialiser,
    /// including the derived <c>aantalOnbereikbaar</c> getter that a serialisation policy could silently drop.
    /// </summary>
    [PostgresFact]
    public async Task Het_vooruitzicht_haalt_de_HTTP_grens_met_zijn_afgeleide_cijfers()
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
        Assert.Equal(1, vooruitzicht.AantalMogelijkGedekt);
        Assert.Equal(2, vooruitzicht.AantalOnbereikbaar);
    }

    /// <summary>
    /// The ceiling widens the PLACEMENT status set, not the LINK filter (aanvaard/manueel), which lives in SQL inside
    /// <c>EfDekkingOpslag</c>: a placed thema's unaccepted suggestion raises nothing.
    /// </summary>
    [PostgresFact]
    public async Task Een_nog_niet_aanvaarde_doelsuggestie_verhoogt_het_plafond_niet()
    {
        var seed = await SeedAsync();

        await using (var context = _db.MaakContext())
        {
            // A third L3 doel, carried by the placed thema through an UNACCEPTED suggestion.
            var suggestieCode = $"L3S-{Guid.NewGuid():N}"[..12];
            context.Leerplandoelen.Add(new Leerplandoel(
                suggestieCode, Doelsoort.Gemeenschappelijk, "L3", "Natuur", "Levende natuur", "9.1",
                tekst: $"Tekst van {suggestieCode}"));

            var herfst = await context.Themas.SingleAsync(t => t.Id == seed.HerfstId);
            herfst.VoegDoelsuggestieToe(new DoelKoppeling(suggestieCode, KoppelingStatus.Voorgesteld, "AI stelde dit voor"));
            await context.SaveChangesAsync();
        }

        await VoegVoorstellenToeAsync(seed.KlasId, seed.HerfstId);

        await using var lees = _db.MaakContext();
        var vooruitzicht = await MaakDekking(lees).BerekenVooruitzichtAsync(seed.KlasId);

        Assert.Equal(4, vooruitzicht.AantalLeerplandoelen);
        Assert.Equal(1, vooruitzicht.AantalMogelijkGedekt);
        Assert.Equal(3, vooruitzicht.AantalOnbereikbaar);
    }

    /// <summary>
    /// Two open proposals: nothing is covered and accepting them would cover two of the three doelen in scope; the
    /// third is the gap no acceptance closes.
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
        Assert.Equal(2, vooruitzicht.AantalMogelijkGedekt);
        Assert.Equal(3, vooruitzicht.AantalLeerplandoelen);
        Assert.Equal(1, vooruitzicht.AantalOnbereikbaar);

        Assert.Equal(Dekkingsbereik.EigenJaarFase, vooruitzicht.Bereik);
        Assert.Equal(["L3"], vooruitzicht.GemetenJaarFasen);
        Assert.Equal(1, vooruitzicht.AantalBuitenBereik);

        var echteDekking = await dekking.BerekenAsync(seed.KlasId);
        Assert.Equal(echteDekking.AantalGedekt, vooruitzicht.AantalGedekt);
        Assert.Equal(echteDekking.AantalLeerplandoelen, vooruitzicht.AantalLeerplandoelen);
    }

    /// <summary>
    /// Accepting ONE of two proposals moves the figure and not the ceiling: accepting changes who stands behind a
    /// placement, not which doelen the plan can reach.
    /// </summary>
    [PostgresFact]
    public async Task Na_het_aanvaarden_van_een_voorstel_loopt_het_cijfer_naar_het_plafond_toe()
    {
        var seed = await SeedAsync();
        await VoegVoorstellenToeAsync(seed.KlasId, seed.HerfstId, seed.WinterId);

        await using var context = _db.MaakContext();
        var planning = new JaarplanService(new EfJaarplanOpslag(context));
        var dekking = new DekkingService(planning, new EfDekkingOpslag(context));

        var voor = await dekking.BerekenVooruitzichtAsync(seed.KlasId);
        Assert.Equal(0, voor.AantalGedekt);
        Assert.Equal(2, voor.AantalMogelijkGedekt);

        var eerste = (await planning.HaalJaarplanAsync(seed.KlasId)).Plaatsingen.First();
        await planning.WijzigPlaatsingStatusAsync(seed.KlasId, eerste.Id, KoppelingStatus.Aanvaard);

        var na = await dekking.BerekenVooruitzichtAsync(seed.KlasId);

        Assert.Equal(1, na.AantalGedekt);
        Assert.Equal(2, na.AantalMogelijkGedekt);
        Assert.Equal(voor.AantalMogelijkGedekt, na.AantalMogelijkGedekt);
        Assert.Equal(voor.AantalOnbereikbaar, na.AantalOnbereikbaar);
    }

    private sealed record VooruitzichtDto(
        string Bereik,
        List<string> GemetenJaarFasen,
        int AantalLeerplandoelen,
        int? AantalGedekt,
        int? AantalMogelijkGedekt,
        int? AantalOnbereikbaar);

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
    /// A school year with one L3 class, three L3 doelen (two of them carried by a thema, one by nothing) plus one
    /// out-of-scope K3 doel, and two thema's.
    /// </summary>
    private async Task<(Guid KlasId, Guid HerfstId, Guid WinterId)> SeedAsync()
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

        // Accepted links, because only aanvaard/manueel links count (Art. V.1).
        var herfst = new Thema($"Herfst-{Guid.NewGuid():N}", duurWeken: 5);
        herfst.VoegDoelsuggestieToe(new DoelKoppeling(herfstCode, KoppelingStatus.Voorgesteld, "past")).WijzigStatus(KoppelingStatus.Aanvaard);
        var winter = new Thema($"Winter-{Guid.NewGuid():N}", duurWeken: 5);
        winter.VoegDoelsuggestieToe(new DoelKoppeling(winterCode, KoppelingStatus.Voorgesteld, "past")).WijzigStatus(KoppelingStatus.Aanvaard);
        context.Themas.AddRange(herfst, winter);

        await context.SaveChangesAsync();

        return (klas.Id, herfst.Id, winter.Id);
    }
}
