using Jaarplanner.Domain.Planning;

namespace Jaarplanner.UnitTests.Planning;

/// <summary>
/// E9-02: the second day count — open <b>weekdays</b>, the figure a teacher recognises as "schooldagen".
/// <para>
/// <b>The test that matters most here is the separation one.</b> A codebase with two day counts is one substitution
/// away from a real regression, and the substitution is tempting because this count is the one a human would call
/// correct.
/// </para>
/// </summary>
public sealed class OpenWeekdagenTests
{
    /// <summary>
    /// Five calendar weeks with no closures: 35 open days, 25 open weekdays. **This is the whole reason the second
    /// count exists** — printing `AantalOpenDagen` as "schooldagen" would tell a teacher their 5-week autumn thema has
    /// 35 school days.
    /// </summary>
    [Fact]
    public void Vijf_weken_zonder_sluitingen_zijn_35_open_dagen_en_25_open_weekdagen()
    {
        var schooljaar = TestSchooljaar.Maak();

        // Monday 2026-09-07 through Sunday 2026-10-11 — exactly five calendar weeks.
        var start = new DateOnly(2026, 9, 7);
        var eind = new DateOnly(2026, 10, 11);

        Assert.Equal(35, schooljaar.TelOpenDagen(start, eind));
        Assert.Equal(25, schooljaar.TelOpenWeekdagen(start, eind));
    }

    /// <summary>
    /// <b>The separation, stated as an executable claim.</b> `BeschikbareWeken` is `ceil(TelOpenDagen / 7)` and is the
    /// sole definition of te vol (owner ruling 2026-07-31). If someone ever swaps in the weekday count, a nominal
    /// 5-week thema starts overloading the period built for it — `ceil(25/7)` is 4, not 5.
    /// <para>
    /// Asserted as arithmetic rather than by reaching into the spreading report, so it holds wherever that rounding
    /// lives.
    /// </para>
    /// </summary>
    [Fact]
    public void De_wekenberekening_mag_de_weekdagtelling_nooit_gebruiken()
    {
        var schooljaar = TestSchooljaar.Maak();
        var start = new DateOnly(2026, 9, 7);
        var eind = new DateOnly(2026, 10, 11);

        var uitOpenDagen = (int)Math.Ceiling(schooljaar.TelOpenDagen(start, eind) / 7.0);
        var uitWeekdagen = (int)Math.Ceiling(schooljaar.TelOpenWeekdagen(start, eind) / 7.0);

        Assert.Equal(5, uitOpenDagen);

        // The wrong answer, spelled out so the cost of the substitution is visible rather than implied.
        Assert.Equal(4, uitWeekdagen);
        Assert.NotEqual(uitOpenDagen, uitWeekdagen);
    }

    /// <summary>A vrije dag on a weekday costs a school day; the same day would also have cost an open day.</summary>
    [Fact]
    public void Een_vrije_dag_op_een_weekdag_gaat_van_beide_tellingen_af()
    {
        var schooljaar = TestSchooljaar.Maak();
        // Thursday 2026-05-14 is inside the year; a single free day does not split a block (ADR-0020 §5).
        schooljaar.VoegSluitingToe(new Schoolsluiting(
            "Hemelvaart", new DateOnly(2027, 5, 6), new DateOnly(2027, 5, 6), Sluitingssoort.VrijeDag));

        var start = new DateOnly(2027, 5, 3);
        var eind = new DateOnly(2027, 5, 9);

        Assert.Equal(6, schooljaar.TelOpenDagen(start, eind));
        Assert.Equal(4, schooljaar.TelOpenWeekdagen(start, eind));
    }

    /// <summary>
    /// A closure that falls entirely on a weekend costs an open day but no school day — which is the asymmetry that
    /// makes the two counts genuinely different facts rather than one scaled by 5/7.
    /// </summary>
    [Fact]
    public void Een_sluiting_in_het_weekend_kost_geen_schooldag()
    {
        var schooljaar = TestSchooljaar.Maak();
        // Saturday and Sunday.
        schooljaar.VoegSluitingToe(new Schoolsluiting(
            "Schoolfeest", new DateOnly(2026, 9, 12), new DateOnly(2026, 9, 13), Sluitingssoort.VrijeDag));

        var start = new DateOnly(2026, 9, 7);
        var eind = new DateOnly(2026, 9, 13);

        Assert.Equal(5, schooljaar.TelOpenDagen(start, eind));
        Assert.Equal(5, schooljaar.TelOpenWeekdagen(start, eind));
    }

    /// <summary>A whole vakantie week yields nothing on either count.</summary>
    [Fact]
    public void Een_vakantieweek_levert_geen_enkele_dag()
    {
        var schooljaar = TestSchooljaar.MetVakanties();

        Assert.Equal(0, schooljaar.TelOpenDagen(new DateOnly(2026, 11, 2), new DateOnly(2026, 11, 8)));
        Assert.Equal(0, schooljaar.TelOpenWeekdagen(new DateOnly(2026, 11, 2), new DateOnly(2026, 11, 8)));
    }

    /// <summary>
    /// Days outside the school year count on neither: `IsLesdag` bounds the year, and this delegates to it rather than
    /// re-deriving the bounds.
    /// </summary>
    [Fact]
    public void Dagen_buiten_het_schooljaar_tellen_niet_mee()
    {
        var schooljaar = TestSchooljaar.Maak();

        Assert.Equal(0, schooljaar.TelOpenWeekdagen(new DateOnly(2026, 8, 24), new DateOnly(2026, 8, 28)));
    }
}
