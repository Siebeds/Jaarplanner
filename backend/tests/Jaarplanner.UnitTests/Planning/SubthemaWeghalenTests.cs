using Jaarplanner.Application.Planning.Weekplanning;
using Jaarplanner.Application.Schoolcontent.Beheer;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;

namespace Jaarplanner.UnitTests.Planning;

/// <summary>
/// FB-096: a teacher takes a planned subthema out of the agenda, and its window and its activiteiten on those days go
/// together, while what belongs to another subthema stays. The counts the confirmation shows come from the same
/// selection the delete uses.
/// </summary>
public sealed class SubthemaWeghalenTests
{
    private static readonly Guid Herfst = Guid.NewGuid();
    private static readonly Guid Winter = Guid.NewGuid();
    private static readonly Guid Bladeren = Guid.NewGuid();
    private static readonly Guid Eekhoorn = Guid.NewGuid();
    private static readonly Guid Sneeuw = Guid.NewGuid();

    private static readonly DateOnly Maandag = new(2026, 9, 7);
    private static readonly DateOnly Woensdag = new(2026, 9, 9);
    private static readonly DateOnly Vrijdag = new(2026, 9, 11);

    private static Activiteitinhoud Inhoud(Guid activiteitId, Guid subthemaId, string naam) =>
        new(activiteitId, naam, ActiviteitType.Hoek, subthemaId, naam, "K3", Guid.NewGuid(), "Seizoenen", []);

    private static (WeekplanningService Service, FakeWeekplanningOpslag Opslag, Klas Klas) Maak()
    {
        var jaar = TestSchooljaar.MetVakanties();
        var klas = jaar.VoegKlasToe("K3 derde kleuterklas", "K3");
        var opslag = new FakeWeekplanningOpslag(
            klas,
            jaar,
            [Inhoud(Bladeren, Herfst, "Herfst"), Inhoud(Eekhoorn, Herfst, "Herfst"), Inhoud(Sneeuw, Winter, "Winter")]);

        return (new WeekplanningService(opslag), opslag, klas);
    }

    private static async Task PlanAsync(WeekplanningService service, Klas klas, Guid activiteitId, DateOnly dag) =>
        await service.PlanActiviteitAsync(klas.Id, activiteitId, dag, new TimeOnly(9, 0), new TimeOnly(9, 50));

    [Fact]
    public async Task De_periode_en_haar_activiteiten_gaan_samen_weg_en_de_rest_blijft()
    {
        var (service, opslag, klas) = Maak();
        await service.PlaatsSubthemaAsync(klas.Id, Herfst, Maandag, Vrijdag);
        await PlanAsync(service, klas, Bladeren, Maandag);
        await PlanAsync(service, klas, Eekhoorn, Woensdag);
        await PlanAsync(service, klas, Sneeuw, Woensdag);

        var gevolg = await service.BekijkSubthemaWeghalingAsync(klas.Id, Herfst, Maandag, Vrijdag);
        Assert.Equal(new Subthemaweghaling(2, 0, HeeftPeriode: true, BlijftElders: false), gevolg);

        var week = await service.HaalSubthemaWegAsync(klas.Id, Herfst, Maandag, Vrijdag);

        var plan = opslag.Jaarplan!;
        Assert.Empty(plan.Subthemaplaatsingen);
        Assert.Equal([Sneeuw], plan.Activiteitplaatsingen.Select(p => p.ActiviteitId));
        Assert.Empty(week.Subthemaperiodes);
        Assert.Equal("Winter", Assert.Single(week.Dagen.SelectMany(d => d.Activiteiten)).ActiviteitNaam);
    }

    [Fact]
    public async Task Een_periode_zonder_activiteiten_telt_er_nul()
    {
        var (service, opslag, klas) = Maak();
        await service.PlaatsSubthemaAsync(klas.Id, Herfst, Maandag, Vrijdag);

        var gevolg = await service.BekijkSubthemaWeghalingAsync(klas.Id, Herfst, Maandag, Vrijdag);

        Assert.Equal(0, gevolg.AantalActiviteiten);
        Assert.True(gevolg.HeeftPeriode);
        await service.HaalSubthemaWegAsync(klas.Id, Herfst, Maandag, Vrijdag);
        Assert.Empty(opslag.Jaarplan!.Subthemaplaatsingen);
    }

