namespace Jaarplanner.Domain.Planning;

/// <summary>
/// The calendar questions a jaarplan asks of a <see cref="Schooljaar"/>, answered in one place (ADR-0049 decision 2).
/// <para>
/// <b>A schooldag</b> is a weekday on which <see cref="Schooljaar.IsLesdag"/> holds. <b>A lesweek</b> is a
/// Monday-to-Friday week holding at least one schooldag. Every rule below is stated in those two terms, so the plan
/// screen, the placement service, the weekplanning and the demo data cannot come to count differently.
/// </para>
/// <para>
/// <b>A vacation splits, a free day does not.</b> A closure of kind <see cref="Sluitingssoort.Vakantie"/>
/// (<see cref="Schoolsluiting.BreektPeriode"/>) interrupts a thema, so a placement is stored as parts around it. A
/// <see cref="Sluitingssoort.VrijeDag"/> and a weekend are simply days on which nothing is taught.
/// </para>
/// </summary>
public sealed class Themakalender
{
    private readonly Schooljaar _schooljaar;

    /// <summary>Answers calendar questions about <paramref name="schooljaar"/>.</summary>
    public Themakalender(Schooljaar schooljaar)
    {
        _schooljaar = schooljaar ?? throw new ArgumentNullException(nameof(schooljaar));
        LaatsteSchooldag = VorigeSchooldag(schooljaar.Eind) ?? schooljaar.Eind;
        EersteSchooldag = VolgendeSchooldag(schooljaar.Start) ?? schooljaar.Start;
    }

    /// <summary>The first schooldag of the year, or the year's start when it has none.</summary>
    public DateOnly EersteSchooldag { get; }

    /// <summary>The last schooldag of the year, or the year's end when it has none.</summary>
    public DateOnly LaatsteSchooldag { get; }

    /// <summary>Whether <paramref name="datum"/> is a weekday inside the year that no closure covers.</summary>
    public bool IsSchooldag(DateOnly datum) => IsWeekdag(datum) && _schooljaar.IsLesdag(datum);

    /// <summary>Whether a closure of kind <see cref="Sluitingssoort.Vakantie"/> covers <paramref name="datum"/>.</summary>
    public bool IsVakantie(DateOnly datum) => _schooljaar.Vakanties.Any(v => v.Bevat(datum));

    /// <summary>The Monday of the week <paramref name="datum"/> falls in.</summary>
    public static DateOnly Maandag(DateOnly datum) => datum.AddDays(-(((int)datum.DayOfWeek + 6) % 7));

    /// <summary>The first schooldag on or after <paramref name="datum"/>, or null when the year has none left.</summary>
    public DateOnly? VolgendeSchooldag(DateOnly datum)
    {
        for (var dag = datum < _schooljaar.Start ? _schooljaar.Start : datum; dag <= _schooljaar.Eind; dag = dag.AddDays(1))
        {
            if (IsSchooldag(dag))
            {
                return dag;
            }
        }

        return null;
    }

    /// <summary>The last schooldag on or before <paramref name="datum"/>, or null when the year has none before it.</summary>
    public DateOnly? VorigeSchooldag(DateOnly datum)
    {
        for (var dag = datum > _schooljaar.Eind ? _schooljaar.Eind : datum; dag >= _schooljaar.Start; dag = dag.AddDays(-1))
        {
            if (IsSchooldag(dag))
            {
                return dag;
            }
        }

        return null;
    }

    /// <summary>The Monday of every lesweek of the year, chronological.</summary>
    public IReadOnlyList<DateOnly> Lesweken()
    {
        var weken = new List<DateOnly>();
        for (var maandag = Maandag(_schooljaar.Start); maandag <= _schooljaar.Eind; maandag = maandag.AddDays(7))
        {
            if (IsLesweek(maandag))
            {
                weken.Add(maandag);
            }
        }

        return weken;
    }

    /// <summary>Whether the week starting on <paramref name="maandag"/> holds a schooldag.</summary>
    public bool IsLesweek(DateOnly maandag)
    {
        for (var dag = 0; dag < 5; dag++)
        {
            if (IsSchooldag(maandag.AddDays(dag)))
            {
                return true;
            }
        }

        return false;
    }

