using Jaarplanner.Application.Planning;
using Jaarplanner.Application.Planning.Weekplanning;
using Jaarplanner.Application.Schoolcontent.Beheer;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.Infrastructure.Planning;

namespace Jaarplanner.UnitTests.Planning;

/// <summary>
/// E9-03: <see cref="WeekplanningService"/> — the day-level planning use cases (FR-6.2/FR-7.2).
/// <para>
/// Runs entirely against <see cref="FakeWeekplanningOpslag"/>, so the whole flow is exercised with <b>no database</b>
/// (Art. IV.6). The real grid seam is used rather than a fake one, because "does this activiteit fall outside its
/// thema's period" is only meaningful against the blocks the board actually draws.
/// </para>
/// </summary>
public sealed class WeekplanningServiceTests
{
    private static readonly IPlanningsblokIndeling Indeling =
        new GeconfigureerdePlanningsblokIndeling(new PlanningsblokOptions());

    private static readonly Guid ActiviteitId = Guid.NewGuid();
    private static readonly Guid SubthemaId = Guid.NewGuid();
    private static readonly Guid ThemaId = Guid.NewGuid();

    /// <summary>A Wednesday well inside the school year, and open in every fixture here.</summary>
    private static readonly DateOnly Woensdag = new(2026, 9, 9);

    private static Activiteitinhoud Inhoud(Guid klasId, Guid? activiteitId = null, Guid? themaId = null) =>
        new(
            ActiviteitId: activiteitId ?? ActiviteitId,
            Naam: "Bladeren zoeken",
            ActiviteitType: nameof(ActiviteitType.Hoek),
            SubthemaId: SubthemaId,
            SubthemaNaam: "Herfstbladeren",
            KlasId: klasId,
            Leeftijd: "K3",
            ThemaId: themaId ?? ThemaId,
            ThemaNaam: "Herfst",
            Doelcodes: ["NAT-K3-01"]);

    private static (WeekplanningService Service, FakeWeekplanningOpslag Opslag, Klas Klas, Schooljaar Schooljaar) Maak(
        Schooljaar? schooljaar = null,
        Jaarplan? jaarplan = null,
        IEnumerable<Activiteitinhoud>? inhoud = null)
    {
        var jaar = schooljaar ?? TestSchooljaar.MetVakanties();
        var klas = jaar.VoegKlasToe("K3 derde kleuterklas", 0);
        var opslag = new FakeWeekplanningOpslag(klas, jaar, inhoud ?? [Inhoud(klas.Id)], jaarplan);

        return (new WeekplanningService(opslag, Indeling), opslag, klas, jaar);
    }

    [Fact]
    public async Task Een_activiteit_wordt_manueel_op_een_lesdag_gepland()
    {
        var (service, opslag, klas, _) = Maak();

        var week = await service.PlanActiviteitAsync(klas.Id, ActiviteitId, Woensdag, volgorde: 0);

        var dag = Assert.Single(week.Dagen, d => d.Datum == Woensdag);
        var gepland = Assert.Single(dag.Activiteiten);
        Assert.Equal("Bladeren zoeken", gepland.ActiviteitNaam);
        Assert.Equal("Herfstbladeren", gepland.SubthemaNaam);
        Assert.Equal("Herfst", gepland.ThemaNaam);

        // Manueel, never Voorgesteld: nothing here proposes anything, so there is no status for a teacher to review
        // (Art. IV.2). A Voorgesteld placement would also be replaceable, i.e. quietly discardable.
        Assert.Equal(nameof(KoppelingStatus.Manueel), gepland.Status);
        Assert.Equal(1, opslag.AantalKeerBewaard);
    }

    /// <summary>
    /// The response is the ISO week (Monday–Sunday) containing the affected day, so a client never re-fetches after a
    /// drag. Monday is the week start because a Flemish school week is.
    /// </summary>
    [Fact]
    public async Task De_teruggegeven_week_loopt_van_maandag_tot_zondag()
    {
        var (service, _, klas, _) = Maak();

        var week = await service.PlanActiviteitAsync(klas.Id, ActiviteitId, Woensdag, volgorde: 0);

        Assert.Equal(new DateOnly(2026, 9, 7), week.Van);
        Assert.Equal(new DateOnly(2026, 9, 13), week.Tot);
        Assert.Equal(7, week.Dagen.Count);
        Assert.Equal(DayOfWeek.Monday, week.Dagen[0].Datum.DayOfWeek);
    }

