using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;

namespace Jaarplanner.UnitTests.Planning;

/// <summary>
/// E9-03: the <see cref="Activiteitplaatsing"/> invariants and the <see cref="Jaarplan"/> verbs that create them
/// (FR-6.2/FR-7.2, Art. IV.2, Art. IX.2/IX.3).
/// <para>
/// These pin the three properties the rest of E9 depends on: a placement keys on a <b>real calendar date</b> and never
/// on a derived block, a day move destroys nothing, and the <b>class boundary</b> is enforced where both classes are
/// known.
/// </para>
/// </summary>
public sealed class ActiviteitplaatsingTests
{
    private static readonly DateOnly Maandag = new(2026, 9, 7);
    private static readonly DateOnly Donderdag = new(2026, 9, 10);

    private static Jaarplan PlanVoor(Guid klasId) => new(klasId);

    [Fact]
    public void Een_plaatsing_bewaart_de_dag_als_sleutel()
    {
        var klasId = Guid.NewGuid();
        var jaarplan = PlanVoor(klasId);
        var activiteitId = Guid.NewGuid();

        var plaatsing = jaarplan.PlaatsActiviteit(activiteitId, Maandag, KoppelingStatus.Manueel, volgorde: 2);

        Assert.Equal(activiteitId, plaatsing.ActiviteitId);
        Assert.Equal(Maandag, plaatsing.Datum);
        Assert.Equal(2, plaatsing.Volgorde);
        Assert.Equal(KoppelingStatus.Manueel, plaatsing.Status);
    }

    /// <summary>
    /// <b>The structural guarantee this whole story rests on.</b> No member of <see cref="Activiteitplaatsing"/>
    /// carries a block key or a tier, so an activiteit cannot be keyed on a derived planningsblok even by accident.
    /// <para>
    /// If someone later adds one, this fails, which is the point: a block boundary moves when the school edits a
    /// vakantie (that is what <c>Themaplaatsing.IsVervallen</c> exists for) while a Tuesday does not. Keying an
    /// activiteit on a block would import a staleness problem it does not have.
    /// </para>
    /// </summary>
    [Fact]
    public void Activiteitplaatsing_heeft_geen_blok_ordinaal_of_niveau()
    {
        var namen = typeof(Activiteitplaatsing)
            .GetProperties()
            .Select(p => p.Name)
            .ToList();

        Assert.DoesNotContain("BlokStart", namen);
        Assert.DoesNotContain("BlokNiveau", namen);
        Assert.DoesNotContain("BlokOrdinaal", namen);
        Assert.DoesNotContain("Ordinaal", namen);
        Assert.DoesNotContain("Week", namen);
        Assert.DoesNotContain("Maand", namen);

        // And the key it does carry is a plain calendar date.
        Assert.Equal(typeof(DateOnly), typeof(Activiteitplaatsing).GetProperty(nameof(Activiteitplaatsing.Datum))!.PropertyType);
    }

    /// <summary>
    /// The counterpart of the assertion above, and the reason E9-03 refused to widen the enum: adding a week or a day
    /// tier to <see cref="Planningsblokniveau"/> would have compiled in a calendar unit that Art. IX.3 and ADR-0013
    /// keep out of the planning grid.
    /// </summary>
    [Fact]
    public void Planningsblokniveau_kreeg_geen_week_of_dag_lid()
    {
        var leden = Enum.GetNames<Planningsblokniveau>();

        Assert.Equal(["Themaperiode", "Subthemaperiode"], leden.OrderByDescending(n => n).ToArray());
    }

