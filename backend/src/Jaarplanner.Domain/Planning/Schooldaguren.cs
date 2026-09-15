using System.Globalization;

namespace Jaarplanner.Domain.Planning;

/// <summary>
/// When the school day begins and ends on one weekday, and when its middagpauze runs (FB-023, ADR-0038).
/// <para>
/// <b>School data, set by directie, one row per weekday, for every klas.</b> The owner ruled on 2026-09-15 that the
/// hours are set per school and not per klas or per schooljaar: a school that changes its hours changes these rows, and
/// nothing already planned moves with them. The hours are where the agenda opens and what it shades as outside the
/// school day; they are <b>not</b> a bell schedule, and a teacher may still plan at any time (ADR-0028 decision 5).
/// </para>
/// <para>
/// <b>Only Monday to Friday.</b> A weekday without a row has no hours set, which the agenda draws as nothing at all
/// rather than as a whole day outside school: an unset setting must not look like a closed day.
/// </para>
/// </summary>
public sealed class Schooldaguren
{
    // EF Core materialisation only.
    private Schooldaguren()
    {
    }

    /// <summary>The hours of one weekday.</summary>
    /// <exception cref="ArgumentException">
    /// A weekend day, an end that is not after the start, a middagpauze with only one of its two times, or a middagpauze
    /// that does not lie inside the school day. Dutch, because every one of them is a value directie typed and can
    /// change (Art. II.3); each names the weekday, so a refusal of a five-day form says which row to look at.
    /// </exception>
    public Schooldaguren(
        DayOfWeek weekdag,
        TimeOnly begin,
        TimeOnly einde,
        TimeOnly? middagpauzeBegin = null,
        TimeOnly? middagpauzeEinde = null)
    {
        if (weekdag is DayOfWeek.Saturday or DayOfWeek.Sunday)
        {
            throw new ArgumentException("Schooluren gelden alleen voor maandag tot vrijdag.");
        }

        Weekdag = weekdag;
        Zet(begin, einde, middagpauzeBegin, middagpauzeEinde);
    }

    /// <summary>Surrogate identity.</summary>
    public Guid Id { get; private set; } = Guid.NewGuid();

    /// <summary>Which weekday these hours are for. Unique across the table: a weekday has one set of hours.</summary>
    public DayOfWeek Weekdag { get; private set; }

    /// <summary>When the school day begins.</summary>
    public TimeOnly Begin { get; private set; }

    /// <summary>When it ends. Always after <see cref="Begin"/>.</summary>
    public TimeOnly Einde { get; private set; }

    /// <summary>When the middagpauze begins, or <c>null</c> on a day without one (a Wednesday with no afternoon).</summary>
    public TimeOnly? MiddagpauzeBegin { get; private set; }

    /// <summary>When it ends. Set exactly when <see cref="MiddagpauzeBegin"/> is.</summary>
    public TimeOnly? MiddagpauzeEinde { get; private set; }

    /// <summary>Gives this weekday new hours, by the same rules as the constructor.</summary>
    /// <exception cref="ArgumentException">As the constructor, and nothing is changed.</exception>
    public void Wijzig(TimeOnly begin, TimeOnly einde, TimeOnly? middagpauzeBegin, TimeOnly? middagpauzeEinde) =>
        Zet(begin, einde, middagpauzeBegin, middagpauzeEinde);

    /// <summary>The weekday as a Dutch sentence says it: <c>maandag</c>, not <c>Monday</c>.</summary>
    public static string Dagnaam(DayOfWeek weekdag) => weekdag switch
    {
        DayOfWeek.Monday => "maandag",
        DayOfWeek.Tuesday => "dinsdag",
        DayOfWeek.Wednesday => "woensdag",
        DayOfWeek.Thursday => "donderdag",
        DayOfWeek.Friday => "vrijdag",
        DayOfWeek.Saturday => "zaterdag",
        _ => "zondag",
    };

    // Every check runs before any field is written, so a refused change leaves the row as it was.
    private void Zet(TimeOnly begin, TimeOnly einde, TimeOnly? middagpauzeBegin, TimeOnly? middagpauzeEinde)
    {
        var dag = Dagnaam(Weekdag);

        if (einde <= begin)
        {
            throw new ArgumentException($"Op {dag} moet de schooldag na het begin eindigen. Kies een later einduur.");
        }

        if (middagpauzeBegin.HasValue != middagpauzeEinde.HasValue)
        {
            throw new ArgumentException(
                $"Vul op {dag} het begin en het einde van de middagpauze in, of laat ze allebei leeg.");
        }

        if (middagpauzeBegin is { } pauzeBegin && middagpauzeEinde is { } pauzeEinde)
        {
            if (pauzeEinde <= pauzeBegin)
            {
                throw new ArgumentException($"Op {dag} moet de middagpauze na haar begin eindigen.");
            }

            // Strictly inside: a pause that starts when school starts or ends when it ends is no pause in the day, it
            // is a shorter day, and the form has a way to say that.
            if (pauzeBegin <= begin || pauzeEinde >= einde)
            {
                throw new ArgumentException(
                    $"Op {dag} moet de middagpauze binnen de schooldag vallen, tussen {Tijd(begin)} en {Tijd(einde)}.");
            }
        }

        Begin = begin;
        Einde = einde;
        MiddagpauzeBegin = middagpauzeBegin;
        MiddagpauzeEinde = middagpauzeEinde;
    }

    // `9:00`, no leading zero: how the agenda prints a time (`toonTijd`) and how the other refusals say one.
    private static string Tijd(TimeOnly tijd) => tijd.ToString(@"H\:mm", CultureInfo.InvariantCulture);
}
