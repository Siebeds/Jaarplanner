using Jaarplanner.Domain.Planning;

namespace Jaarplanner.UnitTests.Planning;

/// <summary>
/// <see cref="AlgemeneFicheplaatsing"/> (owner, 2026-09-11). <b>The test carrying the feature is the one about which
/// Mondays get a row</b>: "turnen every Monday" means every Monday the class is actually in school, so a Monday in the
/// herfstvakantie and a pedagogische studiedag must both be skipped.
/// </summary>
public sealed class AlgemeneFicheplaatsingTests
{
    // 31 August 2026 is a Monday.
    private static readonly DateOnly Start = new(2026, 8, 31);
    private static readonly DateOnly Eind = new(2027, 6, 30);

    private static Schooljaar Jaar()
    {
        var jaar = new Schooljaar("2026-2027", Start, Eind);
        // A whole week off (Monday 7 to Friday 11 September) and one free Monday (21 September).
        jaar.VoegSluitingToe(new Schoolsluiting("Herfst", new DateOnly(2026, 9, 7), new DateOnly(2026, 9, 11)));
        jaar.VoegSluitingToe(new Schoolsluiting(
            "Studiedag",
            new DateOnly(2026, 9, 21),
            new DateOnly(2026, 9, 21),
            Sluitingssoort.VrijeDag));
        return jaar;
    }

    [Fact]
    public void Elke_maandag_is_elke_maandag_waarop_er_school_is()
    {
        var dagen = AlgemeneFicheplaatsing.Herhalingsdagen(
            Jaar(),
            new DateOnly(2026, 8, 31),
            new DateOnly(2026, 9, 30),
            [DayOfWeek.Monday]);

        // September's Mondays are 31/8, 7/9, 14/9, 21/9 and 28/9. The 7th is in the closed week, the 21st is a vrije dag.
        Assert.Equal(
            [new DateOnly(2026, 8, 31), new DateOnly(2026, 9, 14), new DateOnly(2026, 9, 28)],
            dagen);
    }

    [Fact]
    public void Meerdere_weekdagen_leveren_elk_hun_eigen_dagen()
    {
        var dagen = AlgemeneFicheplaatsing.Herhalingsdagen(
            Jaar(),
            new DateOnly(2026, 8, 31),
            new DateOnly(2026, 9, 4),
            [DayOfWeek.Monday, DayOfWeek.Thursday]);

        Assert.Equal([new DateOnly(2026, 8, 31), new DateOnly(2026, 9, 3)], dagen);
    }

    [Fact]
    public void Zonder_weekdag_of_met_een_weekenddag_wordt_geweigerd()
    {
        Assert.Throws<ArgumentException>(() =>
            AlgemeneFicheplaatsing.Herhalingsdagen(Jaar(), Start, Eind, []));

        var fout = Assert.Throws<ArgumentException>(() =>
            AlgemeneFicheplaatsing.Herhalingsdagen(Jaar(), Start, Eind, [DayOfWeek.Saturday]));
        Assert.Contains("maandag tot vrijdag", fout.Message);
    }

    [Fact]
    public void Een_periode_waarin_de_gekozen_dag_nooit_valt_wordt_geweigerd()
    {
        // Only the closed week: its Monday is not a teaching day, so "every Monday" lands nowhere.
        var fout = Assert.Throws<ArgumentException>(() =>
            AlgemeneFicheplaatsing.Herhalingsdagen(
                Jaar(),
                new DateOnly(2026, 9, 7),
                new DateOnly(2026, 9, 11),
                [DayOfWeek.Monday]));

        Assert.Contains("geen enkele schooldag", fout.Message);
    }

    private static readonly TimeOnly HalfElf = new(10, 30);
    private static readonly TimeOnly TwintigOverElf = new(11, 20);