    /// <summary>
    /// <b>The aggregate accepts any activiteit now, and that is the change rather than a gap in this suite.</b>
    /// Art. IX.2 was amended on 2026-08-30: an activiteit inherits its subthema's LEEFTIJD and no longer belongs
    /// to a klas, so there is nothing here for <c>Jaarplan</c> to compare against its own <c>KlasId</c>. Deciding
    /// whether this plan's class teaches that age needs <c>Jaarfasen</c> and the <c>Klas</c> row, which an
    /// aggregate may not reach for.
    /// <para>
    /// The check therefore lives only in <c>WeekplanningService</c>, and
    /// <c>WeekplanningServiceTests.Een_activiteit_van_een_andere_leeftijd_wordt_geweigerd_voor_de_dagcontrole</c>
    /// is the test that holds it. This one asserts the removal deliberately, so that re-adding a klas comparison
    /// here fails rather than passes quietly.
    /// </para>
    /// <para>
    /// <b>E1-19 is closed by the same amendment</b>, not by a fix: it was filed because
    /// <c>Subthema.WijzigScope</c> carried activiteiten across a class boundary. There is no class boundary left.
    /// </para>
    /// </summary>
    [Fact]
    public void Een_activiteit_wordt_niet_meer_op_klas_geweigerd()
    {
        var jaarplan = PlanVoor(Guid.NewGuid());

        var plaatsing = jaarplan.PlaatsActiviteit(Guid.NewGuid(), Maandag, KoppelingStatus.Manueel);

        Assert.NotNull(plaatsing);
        Assert.Single(jaarplan.Activiteitplaatsingen);
    }

    /// <summary>
    /// A day holds several activiteiten — that is the normal case, not an edge one — so only the exact duplicate is
    /// refused, and the same activiteit on another day stays legitimate (a reading moment on Monday and Thursday).
    /// </summary>
    [Fact]
    public void Dezelfde_activiteit_mag_op_een_andere_dag_maar_niet_twee_keer_op_dezelfde()
    {
        var klasId = Guid.NewGuid();
        var jaarplan = PlanVoor(klasId);
        var activiteitId = Guid.NewGuid();

        jaarplan.PlaatsActiviteit(activiteitId, Maandag, KoppelingStatus.Manueel);
        jaarplan.PlaatsActiviteit(activiteitId, Donderdag, KoppelingStatus.Manueel);

        Assert.Equal(2, jaarplan.Activiteitplaatsingen.Count);
        Assert.True(jaarplan.IsAlGeplaatstOp(activiteitId, Maandag, 0));
        Assert.Throws<InvalidOperationException>(() =>
            jaarplan.PlaatsActiviteit(activiteitId, Maandag, KoppelingStatus.Manueel));
    }

    /// <summary>
    /// Several activiteiten on one day, and the day is ordered by the teacher's own <c>Volgorde</c> rather than by
    /// insertion: a teacher who inserts a reading moment before the one already there expects it to stay first.
    /// </summary>
    [Fact]
    public void Een_dag_wordt_geordend_op_volgorde_niet_op_invoegmoment()
    {
        var klasId = Guid.NewGuid();
        var jaarplan = PlanVoor(klasId);
        var laatstIngevoerd = Guid.NewGuid();

        jaarplan.PlaatsActiviteit(Guid.NewGuid(), Maandag, KoppelingStatus.Manueel, volgorde: 5);
        jaarplan.PlaatsActiviteit(laatstIngevoerd, Maandag, KoppelingStatus.Manueel, volgorde: 1);

        Assert.Equal(laatstIngevoerd, jaarplan.Activiteitplaatsingen[0].ActiviteitId);
    }

    /// <summary>
    /// <b>A day move destroys nothing, unlike a thema move.</b> <c>Themaplaatsing.VerplaatsNaar</c> rewrites the status
    /// to <c>Manueel</c> and clears the AI motivation, which is what makes a thema move a small unrecoverable edit the
    /// UI has to warn about. Here there is no motivation to lose and no proposal to override.
    /// <para>
    /// Pinned as a test because E9-04 must <b>not</b> copy E3-07's confirmation step onto a day drag: warning about a
    /// consequence that cannot happen trains teachers to dismiss the warnings that matter.
    /// </para>
    /// </summary>
    [Fact]
    public void Een_dagverplaatsing_verandert_de_status_niet()
    {
        var klasId = Guid.NewGuid();
        var jaarplan = PlanVoor(klasId);
        var plaatsing = jaarplan.PlaatsActiviteit(
            Guid.NewGuid(), Maandag, KoppelingStatus.Voorgesteld, volgorde: 3);

        plaatsing.VerplaatsNaar(Donderdag, volgorde: 1);

        Assert.Equal(Donderdag, plaatsing.Datum);
        Assert.Equal(1, plaatsing.Volgorde);
        Assert.Equal(KoppelingStatus.Voorgesteld, plaatsing.Status);
    }

