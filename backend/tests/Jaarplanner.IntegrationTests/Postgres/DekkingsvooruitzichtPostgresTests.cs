using Jaarplanner.Application.Ai;
using Jaarplanner.Application.Dekking;
using Jaarplanner.Application.Planning;
using Jaarplanner.Application.Planning.Generatie;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.Infrastructure.Dekking;
using Jaarplanner.Infrastructure.Persistence;
using Jaarplanner.Infrastructure.Planning;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.IntegrationTests.Postgres;

/// <summary>
/// The dekkingsvooruitzicht (E3-03, FR-5.3) over a <b>real generation run</b> against real PostgreSQL: the model
/// proposes, nothing is accepted, and the figures say both what the plan covers (nothing) and what accepting it would
/// cover.
/// <para>
/// <b>Why it has to run against Postgres and not only in memory</b> (E7-16): the outlook reads the link tables twice
/// with two different thema-id sets, over the same four-layer union E5-01 built — a <c>Concat</c> over projections of
/// owned collections, which is exactly the shape the EF in-memory provider evaluates in LINQ and Npgsql has already
/// once refused to translate ("set operation after client projection has been applied"). A green in-memory run would
/// therefore say nothing about whether the second read works at all.
/// </para>
/// <para>
/// The AI is the only stand-in (Art. IV.6). Everything else is production: the real generation service, the real
/// configured grid seam, the real EF storage ports, the real <see cref="DekkingService"/>.
/// </para>
/// </summary>
public sealed class DekkingsvooruitzichtPostgresTests : IAsyncLifetime
{
    private PostgresTestDatabase _db = null!;

    public async Task InitializeAsync()
    {
        if (!PostgresTestDatabase.IsBeschikbaar)
        {
            return;
        }

        _db = await PostgresTestDatabase.MaakAsync("vooruitzicht");
    }

    public async Task DisposeAsync()
    {
        if (_db is not null)
        {
            await _db.DisposeAsync();
        }
    }

    [PostgresFact]
    public async Task Een_echte_generatie_dekt_nog_niets_en_meldt_wat_aanvaarden_zou_opleveren()
    {
        // Two thema's, each carrying one of the class's three in-scope doelen; the third doel is carried by nothing, so
        // it is the gap no acceptance can close. The model is told to place both thema's.
        var seed = await SeedAsync();
        var blokken = Blokken(await LaadSchooljaarAsync(seed.KlasId));

        await using var context = _db.MaakContext();

        var generatie = new JaarplanGeneratieService(
            new VastAntwoordAiClient(
                $$"""
                {"plaatsingen":[
                  {"blokStart":"{{blokken[0].Start:yyyy-MM-dd}}","thema":"{{seed.HerfstNaam}}","motivatie":"seizoen"},
                  {"blokStart":"{{blokken[1].Start:yyyy-MM-dd}}","thema":"{{seed.WinterNaam}}","motivatie":"seizoen"}]}
                """),
            new GeconfigureerdePlanningsblokIndeling(new PlanningsblokOptions()),
            new EfJaarplanOpslag(context));

        var resultaat = await generatie.GenereerAsync(seed.KlasId);

        Assert.True(resultaat.IsGeslaagd);
        Assert.Equal(2, resultaat.AantalNieuw);

        // The composition the controller performs, on the same services it resolves from DI.
        var dekking = new DekkingService(generatie, new EfDekkingOpslag(context));
        var vooruitzicht = await dekking.BerekenVooruitzichtAsync(seed.KlasId);

        // FR-5.3, measured: nothing is covered (every placement is `voorgesteld`, Art. IV.1/V.1) and accepting the
        // proposal would cover two of the three doelen this L3 class is measured against.
        Assert.True(vooruitzicht.IsBetrouwbaar);
        Assert.Equal(0, vooruitzicht.AantalGedekt);
        Assert.Equal(2, vooruitzicht.AantalMogelijkGedekt);
        Assert.Equal(3, vooruitzicht.AantalLeerplandoelen);
        Assert.Equal(2, vooruitzicht.AantalWinstBijAanvaarden);

        // The gap that acceptance cannot close, which is the number FR-5.3 is actually about.
        Assert.Equal(1, vooruitzicht.AantalOnbereikbaar);

        // Measured against the class's own jaar/fase (owner ruling 2026-08-04), with the out-of-scope doel declared
        // rather than silently dropped from the denominator.
        Assert.Equal(Dekkingsbereik.EigenJaarFase, vooruitzicht.Bereik);
        Assert.Equal(["L3"], vooruitzicht.GemetenJaarFasen);
        Assert.Equal(1, vooruitzicht.AantalBuitenBereik);

        // And the decided figure is the same number the dekkingsoverzicht reports for this plan, through the same SQL.
        var echteDekking = await dekking.BerekenAsync(seed.KlasId);
        Assert.Equal(echteDekking.AantalGedekt, vooruitzicht.AantalGedekt);
        Assert.Equal(echteDekking.AantalLeerplandoelen, vooruitzicht.AantalLeerplandoelen);
    }

