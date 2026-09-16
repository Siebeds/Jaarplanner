using Jaarplanner.Domain.Planning;

namespace Jaarplanner.UnitTests.Planning;

/// <summary>
/// The calendar rules every thema placement is built on (ADR-0053 decision 2). Highest-risk planning logic, so each
/// expected date below is worked out by hand in a comment.
/// <para>
/// The year runs from Tuesday 1 September 2026 to Wednesday 30 June 2027, with the herfstvakantie (Mon 2 – Sun 8 Nov),
/// a free day on Wednesday 11 November, the kerstvakantie (21 Dec – 3 Jan), the krokusvakantie (15 – 21 Feb), the
/// paasvakantie (5 – 18 Apr) and a short vacation from Wednesday 12 to Friday 14 May, which leaves Monday and Tuesday of
/// that week as schooldagen.
/// </para>
/// </summary>
public sealed class ThemakalenderTests
{
    private static DateOnly D(int jaar, int maand, int dag) => new(jaar, maand, dag);

    private static Schooljaar Jaar()
    {
        var jaar = new Schooljaar("2026-2027", D(2026, 9, 1), D(2027, 6, 30));
        jaar.VoegSluitingToe(new Schoolsluiting("Herfstvakantie", D(2026, 11, 2), D(2026, 11, 8)));
        jaar.VoegSluitingToe(new Schoolsluiting("Wapenstilstand", D(2026, 11, 11), D(2026, 11, 11), Sluitingssoort.VrijeDag));
        jaar.VoegSluitingToe(new Schoolsluiting("Kerstvakantie", D(2026, 12, 21), D(2027, 1, 3)));
        jaar.VoegSluitingToe(new Schoolsluiting("Krokusvakantie", D(2027, 2, 15), D(2027, 2, 21)));
        jaar.VoegSluitingToe(new Schoolsluiting("Paasvakantie", D(2027, 4, 5), D(2027, 4, 18)));
        jaar.VoegSluitingToe(new Schoolsluiting("Hemelvaart", D(2027, 5, 12), D(2027, 5, 14)));

        return jaar;
    }

    private static Themakalender Kalender() => new(Jaar());

    [Fact]
    public void Een_kalender_vereist_een_schooljaar() =>
        Assert.Throws<ArgumentNullException>(() => new Themakalender(null!));

    [Theory]
    [InlineData(2026, 9, 1, true)] // the first day, a Tuesday
    [InlineData(2026, 9, 5, false)] // a Saturday
    [InlineData(2026, 9, 6, false)] // a Sunday
    [InlineData(2026, 11, 3, false)] // herfstvakantie
    [InlineData(2026, 11, 11, false)] // a free day
    [InlineData(2026, 11, 12, true)] // the day after it
    [InlineData(2026, 8, 31, false)] // before the year
    [InlineData(2027, 7, 1, false)] // after the year
    [InlineData(2027, 6, 30, true)] // the last day, a Wednesday
    public void Een_schooldag_is_een_weekdag_in_het_jaar_zonder_sluiting(int jaar, int maand, int dag, bool verwacht) =>
        Assert.Equal(verwacht, Kalender().IsSchooldag(D(jaar, maand, dag)));

    [Fact]
    public void Een_vrije_dag_is_geen_vakantie_maar_een_vakantiedag_wel()
    {
        var kalender = Kalender();

        Assert.False(kalender.IsVakantie(D(2026, 11, 11)));
        Assert.True(kalender.IsVakantie(D(2026, 11, 7)));
        Assert.False(kalender.IsVakantie(D(2026, 10, 31)));
    }

    [Fact]
    public void De_eerste_en_laatste_schooldag()
    {
        var kalender = Kalender();

        Assert.Equal(D(2026, 9, 1), kalender.EersteSchooldag);
        Assert.Equal(D(2027, 6, 30), kalender.LaatsteSchooldag);

        // A year that starts and ends on a weekend reports its weekdays.
        var weekend = new Themakalender(new Schooljaar("weekend", D(2026, 9, 5), D(2027, 6, 27)));
        Assert.Equal(D(2026, 9, 7), weekend.EersteSchooldag);
        Assert.Equal(D(2027, 6, 25), weekend.LaatsteSchooldag);
    }