    /// <summary>
    /// A vakantie day takes nothing, and the refusal <b>names the closure the school entered itself</b> — refusing
    /// without it would leave a teacher looking at a day their own calendar calls ordinary.
    /// </summary>
    [Fact]
    public async Task Een_vakantiedag_wordt_geweigerd_met_de_naam_van_de_sluiting()
    {
        var (service, opslag, klas, _) = Maak();

        var fout = await Assert.ThrowsAsync<OngeldigeDagplanningFout>(() =>
            service.PlanActiviteitAsync(klas.Id, ActiviteitId, new DateOnly(2026, 11, 3), volgorde: 0));

        Assert.Contains("Herfstvakantie", fout.Message, StringComparison.Ordinal);

        // Dutch d MMMM yyyy, never the ISO string the thema move path leaks and gets away with only because no screen
        // renders it. A teacher reads "3 november 2026".
        Assert.Contains("3 november 2026", fout.Message, StringComparison.Ordinal);
        Assert.DoesNotContain("2026-11-03", fout.Message, StringComparison.Ordinal);

        // Nothing was persisted, which is the assertion that matters: a refusal must leave the plan untouched.
        Assert.Equal(0, opslag.AantalKeerBewaard);
    }

    /// <summary>
    /// Kept apart from the closure case because the teacher acts differently: there is no closure to name, and the
    /// remedy is "you are looking at the wrong school year" rather than "pick another day".
    /// </summary>
    [Fact]
    public async Task Een_dag_buiten_het_schooljaar_wordt_apart_geweigerd()
    {
        var (service, opslag, klas, _) = Maak();

        var fout = await Assert.ThrowsAsync<OngeldigeDagplanningFout>(() =>
            service.PlanActiviteitAsync(klas.Id, ActiviteitId, new DateOnly(2027, 7, 14), volgorde: 0));

        Assert.Contains("buiten schooljaar", fout.Message, StringComparison.Ordinal);
        Assert.Equal(0, opslag.AantalKeerBewaard);
    }

    /// <summary>
    /// Art. IX.2 makes the class scope structural. Checked <b>before</b> the day, because a teacher aiming another
    /// class's activiteit at a closed day should be told the thing that is wrong whatever day they pick.
    /// </summary>
    [Fact]
    public async Task Een_activiteit_van_een_andere_klas_wordt_geweigerd_voor_de_dagcontrole()
    {
        var vreemdeActiviteit = Guid.NewGuid();
        var schooljaar = TestSchooljaar.MetVakanties();
        var klas = schooljaar.VoegKlasToe("K3 derde kleuterklas", 0);
        var opslag = new FakeWeekplanningOpslag(
            klas, schooljaar, [Inhoud(klas.Id), Inhoud(Guid.NewGuid(), vreemdeActiviteit)]);
        var service = new WeekplanningService(opslag, Indeling);

        // A vakantie day AND a foreign activiteit: the class error is the one reported.
        var fout = await Assert.ThrowsAsync<OngeldigeDagplanningFout>(() =>
            service.PlanActiviteitAsync(klas.Id, vreemdeActiviteit, new DateOnly(2026, 11, 3), volgorde: 0));

        Assert.Contains("andere klas", fout.Message, StringComparison.Ordinal);
        Assert.DoesNotContain("Herfstvakantie", fout.Message, StringComparison.Ordinal);
        Assert.Equal(0, opslag.AantalKeerBewaard);
    }

    [Fact]
    public async Task Een_onbekende_activiteit_is_een_404()
    {
        var (service, _, klas, _) = Maak();

        await Assert.ThrowsAsync<SchoolcontentNietGevondenFout>(() =>
            service.PlanActiviteitAsync(klas.Id, Guid.NewGuid(), Woensdag, volgorde: 0));
    }

    /// <summary>
    /// A teacher may plan a day before any thema has been placed. Refusing would make the week view unusable on a
    /// fresh class, and nothing in FR-6/FR-7 requires a generated plan first.
    /// </summary>
    [Fact]
    public async Task Een_klas_zonder_jaarplan_krijgt_er_een_bij_de_eerste_dagplanning()
    {
        var (service, opslag, klas, _) = Maak();
        Assert.Null(opslag.Jaarplan);

        await service.PlanActiviteitAsync(klas.Id, ActiviteitId, Woensdag, volgorde: 0);

        Assert.NotNull(opslag.Jaarplan);
        Assert.Single(opslag.Jaarplan!.Activiteitplaatsingen);
    }