    /// <summary>
    /// The end the tool proposes for a thema of <paramref name="weken"/> lesweken starting on <paramref name="begin"/>:
    /// the last schooldag before the same weekday <paramref name="weken"/> lesweken later.
    /// <para>
    /// The week of <paramref name="begin"/> counts as the first lesweek, whatever day of it the thema starts on, and a
    /// week without a schooldag is skipped. Beyond the last day of the year the count goes on over virtual full weeks,
    /// so a thema that fits exactly into the year's last weeks is not reported as cut; one that would run past the
    /// year ends on <see cref="LaatsteSchooldag"/> and <paramref name="afgekapt"/> is set (ADR-0049 R5).
    /// </para>
    /// </summary>
    /// <param name="begin">The first day. Expected to be a schooldag; the caller checks.</param>
    /// <param name="weken">The thema's duration in weeks, at least 1.</param>
    /// <param name="afgekapt">Set when the proposed end had to be cut to the last schooldag.</param>
    public DateOnly VoorgesteldEinde(DateOnly begin, int weken, out bool afgekapt)
    {
        if (weken < 1)
        {
            throw new ArgumentOutOfRangeException(nameof(weken), weken, "A thema lasts at least one week.");
        }

        var weekdag = begin.DayNumber - Maandag(begin).DayNumber;
        var maandag = Maandag(begin);
        var geteld = 0;

        while (true)
        {
            if (IsLesweekOfVoorbijHetJaar(maandag))
            {
                geteld++;
                if (geteld == weken + 1)
                {
                    break;
                }
            }

            maandag = maandag.AddDays(7);
        }

        var doel = maandag.AddDays(weekdag);
        var einde = doel.AddDays(-1);
        while (einde > begin && !IsSchooldagOfVoorbijHetJaar(einde))
        {
            einde = einde.AddDays(-1);
        }

        afgekapt = einde > _schooljaar.Eind;

        return afgekapt ? LaatsteSchooldag : einde;
    }

    /// <summary>
    /// The number of whole lesweken a stretch from <paramref name="begin"/> to <paramref name="einde"/> spans: the
    /// largest <c>k</c> whose <see cref="VoorgesteldEinde"/> does not lie after <paramref name="einde"/>. Zero when not
    /// even one week fits.
    /// </summary>
    public int VolleLesweken(DateOnly begin, DateOnly einde)
    {
        var weken = 0;
        while (weken < 60)
        {
            var volgende = VoorgesteldEinde(begin, weken + 1, out var afgekapt);
            if (afgekapt || volgende > einde)
            {
                return weken;
            }

            weken++;
        }

        return weken;
    }

    /// <summary>
    /// Cuts <paramref name="van"/>–<paramref name="tot"/> at every vacation and trims each part to schooldagen. A part
    /// that holds no schooldag is dropped, so the result may be empty.
    /// </summary>
    public IReadOnlyList<(DateOnly Van, DateOnly Tot)> Splits(DateOnly van, DateOnly tot)
    {
        var delen = new List<(DateOnly Van, DateOnly Tot)>();
        DateOnly? eerste = null;
        DateOnly? laatste = null;

        for (var dag = van; dag <= tot; dag = dag.AddDays(1))
        {
            if (IsVakantie(dag))
            {
                Sluit();
                continue;
            }

            if (IsSchooldag(dag))
            {
                eerste ??= dag;
                laatste = dag;
            }
        }

        Sluit();

        return delen;

        void Sluit()
        {
            if (eerste is not null && laatste is not null)
            {
                delen.Add((eerste.Value, laatste.Value));
            }

            eerste = null;
            laatste = null;
        }
    }

    /// <summary>The schooldagen from <paramref name="van"/> to <paramref name="tot"/>, inclusive.</summary>
    public int TelSchooldagen(DateOnly van, DateOnly tot)
    {
        var aantal = 0;
        for (var dag = van; dag <= tot; dag = dag.AddDays(1))
        {
            if (IsSchooldag(dag))
            {
                aantal++;
            }
        }

        return aantal;
    }

    /// <summary>
    /// The end of a stretch that starts on <paramref name="begin"/> and holds <paramref name="schooldagen"/> schooldagen,
    /// walking over vacations. Stops at <see cref="LaatsteSchooldag"/> when the year runs out first.
    /// </summary>
    public DateOnly EindeNaSchooldagen(DateOnly begin, int schooldagen)
    {
        var geteld = 0;
        var einde = begin;
        for (var dag = begin; dag <= _schooljaar.Eind; dag = dag.AddDays(1))
        {
            if (!IsSchooldag(dag))
            {
                continue;
            }

            einde = dag;
            geteld++;
            if (geteld >= schooldagen)
            {
                break;
            }
        }

        return einde;
    }

    /// <summary>
    /// Whether a placement from <paramref name="van"/> to <paramref name="tot"/> no longer fits the year as it stands: a
    /// vacation lies inside it, or it reaches outside the year (ADR-0049 decision 5).
    /// </summary>
    public bool IsVervallen(DateOnly van, DateOnly tot)
    {
        if (van < _schooljaar.Start || tot > _schooljaar.Eind)
        {
            return true;
        }

        return _schooljaar.Vakanties.Any(v => v.Start <= tot && v.Eind >= van);
    }

    private static bool IsWeekdag(DateOnly datum) =>
        datum.DayOfWeek is not (DayOfWeek.Saturday or DayOfWeek.Sunday);

    // Past the end of the year every weekday counts, so a thema's proposed end can be measured against a year that
    // stopped too early and cut afterwards, instead of counting only the weeks that happen to remain.
    private bool IsSchooldagOfVoorbijHetJaar(DateOnly datum) =>
        datum > _schooljaar.Eind ? IsWeekdag(datum) : IsSchooldag(datum);

    private bool IsLesweekOfVoorbijHetJaar(DateOnly maandag) =>
        maandag.AddDays(4) > _schooljaar.Eind || IsLesweek(maandag);
}