    [Theory]
    [InlineData(2026, 9, 6, 2026, 8, 31)] // Sunday belongs to the week that started on Monday before it
    [InlineData(2026, 9, 7, 2026, 9, 7)]
    [InlineData(2026, 9, 11, 2026, 9, 7)]
    public void Maandag_is_het_begin_van_de_week(int j, int m, int d, int mj, int mm, int md) =>
        Assert.Equal(D(mj, mm, md), Themakalender.Maandag(D(j, m, d)));

    [Fact]
    public void Volgende_en_vorige_schooldag()
    {
        var kalender = Kalender();

        Assert.Equal(D(2026, 9, 7), kalender.VolgendeSchooldag(D(2026, 9, 5)));
        Assert.Equal(D(2026, 9, 1), kalender.VolgendeSchooldag(D(2026, 8, 1)));
        Assert.Equal(D(2026, 11, 9), kalender.VolgendeSchooldag(D(2026, 10, 31)));
        Assert.Null(kalender.VolgendeSchooldag(D(2027, 7, 1)));

        // Sunday 8 Nov: the herfstvakantie and its weekend lie before it, so Friday 30 Oct.
        Assert.Equal(D(2026, 10, 30), kalender.VorigeSchooldag(D(2026, 11, 8)));
        Assert.Equal(D(2027, 6, 30), kalender.VorigeSchooldag(D(2027, 8, 1)));
        Assert.Null(kalender.VorigeSchooldag(D(2026, 8, 31)));
    }

    [Fact]
    public void Lesweken_slaan_volledige_vakantieweken_over()
    {
        var weken = Kalender().Lesweken();

        // Mondays from 31 Aug 2026 to 28 Jun 2027: 301 days apart, so 44 weeks. Six of them are all vacation.
        Assert.Equal(38, weken.Count);
        Assert.Equal(D(2026, 8, 31), weken[0]);
        Assert.Equal(D(2027, 6, 28), weken[^1]);
        Assert.All(weken, w => Assert.Equal(DayOfWeek.Monday, w.DayOfWeek));

        foreach (var vakantieweek in new[]
                 {
                     D(2026, 11, 2), D(2026, 12, 21), D(2026, 12, 28), D(2027, 2, 15), D(2027, 4, 5), D(2027, 4, 12),
                 })
        {
            Assert.DoesNotContain(vakantieweek, weken);
        }

        // Partly vacation or holding a free day: still a lesweek.
        Assert.Contains(D(2027, 5, 10), weken);
        Assert.Contains(D(2026, 11, 9), weken);
    }

    [Fact]
    public void Voorgesteld_einde_telt_hele_weken_vanaf_maandag()
    {
        // Mon 7 Sep + 2 lesweken: the target is Mon 21 Sep, so the last schooldag before it is Fri 18 Sep.
        var einde = Kalender().VoorgesteldEinde(D(2026, 9, 7), 2, out var afgekapt);

        Assert.Equal(D(2026, 9, 18), einde);
        Assert.False(afgekapt);
    }

    [Fact]
    public void Voorgesteld_einde_midden_in_de_week_eindigt_de_dag_ervoor_een_week_later()
    {
        // Wed 9 Sep + 1 lesweek: the target is Wed 16 Sep, so Tue 15 Sep.
        Assert.Equal(D(2026, 9, 15), Kalender().VoorgesteldEinde(D(2026, 9, 9), 1, out _));

        // The first week of the year starts on a Tuesday and still counts as a whole week: Tue 1 Sep + 1 → Mon 7 Sep.
        Assert.Equal(D(2026, 9, 7), Kalender().VoorgesteldEinde(D(2026, 9, 1), 1, out _));
    }

    [Fact]
    public void Voorgesteld_einde_slaat_een_volledige_vakantieweek_over()
    {
        // Mon 26 Oct + 2: 26 Oct (1), herfstvakantie skipped, 9 Nov (2), target Mon 16 Nov, so Fri 13 Nov.
        Assert.Equal(D(2026, 11, 13), Kalender().VoorgesteldEinde(D(2026, 10, 26), 2, out _));

        // Mon 14 Dec + 2: 14 Dec (1), both kerstweken skipped, 4 Jan (2), target Mon 11 Jan, so Fri 8 Jan.
        Assert.Equal(D(2027, 1, 8), Kalender().VoorgesteldEinde(D(2026, 12, 14), 2, out _));
    }

