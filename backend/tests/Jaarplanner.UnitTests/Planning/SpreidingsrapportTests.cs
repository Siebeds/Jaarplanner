using Jaarplanner.Application.Planning.Generatie;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;

namespace Jaarplanner.UnitTests.Planning;

/// <summary>
/// E3-02 / FR-5.2 — the <b>measurable</b> half of the spreading story.
/// <para>
/// The prompt asks the model for a good spread, but the AI client is a fake in every test (Art. IV.6), so "the
/// model spreads well" cannot be asserted here without asserting the fake. What <i>can</i> be pinned is that a
/// badly spread plan is correctly described as badly spread — which is the fact a teacher acts on, and the fact
/// the endpoint returns. These tests therefore feed the report deliberately clumped and deliberately spread
/// plans and check it tells them apart.
/// </para>
/// </summary>
public class SpreidingsrapportTests
{
    // A 7-week and two 6-week blocks: enough room to overload one and leave another empty.
    private static readonly DateOnly Blok1Start = new(2026, 9, 1);
    private static readonly DateOnly Blok2Start = new(2026, 11, 9);
    private static readonly DateOnly Blok3Start = new(2027, 1, 4);

    private static IReadOnlyList<Planningsblok> Blokken() =>
    [
        new(Planningsblokniveau.Themaperiode, 1, Blok1Start, new DateOnly(2026, 10, 12)),   // 42 dagen = 6,0 wk
        new(Planningsblokniveau.Themaperiode, 2, Blok2Start, new DateOnly(2026, 12, 20)),   // 42 dagen = 6,0 wk
        new(Planningsblokniveau.Themaperiode, 3, Blok3Start, new DateOnly(2027, 2, 14)),    // 42 dagen = 6,0 wk
    ];

    /// <summary>
    /// A year spanning the three blocks with no closures, so `TelOpenDagen` equals the calendar span and the
    /// week arithmetic in these tests stays easy to read. `Een_vrije_dag_verkort_het_blok` covers the case
    /// where they differ.
    /// </summary>
    private static Schooljaar Jaar() =>
        new("2026-2027", new DateOnly(2026, 9, 1), new DateOnly(2027, 6, 30));

    private static Thema Thema(string naam, int duurWeken, params string[] doelcodes)
    {
        var thema = new Thema(naam, duurWeken);
        foreach (var code in doelcodes)
        {
            thema.VoegThemadoelToe(new DoelKoppeling(code, KoppelingStatus.Manueel));
        }

        return thema;
    }

    /// <summary>Places each thema in the given block and returns the plan plus the id→thema lookup.</summary>
    private static (Jaarplan Plan, Dictionary<Guid, Thema> PerId) Plan(params (Thema Thema, DateOnly Blok)[] items)
    {
        var plan = new Jaarplan(Guid.NewGuid());
        var perId = new Dictionary<Guid, Thema>();

        foreach (var (thema, blok) in items)
        {
            plan.VoegPlaatsingToe(thema.Id, Planningsblokniveau.Themaperiode, blok, KoppelingStatus.Voorgesteld);
            perId[thema.Id] = thema;
        }

        return (plan, perId);
    }

    [Fact]
    public void Een_gespreid_plan_gebruikt_elk_blok_en_meldt_geen_knelpunt()
    {
        var (plan, perId) = Plan(
            (Thema("Ik en mijn klas", 5, "A-1", "A-2"), Blok1Start),
            (Thema("Licht en donker", 5, "B-1", "B-2"), Blok2Start),
            (Thema("Water", 5, "C-1", "C-2"), Blok3Start));

        var rapport = Spreidingsrapport.Meet(plan.Plaatsingen, Blokken(), perId, Jaar());

        Assert.Equal(3, rapport.AantalBlokken);
        Assert.Equal(3, rapport.AantalGebruikteBlokken);
        Assert.Empty(rapport.LegeBlokOrdinalen);
        Assert.Empty(rapport.OverbelasteBlokOrdinalen);

        // Evenly distributed goals: the two ends of the range coincide.
        Assert.Equal(2, rapport.MinsteDoelenInEenBlok);
        Assert.Equal(2, rapport.MeesteDoelenInEenBlok);
    }