    [Fact]
    public void Een_moment_verplaatsen_blijft_binnen_de_periode_en_begint_niet_twee_keer_op_hetzelfde_uur()
    {
        var plaatsing = new AlgemeneFicheplaatsing(Guid.NewGuid(), Guid.NewGuid(), Start, new DateOnly(2026, 9, 30));
        var maandag = plaatsing.PlanIn(new DateOnly(2026, 8, 31), HalfElf, TwintigOverElf);
        plaatsing.PlanIn(new DateOnly(2026, 9, 14), HalfElf, TwintigOverElf);

        var jaar = Jaar();

        // This week the turnles is on Tuesday, an hour later and a little longer.
        Assert.True(plaatsing.VerplaatsMoment(maandag.Id, new DateOnly(2026, 9, 1), new TimeOnly(11, 30), new TimeOnly(12, 30), jaar));
        Assert.Equal(new DateOnly(2026, 9, 1), maandag.Datum);
        Assert.Equal(new TimeOnly(11, 30), maandag.Begin);
        Assert.Equal(new TimeOnly(12, 30), maandag.Einde);

        Assert.Throws<ArgumentException>(() =>
            plaatsing.VerplaatsMoment(maandag.Id, new DateOnly(2026, 10, 5), HalfElf, TwintigOverElf, jaar));
        Assert.Throws<ArgumentException>(() =>
            plaatsing.VerplaatsMoment(maandag.Id, new DateOnly(2026, 9, 14), HalfElf, TwintigOverElf, jaar));
        Assert.False(plaatsing.VerplaatsMoment(Guid.NewGuid(), new DateOnly(2026, 9, 1), HalfElf, TwintigOverElf, jaar));
    }

    /// <summary>
    /// The whole sentence, not a fragment: its twin is the frontend's <c>fichedetail.geenSchooldag</c>, which the detail
    /// sheet shows for a weekend before sending, and <c>Algemenefichedetailblad.test.tsx</c> pins the same literal. If
    /// either is rewritten alone, one refusal reads two ways depending on whether the day was a weekend or a vakantie.
    /// </summary>
    private const string GeenSchooldag = "Op die dag is er geen school. Kies een schooldag.";

    /// <summary>
    /// Planning never writes a row on a day without school, so moving one must not either (antagonist, E10-03 round 1):
    /// the detail sheet's date field reaches any day of the window, not only the open ones the grid accepts.
    /// </summary>
    [Fact]
    public void Een_moment_verplaatsen_naar_een_dag_zonder_school_wordt_geweigerd()
    {
        var jaar = Jaar();
        var plaatsing = new AlgemeneFicheplaatsing(Guid.NewGuid(), Guid.NewGuid(), Start, new DateOnly(2026, 9, 30));
        var maandag = plaatsing.PlanIn(new DateOnly(2026, 8, 31), HalfElf, TwintigOverElf);

        // A Saturday, a day in the closed week and the vrije dag: all inside the window, none of them a school day.
        foreach (var dag in new[] { new DateOnly(2026, 9, 5), new DateOnly(2026, 9, 8), new DateOnly(2026, 9, 21) })
        {
            var fout = Assert.Throws<ArgumentException>(() =>
                plaatsing.VerplaatsMoment(maandag.Id, dag, HalfElf, TwintigOverElf, jaar));
            Assert.Equal(GeenSchooldag, fout.Message);
        }

        // A refusal moves nothing.
        Assert.Equal(new DateOnly(2026, 8, 31), maandag.Datum);
    }

    [Fact]
    public void Een_einde_dat_niet_na_het_begin_ligt_wordt_geweigerd()
    {
        var plaatsing = new AlgemeneFicheplaatsing(Guid.NewGuid(), Guid.NewGuid(), Start, new DateOnly(2026, 9, 30));

        var fout = Assert.Throws<ArgumentException>(() =>
            plaatsing.PlanIn(new DateOnly(2026, 8, 31), TwintigOverElf, HalfElf));

        Assert.Contains("na het begin", fout.Message);
        Assert.Empty(plaatsing.Momenten);
    }

    [Fact]
    public void Een_periode_die_eindigt_voor_ze_begint_bestaat_niet()
    {
        Assert.Throws<ArgumentException>(() =>
            new AlgemeneFicheplaatsing(Guid.NewGuid(), Guid.NewGuid(), new DateOnly(2026, 9, 2), new DateOnly(2026, 9, 1)));
    }
}
