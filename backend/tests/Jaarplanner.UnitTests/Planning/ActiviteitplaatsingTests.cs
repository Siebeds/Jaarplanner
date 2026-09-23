using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;

namespace Jaarplanner.UnitTests.Planning;

/// <summary>
/// E9-03: the <see cref="Activiteitplaatsing"/> invariants and the <see cref="Jaarplan"/> verbs that create them
/// (FR-6.2/FR-7.2, Art. IV.2, Art. IX.2/IX.3; clock times since ADR-0027).
/// <para>
/// These pin the properties the rest of the agenda depends on: a placement keys on a <b>real calendar date</b> and
/// never on a derived block, it carries a <b>clock time</b> rather than a lesuur number, and a day move destroys
/// nothing.
/// </para>
/// </summary>
public sealed class ActiviteitplaatsingTests
{
    private static readonly DateOnly Maandag = new(2026, 9, 7);
    private static readonly DateOnly Donderdag = new(2026, 9, 10);

    private static readonly TimeOnly Negen = new(9, 0);
    private static readonly TimeOnly NegenVijftig = new(9, 50);

    private static Jaarplan PlanVoor(Guid klasId) => new(klasId);

    [Fact]
    public void Een_plaatsing_bewaart_de_dag_en_de_tijden_die_de_leerkracht_koos()
    {
        var klasId = Guid.NewGuid();
        var jaarplan = PlanVoor(klasId);
        var activiteitId = Guid.NewGuid();

        var plaatsing = jaarplan.PlaatsActiviteit(
            activiteitId, Maandag, KoppelingStatus.Manueel, new TimeOnly(10, 15), new TimeOnly(11, 0));

        Assert.Equal(activiteitId, plaatsing.ActiviteitId);
        Assert.Equal(Maandag, plaatsing.Datum);
        Assert.Equal(new TimeOnly(10, 15), plaatsing.Begin);
        Assert.Equal(new TimeOnly(11, 0), plaatsing.Einde);
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
    /// <para>
    /// <b>And no lesuur either, since ADR-0027.</b> <c>Volgorde</c> is asserted absent for the same reason the block
    /// keys are: a slot number next to a clock time would be two answers to "when", and they would disagree.
    /// </para>
    /// </summary>
    [Fact]
    public void Activiteitplaatsing_heeft_geen_blok_ordinaal_niveau_of_lesuur()
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
        Assert.DoesNotContain("Volgorde", namen);

        // And the keys it does carry are a plain calendar date and two clock times.
        Assert.Equal(typeof(DateOnly), typeof(Activiteitplaatsing).GetProperty(nameof(Activiteitplaatsing.Datum))!.PropertyType);
        Assert.Equal(typeof(TimeOnly), typeof(Activiteitplaatsing).GetProperty(nameof(Activiteitplaatsing.Begin))!.PropertyType);
        Assert.Equal(typeof(TimeOnly), typeof(Activiteitplaatsing).GetProperty(nameof(Activiteitplaatsing.Einde))!.PropertyType);
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

        var plaatsing = jaarplan.PlaatsActiviteit(Guid.NewGuid(), Maandag, KoppelingStatus.Manueel, Negen, NegenVijftig);

        Assert.NotNull(plaatsing);
        Assert.Single(jaarplan.Activiteitplaatsingen);
    }

    /// <summary>
    /// A day holds several activiteiten — that is the normal case, not an edge one — so only the exact duplicate is
    /// refused: the same activiteit starting twice at the same time on the same day. The same activiteit on another
    /// day, or later the same day, stays legitimate.
    /// </summary>
    [Fact]
    public void Dezelfde_activiteit_mag_op_een_andere_dag_of_een_ander_uur_maar_niet_twee_keer_op_hetzelfde_begin()
    {
        var klasId = Guid.NewGuid();
        var jaarplan = PlanVoor(klasId);
        var activiteitId = Guid.NewGuid();

        jaarplan.PlaatsActiviteit(activiteitId, Maandag, KoppelingStatus.Manueel, Negen, NegenVijftig);
        jaarplan.PlaatsActiviteit(activiteitId, Donderdag, KoppelingStatus.Manueel, Negen, NegenVijftig);
        jaarplan.PlaatsActiviteit(activiteitId, Maandag, KoppelingStatus.Manueel, new TimeOnly(13, 30), new TimeOnly(14, 20));

        Assert.Equal(3, jaarplan.Activiteitplaatsingen.Count);
        Assert.True(jaarplan.IsAlGeplaatstOp(activiteitId, Maandag, Negen));
        Assert.False(jaarplan.IsAlGeplaatstOp(activiteitId, Maandag, new TimeOnly(9, 15)));
        Assert.Throws<InvalidOperationException>(() =>
            jaarplan.PlaatsActiviteit(activiteitId, Maandag, KoppelingStatus.Manueel, Negen, new TimeOnly(10, 0)));
    }