    [Fact]
    public void Een_geklonterd_plan_meldt_de_lege_blokken_en_de_onevenwichtige_doelen()
    {
        // Everything in periode 1; periodes 2 and 3 empty. This is precisely the failure FR-5.2 exists to
        // prevent, and the report must name it rather than average it away.
        var (plan, perId) = Plan(
            (Thema("Ik en mijn klas", 2, "A-1", "A-2"), Blok1Start),
            (Thema("Licht en donker", 2, "B-1", "B-2"), Blok1Start),
            (Thema("Water", 2, "C-1", "C-2"), Blok1Start));

        var rapport = Spreidingsrapport.Meet(plan.Plaatsingen, Blokken(), perId, Jaar());

        Assert.Equal(3, rapport.AantalBlokken);
        Assert.Equal(1, rapport.AantalGebruikteBlokken);
        Assert.Equal([2, 3], rapport.LegeBlokOrdinalen);

        // All six goals land in one block. Both ends of the range are that block, because an EMPTY block is not
        // counted as "0 goals" — otherwise a clumped plan would report a 0..6 range and look like a spread one
        // with an unused period, which is a different problem.
        Assert.Equal(6, rapport.MinsteDoelenInEenBlok);
        Assert.Equal(6, rapport.MeesteDoelenInEenBlok);
    }

    [Fact]
    public void Een_blok_met_te_veel_themaweken_is_overbelast()
    {
        // Two 6-week thema's in one 6-week block: 12 weeks of content in 6 weeks of teaching.
        var (plan, perId) = Plan(
            (Thema("Water", 6, "A-1"), Blok1Start),
            (Thema("Wonen", 6, "B-1"), Blok1Start),
            (Thema("Verkeer", 3, "C-1"), Blok2Start));

        var rapport = Spreidingsrapport.Meet(plan.Plaatsingen, Blokken(), perId, Jaar());

        Assert.Equal([1], rapport.OverbelasteBlokOrdinalen);

        var eerste = rapport.Blokken.Single(b => b.Ordinaal == 1);
        Assert.Equal(12, eerste.BenodigdeWeken);
        Assert.Equal(6.0, eerste.BeschikbareWeken);
        Assert.True(eerste.IsOverbelast);

        // Three short thema's in one block are NOT an overload — which is exactly why this is computed from
        // DuurWeken and not from a count of thema's.
        Assert.False(rapport.Blokken.Single(b => b.Ordinaal == 2).IsOverbelast);
    }

    [Fact]
    public void Een_doel_dat_twee_themas_in_hetzelfde_blok_delen_telt_een_keer()
    {
        // Art. V.1: coverage is about the doel being taught, not about how many thema's mention it. Counting the
        // shared code twice would overstate what the period covers.
        var (plan, perId) = Plan(
            (Thema("Water", 2, "GEDEELD-1", "A-2"), Blok1Start),
            (Thema("Wonen", 2, "GEDEELD-1", "B-2"), Blok1Start));

        var rapport = Spreidingsrapport.Meet(plan.Plaatsingen, Blokken(), perId, Jaar());

        Assert.Equal(3, rapport.Blokken.Single(b => b.Ordinaal == 1).AantalDoelen);
    }

    [Fact]
    public void Een_vervallen_plaatsing_wordt_niet_aan_een_blok_toegerekend()
    {
        // A placement keyed on a date that is no longer any block's start sits in NO period, so attributing its
        // goals to one would credit a block with content it does not hold. It is surfaced as IsVervallen on the
        // plan view instead, so leaving it out here hides nothing.
        var levend = Thema("Water", 2, "A-1");
        var zwevend = Thema("Kerst", 2, "B-1");

        var (plan, perId) = Plan(
            (levend, Blok1Start),
            (zwevend, new DateOnly(2026, 12, 1)));

        var rapport = Spreidingsrapport.Meet(plan.Plaatsingen, Blokken(), perId, Jaar());

        Assert.Equal(1, rapport.AantalGebruikteBlokken);
        Assert.Equal(1, rapport.Blokken.Single(b => b.Ordinaal == 1).AantalThemas);

        // The stale placement contributes neither a thema nor a goal to ANY block — one placement and one goal
        // in total, not two. This is the assertion that would fail if the report ever started snapping a stale
        // date to the nearest block.
        Assert.Equal(1, rapport.Blokken.Sum(b => b.AantalThemas));
        Assert.Equal(1, rapport.Blokken.Sum(b => b.AantalDoelen));
    }