    /// <summary>Only a window makes the goals count (ADR-0047), so a second one elsewhere keeps them counting.</summary>
    [Fact]
    public async Task Een_tweede_periode_van_hetzelfde_subthema_blijft_staan()
    {
        var (service, opslag, klas) = Maak();
        var later = new DateOnly(2026, 9, 21);
        await service.PlaatsSubthemaAsync(klas.Id, Herfst, Maandag, Vrijdag);
        await service.PlaatsSubthemaAsync(klas.Id, Herfst, later, later.AddDays(4));
        await PlanAsync(service, klas, Bladeren, later);

        var gevolg = await service.BekijkSubthemaWeghalingAsync(klas.Id, Herfst, Maandag, Vrijdag);
        Assert.True(gevolg.BlijftElders);
        Assert.Equal(0, gevolg.AantalActiviteiten);

        await service.HaalSubthemaWegAsync(klas.Id, Herfst, Maandag, Vrijdag);

        Assert.Equal(later, Assert.Single(opslag.Jaarplan!.Subthemaplaatsingen).Van);
        Assert.Single(opslag.Jaarplan.Activiteitplaatsingen);
    }

    /// <summary>A run drawn from its activiteiten alone has no window: it goes, and nothing about dekking is claimed.</summary>
    [Fact]
    public async Task Een_reeks_zonder_opgeslagen_periode_haalt_alleen_de_activiteiten_weg()
    {
        var (service, opslag, klas) = Maak();
        await PlanAsync(service, klas, Bladeren, Woensdag);

        var gevolg = await service.BekijkSubthemaWeghalingAsync(klas.Id, Herfst, Woensdag, Woensdag);
        Assert.Equal(new Subthemaweghaling(1, 0, HeeftPeriode: false, BlijftElders: false), gevolg);

        await service.HaalSubthemaWegAsync(klas.Id, Herfst, Woensdag, Woensdag);
        Assert.Empty(opslag.Jaarplan!.Activiteitplaatsingen);
    }

    /// <summary>The band is the union of window and activiteiten, so a window reaching past the stretch takes its days.</summary>
    [Fact]
    public async Task Een_periode_die_verder_loopt_neemt_haar_eigen_dagen_mee()
    {
        var (service, opslag, klas) = Maak();
        await service.PlaatsSubthemaAsync(klas.Id, Herfst, Maandag, Vrijdag);
        await PlanAsync(service, klas, Bladeren, Vrijdag);

        await service.HaalSubthemaWegAsync(klas.Id, Herfst, Maandag, Maandag);

        Assert.Empty(opslag.Jaarplan!.Subthemaplaatsingen);
        Assert.Empty(opslag.Jaarplan.Activiteitplaatsingen);
    }

    [Fact]
    public async Task De_hoekverrijkingen_van_de_periode_worden_geteld_en_gaan_mee()
    {
        var (service, opslag, klas) = Maak();
        await service.PlaatsSubthemaAsync(klas.Id, Herfst, Maandag, Vrijdag);
        var venster = Assert.Single(opslag.Jaarplan!.Subthemaplaatsingen);
        opslag.Hoekverrijkingen[venster.Id] = 3;

        Assert.Equal(3, (await service.BekijkSubthemaWeghalingAsync(klas.Id, Herfst, Maandag, Vrijdag)).AantalHoekverrijkingen);

        await service.HaalSubthemaWegAsync(klas.Id, Herfst, Maandag, Vrijdag);
        Assert.Empty(opslag.Hoekverrijkingen);
    }

    [Fact]
    public async Task Niets_van_het_subthema_op_die_dagen_is_niet_gevonden_en_bewaart_niets()
    {
        var (service, opslag, klas) = Maak();
        await PlanAsync(service, klas, Sneeuw, Woensdag);
        var bewaard = opslag.AantalKeerBewaard;

        await Assert.ThrowsAsync<SchoolcontentNietGevondenFout>(
            () => service.HaalSubthemaWegAsync(klas.Id, Herfst, Maandag, Vrijdag));
        await Assert.ThrowsAsync<SchoolcontentNietGevondenFout>(
            () => service.BekijkSubthemaWeghalingAsync(klas.Id, Herfst, Maandag, Vrijdag));

        Assert.Equal(bewaard, opslag.AantalKeerBewaard);
        Assert.Single(opslag.Jaarplan!.Activiteitplaatsingen);
    }
}