    /// <summary>
    /// Dropping a card back where it came from must not be an error. Only a <i>different</i> placement already on the
    /// target day is a genuine duplicate.
    /// </summary>
    [Fact]
    public async Task Een_verplaatsing_naar_dezelfde_dag_is_geen_duplicaat()
    {
        var (service, opslag, klas, _) = Maak();
        var week = await service.PlanActiviteitAsync(klas.Id, ActiviteitId, Woensdag, volgorde: 0);
        var plaatsingId = week.Dagen.SelectMany(d => d.Activiteiten).Single().PlaatsingId;

        var na = await service.VerplaatsActiviteitAsync(klas.Id, plaatsingId, Woensdag, volgorde: 3);

        var gepland = Assert.Single(Assert.Single(na.Dagen, d => d.Datum == Woensdag).Activiteiten);
        Assert.Equal(3, gepland.Volgorde);
        Assert.Equal(2, opslag.AantalKeerBewaard);
    }

    /// <summary>
    /// <b>The re-placement route off a day the school has since closed.</b> The placement's current day is never
    /// validated, only the target — the same shape as the thema move path, and for the same reason: the application
    /// must never have to guess a position for something it is repairing.
    /// </summary>
    [Fact]
    public async Task Een_activiteit_op_een_dag_die_gesloten_werd_kan_nog_verplaatst_worden()
    {
        var schooljaar = TestSchooljaar.Maak();
        var (service, opslag, klas, _) = Maak(schooljaar);
        var week = await service.PlanActiviteitAsync(klas.Id, ActiviteitId, Woensdag, volgorde: 0);
        var plaatsingId = week.Dagen.SelectMany(d => d.Activiteiten).Single().PlaatsingId;

        // The school declares that Wednesday a free day after the fact.
        schooljaar.VoegSluitingToe(
            new Schoolsluiting("Pedagogische studiedag", Woensdag, Woensdag, Sluitingssoort.VrijeDag));

        var na = await service.VerplaatsActiviteitAsync(klas.Id, plaatsingId, new DateOnly(2026, 9, 10), volgorde: 0);

        Assert.Single(Assert.Single(na.Dagen, d => d.Datum == new DateOnly(2026, 9, 10)).Activiteiten);
        Assert.Empty(Assert.Single(na.Dagen, d => d.Datum == Woensdag).Activiteiten);
    }

    /// <summary>
    /// A closed day is <b>returned with its closure named, never omitted</b>. A week view that silently dropped
    /// Herfstvakantie would show a short week with no explanation and no way to tell it from a rendering bug — and
    /// naming the closure is also what makes the refusal predictable rather than surprising (the E3-06 rule: a
    /// withheld control states its reason in visible text).
    /// </summary>
    [Fact]
    public async Task Gesloten_dagen_blijven_in_de_week_staan_met_hun_sluitingsnaam()
    {
        var (service, _, klas, _) = Maak();

        var week = await service.HaalWeekplanningAsync(klas.Id, new DateOnly(2026, 11, 2), new DateOnly(2026, 11, 8));

        Assert.Equal(7, week.Dagen.Count);
        Assert.All(week.Dagen, d => Assert.False(d.IsLesdag));
        Assert.All(week.Dagen, d => Assert.Equal("Herfstvakantie", d.Sluitingsnaam));
    }

    /// <summary>
    /// The range is <b>clamped</b> to the school year rather than refused: the week containing the first school day
    /// legitimately reaches back past 1 September, and refusing it would make that week unrenderable.
    /// </summary>
    [Fact]
    public async Task Een_bereik_buiten_het_schooljaar_wordt_geklemd_niet_geweigerd()
    {
        var (service, _, klas, schooljaar) = Maak();

        var week = await service.HaalWeekplanningAsync(klas.Id, new DateOnly(2026, 8, 24), new DateOnly(2026, 9, 6));

        Assert.Equal(schooljaar.Start, week.Van);
        Assert.Equal(new DateOnly(2026, 9, 6), week.Tot);
    }

