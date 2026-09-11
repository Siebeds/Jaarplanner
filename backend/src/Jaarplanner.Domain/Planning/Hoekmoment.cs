namespace Jaarplanner.Domain.Planning;

/// <summary>
/// One concrete appearance of a placed hoek in the timetable: this day, from this time to that one (owner,
/// 2026-08-30; clock times since 2026-09-11, ADR-0027).
/// <para>
/// <b>THIS IS A ROW PER DAY, AND THE FIRST VERSION OF THIS FEATURE DERIVED IT INSTEAD.</b> A hoek placed over
/// three weeks was going to be read as fifteen appearances computed from the window, which keeps the database small
/// and makes every one of the fifteen identical by construction. The owner rejected that on the ground it was built
/// to save: <i>"als leerkracht wil ik flexibel kunnen zijn"</i>. A derived appearance cannot be moved to another hour
/// on one Thursday, because there is nothing there to move. So the fifteen are stored, and each one can be dragged
/// or resized on its own.
/// </para>
/// <para>
/// <b>The cost is real and is accepted rather than hidden:</b> shortening a placement now has fifteen rows to
/// account for, which is why <see cref="Hoekplaatsing.Herzet"/> reports how many it dropped instead of doing it
/// quietly.
/// </para>
/// <para>
/// <b>It carries no verrijking of its own.</b> What is in the corner on a given day is read from the placement's
/// <see cref="Hoekverrijking"/>en by date. Two appearances of the same hoek on one day with <i>different</i>
/// enrichments, which the owner also asked for, are two placements rather than two moments: each drag of a fiche
/// makes its own placement, so each carries its own text. Putting a verrijking here as well would give the same
/// day two places to answer from, and they would disagree.
/// </para>
/// </summary>
public sealed class Hoekmoment
{
    // EF Core materialisation only.
    private Hoekmoment()
    {
    }

    /// <summary>Schedules one appearance of a placed hoek.</summary>
    /// <param name="hoekplaatsingId">The placement this appearance belongs to.</param>
    /// <param name="datum">The teaching day. That it is one is checked by the service, which holds the calendar.</param>
    /// <param name="begin">When the corner opens that day.</param>
    /// <param name="einde">When it closes. Must lie after <paramref name="begin"/>.</param>
    /// <exception cref="ArgumentException">
    /// The end is not after the start. Dutch, unlike the id guard: both times came from the teacher's own sheet or her
    /// own drag, so this is a sentence she can act on (Art. II.3).
    /// </exception>
    public Hoekmoment(Guid hoekplaatsingId, DateOnly datum, TimeOnly begin, TimeOnly einde)
    {
        if (hoekplaatsingId == Guid.Empty)
        {
            throw new ArgumentException("'hoekplaatsingId' is required.", nameof(hoekplaatsingId));
        }

        HoekplaatsingId = hoekplaatsingId;
        Datum = datum;
        (Begin, Einde) = RequireTijden(begin, einde);
    }

    /// <summary>Surrogate identity.</summary>
    public Guid Id { get; private set; } = Guid.NewGuid();

    /// <summary>The placement this appearance belongs to.</summary>
    public Guid HoekplaatsingId { get; private set; }

    /// <summary>The teaching day it appears on.</summary>
    public DateOnly Datum { get; private set; }

    /// <summary>When the corner opens that day.</summary>
    public TimeOnly Begin { get; private set; }

    /// <summary>When it closes that day.</summary>
    public TimeOnly Einde { get; private set; }

    /// <summary>
    /// Moves or resizes this one appearance. The caller is <see cref="Hoekplaatsing.VerplaatsMoment"/> rather than a
    /// screen, because whether the new day is still inside the placement is a question only the placement can answer.
    /// </summary>
    internal void Verplaats(DateOnly datum, TimeOnly begin, TimeOnly einde)
    {
        (Begin, Einde) = RequireTijden(begin, einde);
        Datum = datum;
    }

    private static (TimeOnly Begin, TimeOnly Einde) RequireTijden(TimeOnly begin, TimeOnly einde) =>
        einde > begin
            ? (begin, einde)
            : throw new ArgumentException("Het einde van de hoek moet na het begin liggen. Kies een later einduur.");
}