    [Fact]
    public void Een_leeg_plan_meldt_elk_blok_als_leeg_zonder_te_delen_door_nul()
    {
        var rapport = Spreidingsrapport.Meet([], Blokken(), new Dictionary<Guid, Thema>(), Jaar());

        Assert.Equal(3, rapport.AantalBlokken);
        Assert.Equal(0, rapport.AantalGebruikteBlokken);
        Assert.Equal([1, 2, 3], rapport.LegeBlokOrdinalen);
        Assert.Equal(0, rapport.MinsteDoelenInEenBlok);
        Assert.Equal(0, rapport.MeesteDoelenInEenBlok);
    }

    /// <summary>
    /// Regression (E3-02 code review): a rejected placement survives regeneration but nothing is taught in that
    /// period because of it. Counting it reported a period as used — and could flag it overbelast — purely on
    /// the strength of a thema the teacher had thrown out. Filtering happens at the caller via
    /// <c>Themaplaatsing.IsGepland</c>, which is what this test exercises.
    /// </summary>
    [Fact]
    public void Een_geweigerde_plaatsing_maakt_een_blok_niet_bezet()
    {
        var geweigerd = Thema("Water", 6, "A-1");
        var (plan, perId) = Plan((geweigerd, Blok1Start));
        plan.Plaatsingen.Single().WijzigStatus(KoppelingStatus.Geweigerd);

        var rapport = Spreidingsrapport.Meet(
            plan.Plaatsingen.Where(p => p.IsGepland), Blokken(), perId, Jaar());

        Assert.Equal(0, rapport.AantalGebruikteBlokken);
        Assert.Equal([1, 2, 3], rapport.LegeBlokOrdinalen);
        Assert.Empty(rapport.OverbelasteBlokOrdinalen);
        Assert.Equal(0, rapport.Blokken.Single(b => b.Ordinaal == 1).BenodigdeWeken);
    }

    /// <summary>
    /// Regression (E3-02 code review): the report measured blocks in raw calendar days while the kalender
    /// measured the same blocks in <b>open</b> days, so the overload check allowed more content than the screen
    /// said the period held. Both now go through <see cref="Schooljaar.TelOpenDagen"/>.
    /// </summary>
    [Fact]
    public void Een_vrije_dag_verkort_het_blok_net_zoals_op_de_kalender()
    {
        var jaar = new Schooljaar("2026-2027", new DateOnly(2026, 9, 1), new DateOnly(2027, 6, 30));
        // 7 free days inside block 1 (42 calendar days) leave 35 open days = exactly 5,0 weeks.
        jaar.VoegSluitingToe(new Schoolsluiting(
            "Pedagogische week", new DateOnly(2026, 9, 7), new DateOnly(2026, 9, 13), Sluitingssoort.VrijeDag));

        var (plan, perId) = Plan((Thema("Water", 6, "A-1"), Blok1Start));

        var rapport = Spreidingsrapport.Meet(plan.Plaatsingen, Blokken(), perId, jaar);
        var blok = rapport.Blokken.Single(b => b.Ordinaal == 1);

        Assert.Equal(5.0, blok.BeschikbareWeken);   // open days, not the 6,0 the calendar span would give
        Assert.True(blok.IsOverbelast);             // a 6-week thema no longer "fits" a 5-week period
    }

    [Fact]
    public void Een_jaar_zonder_blokken_levert_een_leeg_rapport_op()
    {
        // Defensive: a schooljaar whose configured grain yields nothing must not throw here.
        var rapport = Spreidingsrapport.Meet([], [], new Dictionary<Guid, Thema>(), Jaar());

        Assert.Equal(0, rapport.AantalBlokken);
        Assert.Empty(rapport.Blokken);
        Assert.Empty(rapport.LegeBlokOrdinalen);
    }
}
