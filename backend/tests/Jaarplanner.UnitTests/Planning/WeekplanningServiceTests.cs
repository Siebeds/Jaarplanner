using Jaarplanner.Application.Planning.Weekplanning;
using Jaarplanner.Application.Schoolcontent.Beheer;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;

namespace Jaarplanner.UnitTests.Planning;

/// <summary>
/// E9-03: <see cref="WeekplanningService"/> — the day-level planning use cases (FR-6.2/FR-7.2).
/// <para>
/// Runs entirely against <see cref="FakeWeekplanningOpslag"/>, so the whole flow is exercised with <b>no database</b>
/// (Art. IV.6). "Does this activiteit fall outside its thema" is measured against the placements' own days.
/// </para>
/// </summary>
public sealed class WeekplanningServiceTests
{
    private static readonly Guid ActiviteitId = Guid.NewGuid();
    private static readonly Guid SubthemaId = Guid.NewGuid();
    private static readonly Guid ThemaId = Guid.NewGuid();

    /// <summary>A Wednesday well inside the school year, and open in every fixture here.</summary>
    private static readonly DateOnly Woensdag = new(2026, 9, 9);

    /// <summary>The block most tests plan: nine to ten to ten. Clock times since 2026-09-11 (ADR-0028).</summary>
    private static readonly TimeOnly Begin = new(9, 0);

    private static readonly TimeOnly Einde = new(9, 50);

    /// <param name="leeftijd">
    /// The subthema's age, which is the whole of its scope since 2026-08-30 (Art. IX.2). It replaced a klasId
    /// here: what the service checks is now whether the plan's klas TEACHES this age.
    /// </param>
    private static Activiteitinhoud Inhoud(string leeftijd, Guid? activiteitId = null, Guid? themaId = null) =>
        new(
            ActiviteitId: activiteitId ?? ActiviteitId,
            Naam: "Bladeren zoeken",
            ActiviteitType: ActiviteitType.Hoek,
            SubthemaId: SubthemaId,
            SubthemaNaam: "Herfstbladeren",
            Leeftijd: leeftijd,
            ThemaId: themaId ?? ThemaId,
            ThemaNaam: "Herfst",
            Doelcodes: ["NAT-K3-01"]);

    private static (WeekplanningService Service, FakeWeekplanningOpslag Opslag, Klas Klas, Schooljaar Schooljaar) Maak(
        Schooljaar? schooljaar = null,
        Jaarplan? jaarplan = null,
        IEnumerable<Activiteitinhoud>? inhoud = null)
    {
        var jaar = schooljaar ?? TestSchooljaar.MetVakanties();
        var klas = jaar.VoegKlasToe("K3 derde kleuterklas", "K3");
        var opslag = new FakeWeekplanningOpslag(klas, jaar, inhoud ?? [Inhoud("K3")], jaarplan);

        return (new WeekplanningService(opslag), opslag, klas, jaar);
    }

    [Fact]
    public async Task Een_activiteit_wordt_manueel_op_een_lesdag_gepland()
    {
        var (service, opslag, klas, _) = Maak();

        var week = await service.PlanActiviteitAsync(klas.Id, ActiviteitId, Woensdag, Begin, Einde);

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

    [Fact]
    public async Task Een_eigen_activiteit_plant_alleen_haar_eigenaar_of_de_directie()
    {
        // ADR-0049 D6: a colleague uses it first and plans her copy; without a planner it fails closed.
        var eigenaar = Guid.NewGuid();
        var collega = new Jaarplanner.Application.Toegang.Rechten(Guid.NewGuid(), false, false, [], ["K3"], []);
        var eigen = new Jaarplanner.Application.Toegang.Rechten(eigenaar, false, false, [], ["K3"], []);
        var directie = new Jaarplanner.Application.Toegang.Rechten(Guid.NewGuid(), true, false, [], [], []);
        var (service, opslag, klas, _) = Maak(inhoud: [Inhoud("K3") with { EigenaarId = eigenaar }]);

        var fout = await Assert.ThrowsAsync<OngeldigeDagplanningFout>(() =>
            service.PlanActiviteitAsync(klas.Id, ActiviteitId, Woensdag, Begin, Einde, collega));
        Assert.Contains("Gebruiken", fout.Message, StringComparison.Ordinal);
        await Assert.ThrowsAsync<OngeldigeDagplanningFout>(() =>
            service.PlanActiviteitAsync(klas.Id, ActiviteitId, Woensdag, Begin, Einde));
        Assert.Equal(0, opslag.AantalKeerBewaard);

        await service.PlanActiviteitAsync(klas.Id, ActiviteitId, Woensdag, Begin, Einde, eigen);
        await service.PlanActiviteitAsync(klas.Id, ActiviteitId, Woensdag, new TimeOnly(10, 0), new TimeOnly(10, 50), directie);
        Assert.Equal(2, opslag.AantalKeerBewaard);
    }

    /// <summary>
    /// The response is the ISO week (Monday–Sunday) containing the affected day, so a client never re-fetches after a
    /// drag. Monday is the week start because a Flemish school week is.
    /// </summary>
    [Fact]
    public async Task De_teruggegeven_week_loopt_van_maandag_tot_zondag()
    {
        var (service, _, klas, _) = Maak();

        var week = await service.PlanActiviteitAsync(klas.Id, ActiviteitId, Woensdag, Begin, Einde);

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
            service.PlanActiviteitAsync(klas.Id, ActiviteitId, new DateOnly(2026, 11, 3), Begin, Einde));

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
            service.PlanActiviteitAsync(klas.Id, ActiviteitId, new DateOnly(2027, 7, 14), Begin, Einde));