    [Fact]
    public void Een_week_die_deels_vakantie_is_telt_als_lesweek()
    {
        // Mon 3 May + 2: 3 May (1), 10 May (2, Mon and Tue are schooldagen), target Mon 17 May. The days before it are
        // the weekend and the vacation of 12–14 May, so the end is Tue 11 May.
        Assert.Equal(D(2027, 5, 11), Kalender().VoorgesteldEinde(D(2027, 5, 3), 2, out _));
    }

    [Fact]
    public void Een_vrije_dag_verschuift_het_einde_niet()
    {
        // Mon 9 Nov + 1: target Mon 16 Nov, so Fri 13 Nov, with Wed 11 Nov simply a day off inside.
        Assert.Equal(D(2026, 11, 13), Kalender().VoorgesteldEinde(D(2026, 11, 9), 1, out _));

        // Tue 10 Nov + 1: target Tue 17 Nov, so Mon 16 Nov.
        Assert.Equal(D(2026, 11, 16), Kalender().VoorgesteldEinde(D(2026, 11, 10), 1, out _));
    }

    [Fact]
    public void Voorbij_het_einde_van_het_jaar_wordt_afgekapt()
    {
        // Mon 21 Jun + 3: 21 Jun (1), 28 Jun (2), 5 Jul (3, past the year), target Mon 12 Jul, so Fri 9 Jul, which is
        // after the last day: cut to Wed 30 Jun.
        var einde = Kalender().VoorgesteldEinde(D(2027, 6, 21), 3, out var afgekapt);

        Assert.Equal(D(2027, 6, 30), einde);
        Assert.True(afgekapt);

        // Mon 28 Jun + 1: target Mon 5 Jul, so Fri 2 Jul, past Wed 30 Jun: cut as well.
        Assert.Equal(D(2027, 6, 30), Kalender().VoorgesteldEinde(D(2027, 6, 28), 1, out var ookAfgekapt));
        Assert.True(ookAfgekapt);
    }

