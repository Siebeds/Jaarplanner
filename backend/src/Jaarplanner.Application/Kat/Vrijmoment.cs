using Jaarplanner.Domain.Planning;

namespace Jaarplanner.Application.Kat;

/// <summary>A stretch of one day that is taken: an activiteit already planned, a fiche, the middagpauze.</summary>
/// <param name="Begin">When it starts.</param>
/// <param name="Einde">When it ends. Not before <paramref name="Begin"/>.</param>
public readonly record struct Tijdvak(TimeOnly Begin, TimeOnly Einde)
{
    /// <summary>Whether this stretch shares a minute with <paramref name="van"/>–<paramref name="tot"/>.</summary>
    public bool Overlapt(TimeOnly van, TimeOnly tot) => Begin < tot && Einde > van;
}

/// <summary>
/// One schooldag the cat may put an activiteit on: when the school day runs, and what is already taken.
/// </summary>
/// <param name="Datum">The day. The caller has already established it is a schooldag of the klas's schooljaar.</param>
/// <param name="Uren">
/// The school's hours for that weekday (FB-023, ADR-0038), or <c>null</c> when admin has set none. A weekday without
/// hours offers no moment: the tool would be inventing when the school day runs.
/// </param>
/// <param name="Bezet">What is already planned on it, in any order.</param>
public sealed record Schooldagvenster(DateOnly Datum, Schooldaguren? Uren, IReadOnlyList<Tijdvak> Bezet);

/// <summary>
/// Where an activiteit still fits (FB-070, ADR-0060 G5; ADR-0062 D1). A pure function over the days the caller offers,
/// so the rule is a unit test and the same call always yields the same moment.
/// <para>
/// <b>Inside the schooluren, never across the middagpauze</b>, and never over something already planned.
/// </para>
/// <para>
/// <b>The AI names a day and an hour; this is what corrects it</b> (ADR-0062 M1, D1). The moment it named is a
/// preference: the search starts there and walks forward, so a model that picks an hour the school cannot give loses
/// the hour and keeps the day. Without a preference, or once the named day runs out, it is the first free moment of
/// the days that follow.
/// </para>
/// <para>
/// <b>It proposes; it does not reserve.</b> Whether the moment is still free when she accepts is checked again there
/// (ADR-0060 D4), because a week passes between the two.
/// </para>
/// </summary>
public static class Vrijmoment
{
    /// <summary>
    /// How long one lesuur runs, in minutes. The <b>same number the agenda draws a new block with</b>
    /// (<c>STANDAARDDUUR</c> in <c>features/plan/tijd.ts</c>): the server stores the times a person picked and knows no
    /// bell schedule (ADR-0028 decision 5), so this is what the tool proposes, not what the school decreed.
    /// </summary>
    public const int MinutenPerLesuur = 50;

    /// <summary>A proposed moment starts on a quarter of an hour, as every gesture in the agenda does.</summary>
    public const int Stap = 15;

    /// <summary>
    /// The first moment of <paramref name="minuten"/> minutes that fits, or <c>null</c> when none of the days has room.
    /// </summary>
    /// <param name="dagen">The days to try, in the order they should be tried.</param>
    /// <param name="minuten">How long the block runs. Must be positive.</param>
    /// <param name="voorkeur">
    /// The day and hour the AI proposed (ADR-0062 M1), or <c>null</c> to take the first free moment of the first day.
    /// The search starts on that day at that hour and walks forward from there; when the day is not among
    /// <paramref name="dagen"/> it is ignored (ADR-0062 D2), and days before it are never used, because a moment the
    /// model did not want is not a better answer than a later one it might have.
    /// </param>
    public static (DateOnly Datum, TimeOnly Begin, TimeOnly Einde)? Zoek(
        IEnumerable<Schooldagvenster> dagen,
        int minuten,
        (DateOnly Datum, TimeOnly Begin)? voorkeur = null)
    {
        ArgumentNullException.ThrowIfNull(dagen);
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(minuten);

        var lijst = dagen.ToList();
        var vanaf = voorkeur is { } gewenst && lijst.Any(d => d.Datum == gewenst.Datum)
            ? lijst.FindIndex(d => d.Datum == gewenst.Datum)
            : 0;

        for (var i = vanaf; i < lijst.Count; i++)
        {
            var dag = lijst[i];
            if (dag.Uren is not { } uren)
            {
                continue;
            }

            // Only the day the model named starts late; every later day starts at its own first free moment.
            var ondergrens = i == vanaf && voorkeur is { } v && v.Datum == dag.Datum ? v.Begin : TimeOnly.MinValue;

            foreach (var (van, tot) in Stukken(uren))
            {
                if (ZoekInStuk(Later(van, ondergrens), tot, dag.Bezet, minuten) is { } begin)
                {
                    return (dag.Datum, begin, begin.AddMinutes(minuten));
                }
            }
        }

        return null;
    }