    /// <summary>
    /// An activiteit scheduled outside its thema's period is <b>reported, never refused</b> (E9-03's stated invariant).
    /// A teacher who front-loads one activiteit is not making a mistake, and refusing it would be the tool inventing a
    /// rule the school never stated.
    /// </summary>
    [Fact]
    public async Task Een_activiteit_buiten_de_periode_van_haar_thema_wordt_gemeld_niet_geweigerd()
    {
        var schooljaar = TestSchooljaar.MetVakanties();
        var blokken = Indeling.Blokken(schooljaar, Planningsblokniveau.Themaperiode);
        var jaarplan = new Jaarplan(Guid.NewGuid());

        // The thema sits in the SECOND themaperiode; the activiteit is scheduled in the first.
        jaarplan.VoegPlaatsingToe(ThemaId, Planningsblokniveau.Themaperiode, blokken[1].Start, KoppelingStatus.Aanvaard);

        var klas = schooljaar.VoegKlasToe("K3 derde kleuterklas", 0);
        var eigenPlan = new Jaarplan(klas.Id);
        eigenPlan.VoegPlaatsingToe(ThemaId, Planningsblokniveau.Themaperiode, blokken[1].Start, KoppelingStatus.Aanvaard);
        var opslag = new FakeWeekplanningOpslag(klas, schooljaar, [Inhoud(klas.Id)], eigenPlan);
        var service = new WeekplanningService(opslag, Indeling);

        var dagInEerstePeriode = blokken[0].Start.AddDays(2);
        var week = await service.PlanActiviteitAsync(klas.Id, ActiviteitId, dagInEerstePeriode, volgorde: 0);

        var gepland = Assert.Single(week.Dagen.SelectMany(d => d.Activiteiten));
        Assert.True(gepland.ValtBuitenThemaperiode);
    }

    /// <summary>
    /// The mirror of the test above: inside its own period, nothing is flagged.
    /// </summary>
    [Fact]
    public async Task Een_activiteit_binnen_de_periode_van_haar_thema_wordt_niet_gemeld()
    {
        var schooljaar = TestSchooljaar.MetVakanties();
        var blokken = Indeling.Blokken(schooljaar, Planningsblokniveau.Themaperiode);
        var klas = schooljaar.VoegKlasToe("K3 derde kleuterklas", 0);
        var plan = new Jaarplan(klas.Id);
        plan.VoegPlaatsingToe(ThemaId, Planningsblokniveau.Themaperiode, blokken[0].Start, KoppelingStatus.Aanvaard);
        var service = new WeekplanningService(
            new FakeWeekplanningOpslag(klas, schooljaar, [Inhoud(klas.Id)], plan), Indeling);

        var week = await service.PlanActiviteitAsync(klas.Id, ActiviteitId, blokken[0].Start.AddDays(2), volgorde: 0);

        Assert.False(Assert.Single(week.Dagen.SelectMany(d => d.Activiteiten)).ValtBuitenThemaperiode);
    }

    /// <summary>
    /// <b>A rejected thema placement is not a period.</b> Measuring an activiteit against it would report a mismatch
    /// with a period the thema is not in — and the groepschat record of 2026-08-19 is explicit that folding a rejected
    /// placement in with the others is a copy defect that reached a teacher once already (E5-05 MAJOR-1, which touched
    /// E3-07 and E4-03).
    /// <para>
    /// With the thema's only placement rejected there is no period at all, so the flag is <c>false</c> — "no mismatch
    /// to report" — rather than <c>true</c>. Reporting a mismatch against nothing is the thing this guards.
    /// </para>
    /// </summary>
    [Fact]
    public async Task Een_geweigerde_themaplaatsing_levert_geen_periode_om_tegen_te_meten()
    {
        var schooljaar = TestSchooljaar.MetVakanties();
        var blokken = Indeling.Blokken(schooljaar, Planningsblokniveau.Themaperiode);
        var klas = schooljaar.VoegKlasToe("K3 derde kleuterklas", 0);
        var plan = new Jaarplan(klas.Id);
        plan.VoegPlaatsingToe(ThemaId, Planningsblokniveau.Themaperiode, blokken[1].Start, KoppelingStatus.Geweigerd);
        var service = new WeekplanningService(
            new FakeWeekplanningOpslag(klas, schooljaar, [Inhoud(klas.Id)], plan), Indeling);

        var week = await service.PlanActiviteitAsync(klas.Id, ActiviteitId, blokken[0].Start.AddDays(2), volgorde: 0);

        Assert.False(Assert.Single(week.Dagen.SelectMany(d => d.Activiteiten)).ValtBuitenThemaperiode);
    }