    [Fact]
    public void Precies_passend_op_het_einde_van_het_jaar_is_niet_afgekapt()
    {
        // Thu 24 Jun + 1: 21 Jun (1), 28 Jun (2), target Thu 1 Jul, so Wed 30 Jun: exactly the last day.
        var einde = Kalender().VoorgesteldEinde(D(2027, 6, 24), 1, out var afgekapt);

        Assert.Equal(D(2027, 6, 30), einde);
        Assert.False(afgekapt);

        // Mon 21 Jun + 1: Fri 25 Jun, well inside.
        Assert.Equal(D(2027, 6, 25), Kalender().VoorgesteldEinde(D(2027, 6, 21), 1, out var binnen));
        Assert.False(binnen);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void Minder_dan_een_week_wordt_geweigerd(int weken) =>
        Assert.Throws<ArgumentOutOfRangeException>(() => Kalender().VoorgesteldEinde(D(2026, 9, 7), weken, out _));

    [Theory]
    [InlineData(2026, 9, 7, 2026, 9, 18, 2)] // exactly two weeks
    [InlineData(2026, 9, 7, 2026, 9, 17, 1)] // a day short of two
    [InlineData(2026, 9, 7, 2026, 9, 10, 0)] // not even one
    [InlineData(2026, 10, 26, 2026, 11, 13, 2)] // over the herfstvakantie
    [InlineData(2027, 6, 21, 2027, 6, 30, 1)] // the year cuts the second week
    public void Volle_lesweken(int vj, int vm, int vd, int tj, int tm, int td, int verwacht) =>
        Assert.Equal(verwacht, Kalender().VolleLesweken(D(vj, vm, vd), D(tj, tm, td)));

    [Fact]
    public void Voorgesteld_einde_en_volle_lesweken_zijn_elkaars_omgekeerde()
    {
        var kalender = Kalender();

        foreach (var begin in new[] { D(2026, 9, 1), D(2026, 10, 21), D(2026, 12, 16), D(2027, 3, 1) })
        {
            for (var weken = 1; weken <= 6; weken++)
            {
                var einde = kalender.VoorgesteldEinde(begin, weken, out var afgekapt);
                Assert.False(afgekapt);
                Assert.Equal(weken, kalender.VolleLesweken(begin, einde));
            }
        }
    }

    [Fact]
    public void Splitsen_bij_een_vakantie()
    {
        Assert.Equal(
            [(D(2026, 10, 26), D(2026, 10, 30)), (D(2026, 11, 9), D(2026, 11, 13))],
            Kalender().Splits(D(2026, 10, 26), D(2026, 11, 13)));
    }

    [Fact]
    public void Splitsen_bij_twee_vakanties()
    {
        Assert.Equal(
            [
                (D(2026, 12, 14), D(2026, 12, 18)),
                (D(2027, 1, 4), D(2027, 2, 12)),
                (D(2027, 2, 22), D(2027, 2, 26)),
            ],
            Kalender().Splits(D(2026, 12, 14), D(2027, 2, 26)));
    }

    [Fact]
    public void Delen_worden_bijgeknipt_tot_schooldagen()
    {
        // Sat 5 – Sun 13 Sep: the weekend at each end is not part of the thema.
        Assert.Equal([(D(2026, 9, 7), D(2026, 9, 11))], Kalender().Splits(D(2026, 9, 5), D(2026, 9, 13)));

        // Fri 30 Oct – Mon 9 Nov: a one-day part on each side of the vacation and its weekend.
        Assert.Equal(
            [(D(2026, 10, 30), D(2026, 10, 30)), (D(2026, 11, 9), D(2026, 11, 9))],
            Kalender().Splits(D(2026, 10, 30), D(2026, 11, 9)));
    }

    [Fact]
    public void Zonder_schooldag_is_er_geen_deel()
    {
        Assert.Empty(Kalender().Splits(D(2026, 11, 2), D(2026, 11, 8)));
        Assert.Empty(Kalender().Splits(D(2026, 9, 5), D(2026, 9, 6)));
        Assert.Empty(Kalender().Splits(D(2026, 9, 10), D(2026, 9, 9)));
    }

    [Fact]
    public void Een_vrije_dag_splitst_niet_en_een_deels_vakantieweek_wel()
    {
        Assert.Equal([(D(2026, 11, 9), D(2026, 11, 13))], Kalender().Splits(D(2026, 11, 9), D(2026, 11, 13)));

        Assert.Equal(
            [(D(2027, 5, 10), D(2027, 5, 11)), (D(2027, 5, 17), D(2027, 5, 18))],
            Kalender().Splits(D(2027, 5, 10), D(2027, 5, 18)));
    }

    [Fact]
    public void Schooldagen_tellen()
    {
        var kalender = Kalender();

        Assert.Equal(4, kalender.TelSchooldagen(D(2026, 11, 9), D(2026, 11, 13)));
        Assert.Equal(0, kalender.TelSchooldagen(D(2026, 10, 31), D(2026, 11, 8)));
        Assert.Equal(0, kalender.TelSchooldagen(D(2026, 9, 10), D(2026, 9, 9)));
    }

    [Fact]
    public void Einde_na_schooldagen_loopt_over_een_vakantie_en_een_vrije_dag()
    {
        var kalender = Kalender();

        // Fri 30 Oct, then Mon 9 and Tue 10 Nov.
        Assert.Equal(D(2026, 11, 10), kalender.EindeNaSchooldagen(D(2026, 10, 30), 3));

        // Mon 9, Tue 10, (free Wed 11), Thu 12 Nov.
        Assert.Equal(D(2026, 11, 12), kalender.EindeNaSchooldagen(D(2026, 11, 9), 3));

        // One day is the day itself.
        Assert.Equal(D(2026, 11, 9), kalender.EindeNaSchooldagen(D(2026, 11, 9), 1));
    }

    [Fact]
    public void Einde_na_schooldagen_stopt_op_het_einde_van_het_jaar() =>
        Assert.Equal(D(2027, 6, 30), Kalender().EindeNaSchooldagen(D(2027, 6, 28), 10));

    [Theory]
    [InlineData(2026, 10, 26, 2026, 11, 13, true)] // the herfstvakantie lies inside
    [InlineData(2026, 11, 7, 2026, 11, 9, true)] // touches the vacation's last days
    [InlineData(2026, 11, 9, 2026, 11, 13, false)] // a free day inside is fine
    [InlineData(2026, 8, 31, 2026, 9, 4, true)] // starts before the year
    [InlineData(2027, 6, 28, 2027, 7, 2, true)] // ends after the year
    [InlineData(2026, 9, 1, 2026, 10, 30, false)]
    public void Vervallen_als_er_een_vakantie_in_ligt_of_het_buiten_het_jaar_valt(
        int vj, int vm, int vd, int tj, int tm, int td, bool verwacht) =>
        Assert.Equal(verwacht, Kalender().IsVervallen(D(vj, vm, vd), D(tj, tm, td)));
}