    /// <summary>The free stretches of one day, in order: what the model is shown, from the same rule the search uses.</summary>
    public static IReadOnlyList<Tijdvak> VrijeStukken(Schooldagvenster dag)
    {
        ArgumentNullException.ThrowIfNull(dag);
        if (dag.Uren is not { } uren)
        {
            return [];
        }

        var vrij = new List<Tijdvak>();
        foreach (var (van, tot) in Stukken(uren))
        {
            var cursor = van;
            foreach (var bezet in dag.Bezet.Where(b => b.Overlapt(van, tot)).OrderBy(b => b.Begin))
            {
                if (bezet.Begin > cursor)
                {
                    vrij.Add(new Tijdvak(cursor, bezet.Begin));
                }

                cursor = Later(cursor, bezet.Einde);
            }

            if (cursor < tot)
            {
                vrij.Add(new Tijdvak(cursor, tot));
            }
        }

        return vrij;
    }

    private static TimeOnly Later(TimeOnly a, TimeOnly b) => a > b ? a : b;

    /// <summary>
    /// The stretches of a school day an activiteit may run in: the whole day, or the two halves around the
    /// middagpauze. A block that would run through lunch is not a block the school can teach.
    /// </summary>
    private static IEnumerable<(TimeOnly Van, TimeOnly Tot)> Stukken(Schooldaguren uren)
    {
        if (uren.MiddagpauzeBegin is { } pauzeBegin && uren.MiddagpauzeEinde is { } pauzeEinde)
        {
            yield return (uren.Begin, pauzeBegin);
            yield return (pauzeEinde, uren.Einde);
        }
        else
        {
            yield return (uren.Begin, uren.Einde);
        }
    }

    /// <summary>
    /// The earliest quarter of an hour in <paramref name="van"/>–<paramref name="tot"/> where the block fits whole and
    /// touches nothing taken, or <c>null</c>.
    /// <para>
    /// Counted in minutes since midnight rather than walked as a <see cref="TimeOnly"/>, which wraps at midnight: a
    /// stretch that reaches the end of the day would step past it and come back as an early morning that is not inside
    /// the stretch at all.
    /// </para>
    /// </summary>
    private static TimeOnly? ZoekInStuk(TimeOnly van, TimeOnly tot, IReadOnlyList<Tijdvak> bezet, int minuten)
    {
        var grens = Minuten(tot);
        for (var begin = NaarKwartier(Minuten(van)); begin + minuten <= grens; begin += Stap)
        {
            var start = Tijd(begin);
            var einde = Tijd(begin + minuten);
            if (!bezet.Any(b => b.Overlapt(start, einde)))
            {
                return start;
            }
        }

        return null;
    }

    /// <summary>The first quarter of an hour on or after <paramref name="minuten"/> minutes past midnight.</summary>
    private static int NaarKwartier(int minuten) => (minuten + Stap - 1) / Stap * Stap;

    private static int Minuten(TimeOnly tijd) => (tijd.Hour * 60) + tijd.Minute;

    private static TimeOnly Tijd(int minuten) => new(minuten / 60, minuten % 60);
}
