namespace Jaarplanner.Domain.Planning;

/// <summary>
/// One concrete appearance of a placed hoek in the timetable: this day, this lesuur (owner, 2026-08-30).
/// <para>
/// <b>THIS IS A ROW PER DAY, AND THE FIRST VERSION OF THIS FEATURE DERIVED IT INSTEAD.</b> A hoek placed over
/// three weeks with one lesuur was going to be read as fifteen appearances computed from the window, which keeps
/// the database small and makes every one of the fifteen identical by construction. The owner rejected that on
/// the ground it was built to save: <i>"als leerkracht wil ik flexibel kunnen zijn"</i>. A derived appearance
/// cannot be moved to another lesuur on one Thursday, because there is nothing there to move. So the fifteen are
/// stored, and each one can be dragged or deleted on its own.
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
    /// <param name="volgorde">The lesuur slot, zero-based like <see cref="Activiteitplaatsing.Volgorde"/>.</param>
    public Hoekmoment(Guid hoekplaatsingId, DateOnly datum, int volgorde)
    {
        if (hoekplaatsingId == Guid.Empty)
        {
            throw new ArgumentException("'hoekplaatsingId' is required.", nameof(hoekplaatsingId));
        }

        HoekplaatsingId = hoekplaatsingId;
        Datum = datum;
        Volgorde = RequireSlot(volgorde);
    }

    /// <summary>Surrogate identity.</summary>
    public Guid Id { get; private set; } = Guid.NewGuid();

    /// <summary>The placement this appearance belongs to.</summary>
    public Guid HoekplaatsingId { get; private set; }

    /// <summary>The teaching day it appears on.</summary>
    public DateOnly Datum { get; private set; }

    /// <summary>The lesuur slot within that day, zero-based.</summary>
    public int Volgorde { get; private set; }

    /// <summary>
    /// Moves this one appearance. The caller is <see cref="Hoekplaatsing.VerplaatsMoment"/> rather than a screen,
    /// because whether the new day is still inside the placement is a question only the placement can answer.
    /// </summary>
    internal void Verplaats(DateOnly datum, int volgorde)
    {
        Datum = datum;
        Volgorde = RequireSlot(volgorde);
    }

    private static int RequireSlot(int volgorde) =>
        volgorde < 0
            ? throw new ArgumentException("A lesuur slot cannot be negative.", nameof(volgorde))
            : volgorde;
}