    /// <summary>
    /// Several activiteiten on one day, and the day is ordered by the time each starts rather than by insertion: a
    /// teacher who puts a reading moment at 8:45 after planning the one at 13:30 expects it to come first.
    /// </summary>
    [Fact]
    public void Een_dag_wordt_geordend_op_beginuur_niet_op_invoegmoment()
    {
        var klasId = Guid.NewGuid();
        var jaarplan = PlanVoor(klasId);
        var laatstIngevoerd = Guid.NewGuid();

        jaarplan.PlaatsActiviteit(Guid.NewGuid(), Maandag, KoppelingStatus.Manueel, new TimeOnly(13, 30), new TimeOnly(14, 20));
        jaarplan.PlaatsActiviteit(laatstIngevoerd, Maandag, KoppelingStatus.Manueel, new TimeOnly(8, 45), new TimeOnly(9, 30));

        Assert.Equal(laatstIngevoerd, jaarplan.Activiteitplaatsingen[0].ActiviteitId);
    }

    /// <summary>
    /// A block that ends where it starts, or before, is not a block. The aggregate refuses it as programmer error
    /// (English, unmapped); <c>WeekplanningService</c> is what turns the teacher's version into a Dutch 400.
    /// </summary>
    [Fact]
    public void Een_einde_dat_niet_na_het_begin_ligt_wordt_geweigerd()
    {
        var jaarplan = PlanVoor(Guid.NewGuid());

        Assert.Throws<ArgumentOutOfRangeException>(() =>
            jaarplan.PlaatsActiviteit(Guid.NewGuid(), Maandag, KoppelingStatus.Manueel, Negen, Negen));

        var plaatsing = jaarplan.PlaatsActiviteit(Guid.NewGuid(), Maandag, KoppelingStatus.Manueel, Negen, NegenVijftig);
        Assert.Throws<ArgumentOutOfRangeException>(() => plaatsing.VerplaatsNaar(Maandag, Negen, new TimeOnly(8, 30)));

        // And the refused move left the placement where it was.
        Assert.Equal(NegenVijftig, plaatsing.Einde);
    }

    /// <summary>
    /// <b>Moving a decided block destroys nothing.</b> Pinned as a test because E9-04 must <b>not</b> copy E3-07's
    /// confirmation step onto a day drag: warning about a consequence that cannot happen trains teachers to dismiss the
    /// warnings that matter.
    /// </summary>
    [Theory]
    [InlineData(KoppelingStatus.Manueel)]
    [InlineData(KoppelingStatus.Aanvaard)]
    public void Een_dagverplaatsing_van_een_besliste_plaatsing_verandert_de_status_niet(KoppelingStatus status)
    {
        var klasId = Guid.NewGuid();
        var jaarplan = PlanVoor(klasId);
        var plaatsing = jaarplan.PlaatsActiviteit(Guid.NewGuid(), Maandag, status, Negen, NegenVijftig);

        plaatsing.VerplaatsNaar(Donderdag, new TimeOnly(13, 0), new TimeOnly(14, 15));

        Assert.Equal(Donderdag, plaatsing.Datum);
        Assert.Equal(new TimeOnly(13, 0), plaatsing.Begin);
        Assert.Equal(new TimeOnly(14, 15), plaatsing.Einde);
        Assert.Equal(status, plaatsing.Status);
    }