    [PostgresFact]
    public async Task Na_het_aanvaarden_van_een_voorstel_loopt_het_cijfer_naar_het_plafond_toe()
    {
        // The interaction E3-03 exists to make visible, on real rows: the ceiling is what the figure becomes as the
        // teacher decides. Verified by accepting ONE of two proposals, so the figure moves and the ceiling does not.
        var seed = await SeedAsync();
        var blokken = Blokken(await LaadSchooljaarAsync(seed.KlasId));

        await using var context = _db.MaakContext();

        var generatie = new JaarplanGeneratieService(
            new VastAntwoordAiClient(
                $$"""
                {"plaatsingen":[
                  {"blokStart":"{{blokken[0].Start:yyyy-MM-dd}}","thema":"{{seed.HerfstNaam}}","motivatie":"seizoen"},
                  {"blokStart":"{{blokken[1].Start:yyyy-MM-dd}}","thema":"{{seed.WinterNaam}}","motivatie":"seizoen"}]}
                """),
            new GeconfigureerdePlanningsblokIndeling(new PlanningsblokOptions()),
            new EfJaarplanOpslag(context));

        var plan = await generatie.GenereerAsync(seed.KlasId);
        var dekking = new DekkingService(generatie, new EfDekkingOpslag(context));

        var voor = await dekking.BerekenVooruitzichtAsync(seed.KlasId);
        Assert.Equal(0, voor.AantalGedekt);
        Assert.Equal(2, voor.AantalMogelijkGedekt);

        // One teacher decision, through the production path (Art. IV.1: only a human moves a placement off
        // `voorgesteld`).
        var eerste = plan.Jaarplan!.Plaatsingen.First();
        await generatie.WijzigPlaatsingStatusAsync(seed.KlasId, eerste.Id, KoppelingStatus.Aanvaard);

        var na = await dekking.BerekenVooruitzichtAsync(seed.KlasId);

        Assert.Equal(1, na.AantalGedekt);
        Assert.Equal(2, na.AantalMogelijkGedekt);
        Assert.Equal(1, na.AantalWinstBijAanvaarden);

        // The ceiling did not move, because accepting changes who stands behind a placement and not which doelen the
        // plan can reach. A ceiling that rose on acceptance would mean it was counting the wrong set.
        Assert.Equal(voor.AantalMogelijkGedekt, na.AantalMogelijkGedekt);
        Assert.Equal(voor.AantalOnbereikbaar, na.AantalOnbereikbaar);
    }

    /// <summary>
    /// A school year with one L3 class, three L3 doelen (two of them carried by a thema, one by nothing) plus one
    /// out-of-scope K3 doel, and two thema's. Names carry a guid because thema names are unique school-wide, and the
    /// generation contract keys a proposal on the <b>name</b>.
    /// </summary>
    private async Task<(Guid KlasId, string HerfstNaam, string WinterNaam)> SeedAsync()
    {
        await using var context = _db.MaakContext();

        var schooljaar = TestSchooljaar.MetVakanties(TestSchooljaar.UniekeNaam("vooruit"));
        var klas = schooljaar.VoegKlasToe($"L3-{Guid.NewGuid():N}", leerjaar: 3);
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

        // Accepted links, because only aanvaard/manueel links count (Art. V.1) — a `voorgesteld` link would make this
        // test pass for the wrong reason, by making the ceiling 0 as well as the figure.
        var herfst = new Thema($"Herfst-{Guid.NewGuid():N}", duurWeken: 5);
        herfst.VoegThemadoelToe(new DoelKoppeling(herfstCode, KoppelingStatus.Aanvaard, "anchor"));
        var winter = new Thema($"Winter-{Guid.NewGuid():N}", duurWeken: 5);
        winter.VoegThemadoelToe(new DoelKoppeling(winterCode, KoppelingStatus.Aanvaard, "anchor"));
        context.Themas.AddRange(herfst, winter);

        await context.SaveChangesAsync();

        return (klas.Id, herfst.Naam, winter.Naam);
    }

    private async Task<Schooljaar> LaadSchooljaarAsync(Guid klasId)
    {
        await using var context = _db.MaakContext();
        var klas = await context.Klassen.SingleAsync(k => k.Id == klasId);

        return await context.Schooljaren
            .Include("_sluitingen")
            .SingleAsync(s => s.Id == klas.SchooljaarId);
    }

    /// <summary>The same configured grid seam the API resolves, so no period boundary is hard-coded.</summary>
    private static IReadOnlyList<Planningsblok> Blokken(Schooljaar schooljaar) =>
        new GeconfigureerdePlanningsblokIndeling(new PlanningsblokOptions())
            .Blokken(schooljaar, Planningsblokniveau.Themaperiode);

    /// <summary>A model stand-in that always answers the same canned completion: no network (Art. IV.6).</summary>
    private sealed class VastAntwoordAiClient : IAiClient
    {
        private readonly string _antwoord;

        public VastAntwoordAiClient(string antwoord) => _antwoord = antwoord;

        public Task<AiCompletion> CompleteAsync(AiRequest request, CancellationToken cancellationToken = default) =>
            Task.FromResult(new AiCompletion { Content = _antwoord });
    }
}