    /// <summary>
    /// A day that stopped being a teaching day is <b>computed from the schooljaar, never stored</b> — the same rule
    /// Art. V.1 applies to dekking, and for the same reason: a stored answer is a second copy of a fact that can
    /// change without it.
    /// </summary>
    [Fact]
    public void Een_gesloten_dag_wordt_op_leesmoment_bepaald()
    {
        var schooljaar = TestSchooljaar.Maak();
        var klasId = Guid.NewGuid();
        var jaarplan = PlanVoor(klasId);

        // 2 November is an ordinary Monday until the school says otherwise.
        var plaatsing = jaarplan.PlaatsActiviteit(
            Guid.NewGuid(), new DateOnly(2026, 11, 2), KoppelingStatus.Manueel);
        Assert.False(plaatsing.IsOpGeslotenDag(schooljaar));

        schooljaar.VoegSluitingToe(
            new Schoolsluiting("Herfstvakantie", new DateOnly(2026, 11, 2), new DateOnly(2026, 11, 8)));

        Assert.True(plaatsing.IsOpGeslotenDag(schooljaar));

        // And the placement itself was neither moved nor altered: resolving it is the teacher's decision, exactly as
        // the directie ruling of 2026-07-28 requires for a stale thema placement.
        Assert.Equal(new DateOnly(2026, 11, 2), plaatsing.Datum);
    }

    /// <summary>
    /// The delete guard's predicate. Today nothing generates day schedules, so every placement is a human decision and
    /// all of them count — and the test says so explicitly rather than leaving it to be inferred, because a guard that
    /// hard-coded "all of them" would quietly start destroying proposals the day a generator appears.
    /// </summary>
    [Fact]
    public void Menselijk_beslote_dagplaatsingen_zijn_alles_behalve_een_voorstel()
    {
        var klasId = Guid.NewGuid();
        var jaarplan = PlanVoor(klasId);

        jaarplan.PlaatsActiviteit(Guid.NewGuid(), Maandag, KoppelingStatus.Manueel);
        jaarplan.PlaatsActiviteit(Guid.NewGuid(), Maandag, KoppelingStatus.Aanvaard, volgorde: 1);
        jaarplan.PlaatsActiviteit(Guid.NewGuid(), Donderdag, KoppelingStatus.Voorgesteld);

        Assert.Equal(2, jaarplan.MenselijkBeslotenActiviteitplaatsingen.Count);
    }

    /// <summary>
    /// An aggregate refuses work that is not its own rather than pretending to have done it — the same reasoning as
    /// <c>VerwijderPlaatsing</c>: swallowing <c>List.Remove</c>'s <c>false</c> would make a cross-aggregate delete a
    /// silent no-op the API still answers 200 OK with an unchanged plan.
    /// </summary>
    [Fact]
    public void Een_plaatsing_van_een_ander_jaarplan_wordt_niet_verwijderd()
    {
        var klasId = Guid.NewGuid();
        var eigen = PlanVoor(klasId);
        var ander = PlanVoor(Guid.NewGuid());
        var vreemde = ander.PlaatsActiviteit(Guid.NewGuid(), Maandag, KoppelingStatus.Manueel);

        Assert.Throws<InvalidOperationException>(() => eigen.VerwijderActiviteitplaatsing(vreemde));
    }
}