        Assert.Contains("buiten schooljaar", fout.Message, StringComparison.Ordinal);
        Assert.Equal(0, opslag.AantalKeerBewaard);
    }

    /// <summary>
    /// Art. IX.2 makes the class scope structural. Checked <b>before</b> the day, because a teacher aiming another
    /// class's activiteit at a closed day should be told the thing that is wrong whatever day they pick.
    /// </summary>
    [Fact]
    public async Task Een_activiteit_van_een_andere_leeftijd_wordt_geweigerd_voor_de_dagcontrole()
    {
        var vreemdeActiviteit = Guid.NewGuid();
        var schooljaar = TestSchooljaar.MetVakanties();
        var klas = schooljaar.VoegKlasToe("K3 derde kleuterklas", "K3");
        // L3 is an age this kleuterklas does not teach, which since 2026-08-30 is what "someone else's content"
        // means (Art. IX.2). It used to be another klasId.
        var opslag = new FakeWeekplanningOpslag(
            klas, schooljaar, [Inhoud("K3"), Inhoud("L3", vreemdeActiviteit)]);
        var service = new WeekplanningService(opslag);

        // A vakantie day AND an activiteit for another age: the age error is the one reported.
        var fout = await Assert.ThrowsAsync<OngeldigeDagplanningFout>(() =>
            service.PlanActiviteitAsync(klas.Id, vreemdeActiviteit, new DateOnly(2026, 11, 3), Begin, Einde));

        Assert.Contains("geeft die leeftijd niet", fout.Message, StringComparison.Ordinal);
        Assert.DoesNotContain("Herfstvakantie", fout.Message, StringComparison.Ordinal);
        Assert.Equal(0, opslag.AantalKeerBewaard);
    }

    [Fact]
    public async Task Een_onbekende_activiteit_is_een_404()
    {
        var (service, _, klas, _) = Maak();

        await Assert.ThrowsAsync<SchoolcontentNietGevondenFout>(() =>
            service.PlanActiviteitAsync(klas.Id, Guid.NewGuid(), Woensdag, Begin, Einde));
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

        await service.PlanActiviteitAsync(klas.Id, ActiviteitId, Woensdag, Begin, Einde);

        Assert.NotNull(opslag.Jaarplan);
        Assert.Single(opslag.Jaarplan!.Activiteitplaatsingen);
    }

    /// <summary>
    /// Dropping a block later on the same day must not be an error. Only a <i>different</i> placement of the same
    /// activiteit already starting at the target time is a genuine duplicate.
    /// </summary>
    [Fact]
    public async Task Een_verplaatsing_naar_dezelfde_dag_is_geen_duplicaat()
    {
        var (service, opslag, klas, _) = Maak();
        var week = await service.PlanActiviteitAsync(klas.Id, ActiviteitId, Woensdag, Begin, Einde);
        var plaatsingId = week.Dagen.SelectMany(d => d.Activiteiten).Single().PlaatsingId;

        var na = await service.VerplaatsActiviteitAsync(
            klas.Id, plaatsingId, Woensdag, new TimeOnly(11, 0), new TimeOnly(11, 50));

        var gepland = Assert.Single(Assert.Single(na.Dagen, d => d.Datum == Woensdag).Activiteiten);
        Assert.Equal(new TimeOnly(11, 0), gepland.Begin);
        Assert.Equal(new TimeOnly(11, 50), gepland.Einde);
        Assert.Equal(2, opslag.AantalKeerBewaard);
    }

    /// <summary>
    /// <b>A resize is a move that keeps the start</b>, which is exactly the case the duplicate guard would refuse if it
    /// compared the placement with itself: dragging the bottom edge of a block sends the same day and start with a
    /// later end.
    /// </summary>
    [Fact]
    public async Task Een_blok_langer_maken_is_geen_duplicaat()
    {
        var (service, _, klas, _) = Maak();
        var week = await service.PlanActiviteitAsync(klas.Id, ActiviteitId, Woensdag, Begin, Einde);
        var plaatsingId = week.Dagen.SelectMany(d => d.Activiteiten).Single().PlaatsingId;

        var na = await service.VerplaatsActiviteitAsync(klas.Id, plaatsingId, Woensdag, Begin, new TimeOnly(10, 30));

        Assert.Equal(new TimeOnly(10, 30), Assert.Single(na.Dagen.SelectMany(d => d.Activiteiten)).Einde);
    }

    /// <summary>
    /// The end before the start reaches a teacher from the time fields in the activiteit sheet, so it is a Dutch
    /// refusal from the service rather than the aggregate's English guard reaching her as a 500 (ADR-0028).
    /// </summary>
    [Fact]
    public async Task Een_einde_voor_het_begin_wordt_in_het_nederlands_geweigerd()
    {
        var (service, opslag, klas, _) = Maak();

        var fout = await Assert.ThrowsAsync<OngeldigeDagplanningFout>(() =>
            service.PlanActiviteitAsync(klas.Id, ActiviteitId, Woensdag, Einde, Begin));

        Assert.Contains("einde", fout.Message, StringComparison.Ordinal);
        Assert.Equal(0, opslag.AantalKeerBewaard);
    }

    /// <summary>
    /// The same activiteit twice from the same start is the one row that means nothing, and the refusal names the
    /// time the way the grid labels it, so a teacher knows which block is in the way.
    /// </summary>
    [Fact]
    public async Task Dezelfde_activiteit_twee_keer_op_hetzelfde_begin_wordt_geweigerd_met_het_uur()
    {
        var (service, _, klas, _) = Maak();
        await service.PlanActiviteitAsync(klas.Id, ActiviteitId, Woensdag, Begin, Einde);

        var fout = await Assert.ThrowsAsync<OngeldigeDagplanningFout>(() =>
            service.PlanActiviteitAsync(klas.Id, ActiviteitId, Woensdag, Begin, new TimeOnly(10, 0)));

        Assert.Contains("om 9:00", fout.Message, StringComparison.Ordinal);
        Assert.Contains("9 september 2026", fout.Message, StringComparison.Ordinal);

        // Later the same day is fine: in the morning and again after lunch.
        await service.PlanActiviteitAsync(klas.Id, ActiviteitId, Woensdag, new TimeOnly(13, 30), new TimeOnly(14, 20));
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
        var week = await service.PlanActiviteitAsync(klas.Id, ActiviteitId, Woensdag, Begin, Einde);
        var plaatsingId = week.Dagen.SelectMany(d => d.Activiteiten).Single().PlaatsingId;

        // The school declares that Wednesday a free day after the fact.
        schooljaar.VoegSluitingToe(
            new Schoolsluiting("Pedagogische studiedag", Woensdag, Woensdag, Sluitingssoort.VrijeDag));

        var na = await service.VerplaatsActiviteitAsync(klas.Id, plaatsingId, new DateOnly(2026, 9, 10), Begin, Einde);

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
    /// An activiteit scheduled outside its thema's days is <b>reported, never refused</b> (E9-03's stated invariant).
    /// A teacher who front-loads one activiteit is not making a mistake, and refusing it would be the tool inventing a
    /// rule the school never stated.
    /// </summary>
    [Fact]
    public async Task Een_activiteit_buiten_de_dagen_van_haar_thema_wordt_gemeld_niet_geweigerd()
    {
        var schooljaar = TestSchooljaar.MetVakanties();
        var klas = schooljaar.VoegKlasToe("K3 derde kleuterklas", "K3");
        var plan = new Jaarplan(klas.Id);

        // The thema runs 5–23 October; the activiteit is scheduled on 9 September.
        plan.VoegPlaatsingToe(ThemaId, new DateOnly(2026, 10, 5), new DateOnly(2026, 10, 23), KoppelingStatus.Aanvaard);
        var opslag = new FakeWeekplanningOpslag(klas, schooljaar, [Inhoud("K3")], plan);
        var service = new WeekplanningService(opslag);

        var week = await service.PlanActiviteitAsync(klas.Id, ActiviteitId, Woensdag, Begin, Einde);

        Assert.True(Assert.Single(week.Dagen.SelectMany(d => d.Activiteiten)).ValtBuitenThemaperiode);
    }

    /// <summary>The mirror of the test above: on a day of the thema's placement, its first and last included, nothing is flagged.</summary>
    [Theory]
    [InlineData(2026, 9, 7)]
    [InlineData(2026, 9, 18)]
    public async Task Een_activiteit_binnen_de_dagen_van_haar_thema_wordt_niet_gemeld(int jaar, int maand, int dag)
    {
        var schooljaar = TestSchooljaar.MetVakanties();
        var klas = schooljaar.VoegKlasToe("K3 derde kleuterklas", "K3");
        var plan = new Jaarplan(klas.Id);
        plan.VoegPlaatsingToe(ThemaId, new DateOnly(2026, 9, 7), new DateOnly(2026, 9, 18), KoppelingStatus.Aanvaard);
        var service = new WeekplanningService(new FakeWeekplanningOpslag(klas, schooljaar, [Inhoud("K3")], plan));

        var week = await service.PlanActiviteitAsync(klas.Id, ActiviteitId, new DateOnly(jaar, maand, dag), Begin, Einde);

        Assert.False(Assert.Single(week.Dagen.SelectMany(d => d.Activiteiten)).ValtBuitenThemaperiode);
    }

    /// <summary>
    /// <b>A rejected thema placement is not a stretch of the thema.</b> With the thema's only placement rejected there
    /// are no days to measure against, so the flag is <c>false</c>: a mismatch against nothing is not reported.
    /// </summary>
    [Fact]
    public async Task Een_geweigerde_themaplaatsing_levert_geen_dagen_om_tegen_te_meten()
    {
        var schooljaar = TestSchooljaar.MetVakanties();
        var klas = schooljaar.VoegKlasToe("K3 derde kleuterklas", "K3");
        var plan = new Jaarplan(klas.Id);
        plan.VoegPlaatsingToe(ThemaId, new DateOnly(2026, 10, 5), new DateOnly(2026, 10, 23), KoppelingStatus.Geweigerd);
        var service = new WeekplanningService(new FakeWeekplanningOpslag(klas, schooljaar, [Inhoud("K3")], plan));

        var week = await service.PlanActiviteitAsync(klas.Id, ActiviteitId, Woensdag, Begin, Einde);

        Assert.False(Assert.Single(week.Dagen.SelectMany(d => d.Activiteiten)).ValtBuitenThemaperiode);
    }

    /// <summary>
    /// A thema placed twice, or in parts around a vacation, is measured against <b>every</b> placement (ADR-0053
    /// decision 11): a day in either is inside, and a day between them is outside. The old rule took the widest span,
    /// which only made sense while a placement filled a whole period.
    /// </summary>
    [Fact]
    public async Task Een_thema_in_twee_delen_dekt_elk_deel_maar_niet_wat_ertussen_ligt()
    {
        var schooljaar = TestSchooljaar.MetVakanties();
        var klas = schooljaar.VoegKlasToe("K3 derde kleuterklas", "K3");
        var plan = new Jaarplan(klas.Id);
        plan.VoegPlaatsingToe(ThemaId, new DateOnly(2026, 9, 7), new DateOnly(2026, 9, 11), KoppelingStatus.Aanvaard);
        plan.VoegPlaatsingToe(ThemaId, new DateOnly(2026, 9, 21), new DateOnly(2026, 9, 25), KoppelingStatus.Manueel);
        var service = new WeekplanningService(new FakeWeekplanningOpslag(klas, schooljaar, [Inhoud("K3")], plan));

        var inTweede = await service.PlanActiviteitAsync(klas.Id, ActiviteitId, new DateOnly(2026, 9, 23), Begin, Einde);
        Assert.False(Assert.Single(inTweede.Dagen.SelectMany(d => d.Activiteiten)).ValtBuitenThemaperiode);

        var ertussen = await service.PlanActiviteitAsync(klas.Id, ActiviteitId, new DateOnly(2026, 9, 16), Begin, Einde);
        Assert.True(Assert.Single(ertussen.Dagen.SelectMany(d => d.Activiteiten)).ValtBuitenThemaperiode);
    }

    /// <summary>
    /// Removing a placement returns the week it <i>was</i> in, so the client can redraw without re-fetching — and the
    /// day is captured before the removal, since afterwards the placement has no day to ask for.
    /// </summary>
    [Fact]
    public async Task Verwijderen_geeft_de_week_terug_waar_de_activiteit_stond()
    {
        var (service, opslag, klas, _) = Maak();
        var week = await service.PlanActiviteitAsync(klas.Id, ActiviteitId, Woensdag, Begin, Einde);
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

        var week = await service.PlanActiviteitAsync(klas.Id, ActiviteitId, Woensdag, Begin, Einde);

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
