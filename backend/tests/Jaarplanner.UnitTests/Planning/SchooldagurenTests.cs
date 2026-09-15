using Jaarplanner.Domain.Planning;

namespace Jaarplanner.UnitTests.Planning;

/// <summary>
/// The rules about one weekday's school hours (FB-023, ADR-0038). Every refusal is a sentence directie reads, so each
/// one is checked by its value and must name the weekday: the form holds five days and has to say which is wrong.
/// </summary>
public sealed class SchooldagurenTests
{
    private static TimeOnly T(int uur, int minuut = 0) => new(uur, minuut);

    [Fact]
    public void Een_dag_met_middagpauze_houdt_zijn_vier_uren()
    {
        var maandag = new Schooldaguren(DayOfWeek.Monday, T(8, 30), T(15, 30), T(12), T(13, 15));

        Assert.Equal((T(8, 30), T(15, 30)), (maandag.Begin, maandag.Einde));
        Assert.Equal((T(12), T(13, 15)), (maandag.MiddagpauzeBegin, maandag.MiddagpauzeEinde));
    }

    [Fact]
    public void Een_woensdag_zonder_namiddag_heeft_geen_middagpauze()
    {
        var woensdag = new Schooldaguren(DayOfWeek.Wednesday, T(8, 30), T(12));

        Assert.Null(woensdag.MiddagpauzeBegin);
        Assert.Null(woensdag.MiddagpauzeEinde);
    }

    [Theory]
    [InlineData(15, 30, 8, 30)]
    [InlineData(8, 30, 8, 30)]
    public void Een_einde_dat_niet_na_het_begin_ligt_wordt_geweigerd(int bu, int bm, int eu, int em)
    {
        var fout = Assert.Throws<ArgumentException>(() => new Schooldaguren(DayOfWeek.Tuesday, T(bu, bm), T(eu, em)));

        Assert.Equal("Op dinsdag moet de schooldag na het begin eindigen. Kies een later einduur.", fout.Message);
    }

    [Fact]
    public void Een_middagpauze_met_maar_een_van_haar_twee_uren_wordt_geweigerd()
    {
        var fout = Assert.Throws<ArgumentException>(
            () => new Schooldaguren(DayOfWeek.Thursday, T(8, 30), T(15, 30), T(12), null));

        Assert.Equal(
            "Vul op donderdag het begin en het einde van de middagpauze in, of laat ze allebei leeg.",
            fout.Message);
    }

    [Fact]
    public void Een_middagpauze_die_eindigt_voor_ze_begint_wordt_geweigerd()
    {
        var fout = Assert.Throws<ArgumentException>(
            () => new Schooldaguren(DayOfWeek.Friday, T(8, 30), T(15, 30), T(13, 15), T(12)));

        Assert.Equal("Op vrijdag moet de middagpauze na haar begin eindigen.", fout.Message);
    }

    // Past either edge, and touching either edge: a pause from the first bell or up to the last is a shorter day.
    [Theory]
    [InlineData(7, 0, 8, 0)]
    [InlineData(8, 30, 9, 0)]
    [InlineData(15, 0, 15, 30)]
    [InlineData(15, 0, 16, 0)]
    public void Een_middagpauze_buiten_de_schooldag_wordt_geweigerd(int bu, int bm, int eu, int em)
    {
        var fout = Assert.Throws<ArgumentException>(
            () => new Schooldaguren(DayOfWeek.Monday, T(8, 30), T(15, 30), T(bu, bm), T(eu, em)));

        Assert.Equal("Op maandag moet de middagpauze binnen de schooldag vallen, tussen 8:30 en 15:30.", fout.Message);
    }

    [Theory]
    [InlineData(DayOfWeek.Saturday)]
    [InlineData(DayOfWeek.Sunday)]
    public void Een_weekenddag_krijgt_geen_schooluren(DayOfWeek dag)
    {
        var fout = Assert.Throws<ArgumentException>(() => new Schooldaguren(dag, T(8, 30), T(12)));

        Assert.Equal("Schooluren gelden alleen voor maandag tot vrijdag.", fout.Message);
    }

    [Fact]
    public void Een_geweigerde_wijziging_laat_de_dag_zoals_hij_was()
    {
        var maandag = new Schooldaguren(DayOfWeek.Monday, T(8, 30), T(15, 30), T(12), T(13, 15));

        Assert.Throws<ArgumentException>(() => maandag.Wijzig(T(9), T(16), T(8), T(9)));

        Assert.Equal((T(8, 30), T(15, 30)), (maandag.Begin, maandag.Einde));
        Assert.Equal((T(12), T(13, 15)), (maandag.MiddagpauzeBegin, maandag.MiddagpauzeEinde));
    }
}