    /// <summary>
    /// An open proposal of a weekvoorstel that she moves is a moment she chose (FB-027, ADR-0067 W4): it becomes hers,
    /// and the motivation, which argued for the old moment, goes, as on a moved thema placement.
    /// </summary>
    [Fact]
    public void Een_verplaatst_voorstel_wordt_manueel_en_verliest_zijn_motivatie()
    {
        var jaarplan = PlanVoor(Guid.NewGuid());
        var plaatsing = jaarplan.PlaatsActiviteit(
            Guid.NewGuid(), Maandag, KoppelingStatus.Voorgesteld, Negen, NegenVijftig, "Past bij de start van de week.");

        plaatsing.VerplaatsNaar(Donderdag, new TimeOnly(13, 0), new TimeOnly(14, 15));

        Assert.Equal(KoppelingStatus.Manueel, plaatsing.Status);
        Assert.Null(plaatsing.AiMotivatie);
        Assert.False(plaatsing.IsVervangbaar);
    }

    [Fact]
    public void Een_aanvaard_voorstel_houdt_zijn_moment_en_motivatie()
    {
        var jaarplan = PlanVoor(Guid.NewGuid());
        var plaatsing = jaarplan.PlaatsActiviteit(
            Guid.NewGuid(), Maandag, KoppelingStatus.Voorgesteld, Negen, NegenVijftig, "  Past bij de start van de week. ");

        plaatsing.Aanvaard();

        Assert.Equal(KoppelingStatus.Aanvaard, plaatsing.Status);
        Assert.Equal("Past bij de start van de week.", plaatsing.AiMotivatie);
        Assert.Equal((Maandag, Negen, NegenVijftig), (plaatsing.Datum, plaatsing.Begin, plaatsing.Einde));
        Assert.False(plaatsing.IsVervangbaar);
    }

    [Theory]
    [InlineData(KoppelingStatus.Manueel)]
    [InlineData(KoppelingStatus.Aanvaard)]
    public void Alleen_een_open_voorstel_kan_aanvaard_worden(KoppelingStatus status)
    {
        var plaatsing = PlanVoor(Guid.NewGuid()).PlaatsActiviteit(Guid.NewGuid(), Maandag, status, Negen, NegenVijftig);

        Assert.Throws<InvalidOperationException>(plaatsing.Aanvaard);
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
            Guid.NewGuid(), new DateOnly(2026, 11, 2), KoppelingStatus.Manueel, Negen, NegenVijftig);
        Assert.False(plaatsing.IsOpGeslotenDag(schooljaar));

        schooljaar.VoegSluitingToe(
            new Schoolsluiting("Herfstvakantie", new DateOnly(2026, 11, 2), new DateOnly(2026, 11, 8)));

        Assert.True(plaatsing.IsOpGeslotenDag(schooljaar));

        // And the placement itself was neither moved nor altered: resolving it is the teacher's decision, exactly as
        // the directie ruling of 2026-07-28 requires for a stale thema placement.
        Assert.Equal(new DateOnly(2026, 11, 2), plaatsing.Datum);
    }

    /// <summary>
    /// The delete guard's predicate: every placement a person decided counts, and an open proposal of a weekvoorstel
    /// (FB-027) does not, because nobody decided it.
    /// </summary>
    [Fact]
    public void Menselijk_beslote_dagplaatsingen_zijn_alles_behalve_een_voorstel()
    {
        var klasId = Guid.NewGuid();
        var jaarplan = PlanVoor(klasId);

        jaarplan.PlaatsActiviteit(Guid.NewGuid(), Maandag, KoppelingStatus.Manueel, Negen, NegenVijftig);
        jaarplan.PlaatsActiviteit(Guid.NewGuid(), Maandag, KoppelingStatus.Aanvaard, new TimeOnly(10, 0), new TimeOnly(10, 50));
        jaarplan.PlaatsActiviteit(Guid.NewGuid(), Donderdag, KoppelingStatus.Voorgesteld, Negen, NegenVijftig);

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
        var vreemde = ander.PlaatsActiviteit(Guid.NewGuid(), Maandag, KoppelingStatus.Manueel, Negen, NegenVijftig);

        Assert.Throws<InvalidOperationException>(() => eigen.VerwijderActiviteitplaatsing(vreemde));
    }
}