    /// <summary>
    /// A thema placed in several periods keeps the <b>widest</b> span, so an activiteit inside any of them is not
    /// reported as outside. Measuring against only the first would flag correct scheduling as a mismatch.
    /// </summary>
    [Fact]
    public async Task Een_thema_in_twee_periodes_dekt_beide()
    {
        var schooljaar = TestSchooljaar.MetVakanties();
        var blokken = Indeling.Blokken(schooljaar, Planningsblokniveau.Themaperiode);
        var klas = schooljaar.VoegKlasToe("K3 derde kleuterklas", 0);
        var plan = new Jaarplan(klas.Id);
        plan.VoegPlaatsingToe(ThemaId, Planningsblokniveau.Themaperiode, blokken[0].Start, KoppelingStatus.Aanvaard);
        plan.VoegPlaatsingToe(ThemaId, Planningsblokniveau.Themaperiode, blokken[2].Start, KoppelingStatus.Aanvaard);
        var service = new WeekplanningService(
            new FakeWeekplanningOpslag(klas, schooljaar, [Inhoud(klas.Id)], plan), Indeling);

        var week = await service.PlanActiviteitAsync(klas.Id, ActiviteitId, blokken[1].Start.AddDays(1), volgorde: 0);

        // Between the two, so inside the widened span.
        Assert.False(Assert.Single(week.Dagen.SelectMany(d => d.Activiteiten)).ValtBuitenThemaperiode);
    }

    /// <summary>
    /// Removing a placement returns the week it <i>was</i> in, so the client can redraw without re-fetching — and the
    /// day is captured before the removal, since afterwards the placement has no day to ask for.
    /// </summary>
    [Fact]
    public async Task Verwijderen_geeft_de_week_terug_waar_de_activiteit_stond()
    {
        var (service, opslag, klas, _) = Maak();
        var week = await service.PlanActiviteitAsync(klas.Id, ActiviteitId, Woensdag, volgorde: 0);
        var plaatsingId = week.Dagen.SelectMany(d => d.Activiteiten).Single().PlaatsingId;

        var na = await service.VerwijderActiviteitplaatsingAsync(klas.Id, plaatsingId);

        Assert.Equal(new DateOnly(2026, 9, 7), na.Van);
        Assert.Empty(na.Dagen.SelectMany(d => d.Activiteiten));
        Assert.Empty(opslag.Jaarplan!.Activiteitplaatsingen);
    }

    [Fact]
    public async Task Een_onbekende_klas_is_een_404()
    {
        var (service, _, _, _) = Maak();

        await Assert.ThrowsAsync<SchoolcontentNietGevondenFout>(() =>
            service.HaalWeekplanningAsync(Guid.NewGuid(), Woensdag, Woensdag));
    }

    /// <summary>
    /// The doelcodes an activiteit carries are surfaced <b>for display only</b>. Art. V.1 makes a doel gedekt through
    /// the <i>thema's</i> placement, so scheduling the activiteit onto a Wednesday changes nothing in coverage. The
    /// read model carries no count, no percentage and no gedekt flag, and this test pins that absence — a figure here
    /// would let the calendar grant coverage twice for the same content.
    /// </summary>
    [Fact]
    public async Task De_weekplanning_bevat_doelcodes_maar_geen_dekkingscijfer()
    {
        var (service, _, klas, _) = Maak();

        var week = await service.PlanActiviteitAsync(klas.Id, ActiviteitId, Woensdag, volgorde: 0);

        Assert.Equal(["NAT-K3-01"], Assert.Single(week.Dagen.SelectMany(d => d.Activiteiten)).Doelcodes);

        var velden = typeof(GeplandeActiviteitWeergave).GetProperties().Select(p => p.Name).ToList();
        Assert.DoesNotContain("IsGedekt", velden);
        Assert.DoesNotContain("AantalGedekt", velden);
        Assert.DoesNotContain("Dekkingspercentage", velden);

        var weekVelden = typeof(Weekplanningweergave).GetProperties().Select(p => p.Name).ToList();
        Assert.DoesNotContain("AantalGedekt", weekVelden);
        Assert.DoesNotContain("Dekkingspercentage", weekVelden);
    }
}
