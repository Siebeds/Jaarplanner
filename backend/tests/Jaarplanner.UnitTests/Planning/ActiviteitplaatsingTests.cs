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

        var plaatsing = jaarplan.PlaatsActiviteit(activiteitId, klasId, Maandag, KoppelingStatus.Manueel, volgorde: 2);

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
    /// Art. IX.2 makes the class scope structural, and this is the only place both classes are known — an
    /// <c>Activiteit</c> knows its subthema, and the klas lives one level up.
    /// <para>
    /// Guarded here rather than assumed because <b>E1-19 exists precisely because this boundary was left open by a
    /// second route</b>: <c>Subthema.WijzigScope</c> still carries every activiteit across a class boundary.
    /// </para>
    /// </summary>
    [Fact]
    public void Een_activiteit_van_een_andere_klas_wordt_geweigerd()
    {
        var jaarplan = PlanVoor(Guid.NewGuid());

        var fout = Assert.Throws<ArgumentException>(() =>
            jaarplan.PlaatsActiviteit(Guid.NewGuid(), Guid.NewGuid(), Maandag, KoppelingStatus.Manueel));

        Assert.Empty(jaarplan.Activiteitplaatsingen);

        // Dutch, and with NO "(Parameter '...')" suffix: the service forwards `Message` as a 400's detail and the form
        // renders it verbatim, so the paramName overload would put an English developer artefact inside a Dutch
        // sentence on a teacher's screen. That exact defect was found on these screens in E1-14's round 4, which is
        // why this asserts the payload rather than only the exception type.
        Assert.DoesNotContain("Parameter", fout.Message, StringComparison.Ordinal);
        Assert.Contains("eigen klas", fout.Message, StringComparison.Ordinal);
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

        jaarplan.PlaatsActiviteit(activiteitId, klasId, Maandag, KoppelingStatus.Manueel);
        jaarplan.PlaatsActiviteit(activiteitId, klasId, Donderdag, KoppelingStatus.Manueel);

        Assert.Equal(2, jaarplan.Activiteitplaatsingen.Count);
        Assert.True(jaarplan.IsAlGeplaatstOp(activiteitId, Maandag));
        Assert.Throws<InvalidOperationException>(() =>
            jaarplan.PlaatsActiviteit(activiteitId, klasId, Maandag, KoppelingStatus.Manueel));
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

        jaarplan.PlaatsActiviteit(Guid.NewGuid(), klasId, Maandag, KoppelingStatus.Manueel, volgorde: 5);
        jaarplan.PlaatsActiviteit(laatstIngevoerd, klasId, Maandag, KoppelingStatus.Manueel, volgorde: 1);

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
            Guid.NewGuid(), klasId, Maandag, KoppelingStatus.Voorgesteld, volgorde: 3);

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
            Guid.NewGuid(), klasId, new DateOnly(2026, 11, 2), KoppelingStatus.Manueel);
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

        jaarplan.PlaatsActiviteit(Guid.NewGuid(), klasId, Maandag, KoppelingStatus.Manueel);
        jaarplan.PlaatsActiviteit(Guid.NewGuid(), klasId, Maandag, KoppelingStatus.Aanvaard, volgorde: 1);
        jaarplan.PlaatsActiviteit(Guid.NewGuid(), klasId, Donderdag, KoppelingStatus.Voorgesteld);

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
        var vreemde = ander.PlaatsActiviteit(Guid.NewGuid(), ander.KlasId, Maandag, KoppelingStatus.Manueel);

        Assert.Throws<InvalidOperationException>(() => eigen.VerwijderActiviteitplaatsing(vreemde));
    }
}
