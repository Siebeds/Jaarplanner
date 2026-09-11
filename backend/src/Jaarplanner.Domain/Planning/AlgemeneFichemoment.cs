namespace Jaarplanner.Domain.Planning;

/// <summary>
/// One occurrence of a planned algemene fiche in the timetable: this day, from this time to that one (owner,
/// 2026-09-11).
/// <para>
/// <b>A row per day, for the reason <see cref="Hoekmoment"/> gives.</b> "Turnen every Monday at half past ten" could
/// be derived from a rule, but a derived occurrence cannot be moved: the week the gym is taken by the schoolfeest, the
/// teacher drags that one Monday's turnles to Tuesday, and there has to be a row to drag.
/// </para>
/// <para>
/// <b>Clock times, not a lesuur number</b>, because the agenda's day view moved to a time grid on the same day
/// (owner, 2026-09-11) and <see cref="Hoekmoment"/> and <see cref="Activiteitplaatsing"/> carry the same
/// <see cref="Begin"/>/<see cref="Einde"/> pair. A fiche on another axis than the things it sits between would be a
/// second answer to "what happens at 10:30".
/// </para>
/// </summary>
public sealed class AlgemeneFichemoment
{
    // EF Core materialisation only.
    private AlgemeneFichemoment()
    {
    }

    /// <summary>Schedules one occurrence.</summary>
    /// <param name="plaatsingId">The placement this occurrence belongs to.</param>
    /// <param name="datum">The teaching day. That it is one is the service's check, which holds the calendar.</param>
    /// <param name="begin">When it starts that day.</param>
    /// <param name="einde">When it ends. Must lie after <paramref name="begin"/>.</param>
    /// <exception cref="ArgumentException">
    /// The end is not after the start. Dutch: both times come from the teacher's own sheet or her own drag.
    /// </exception>
    public AlgemeneFichemoment(Guid plaatsingId, DateOnly datum, TimeOnly begin, TimeOnly einde)
    {
        if (plaatsingId == Guid.Empty)
        {
            throw new ArgumentException("'plaatsingId' is required.", nameof(plaatsingId));
        }

        PlaatsingId = plaatsingId;
        Datum = datum;
        (Begin, Einde) = RequireTijden(begin, einde);
    }

    /// <summary>Surrogate identity.</summary>
    public Guid Id { get; private set; } = Guid.NewGuid();

    /// <summary>The placement this occurrence belongs to.</summary>
    public Guid PlaatsingId { get; private set; }

    /// <summary>The teaching day it happens on.</summary>
    public DateOnly Datum { get; private set; }

    /// <summary>When it starts that day.</summary>
    public TimeOnly Begin { get; private set; }

    /// <summary>When it ends that day.</summary>
    public TimeOnly Einde { get; private set; }

    /// <summary>
    /// Moves or resizes this one occurrence. Reached only through <see cref="AlgemeneFicheplaatsing.VerplaatsMoment"/>,
    /// which is the layer that can see whether the new day is still inside the placement.
    /// </summary>
    internal void Verplaats(DateOnly datum, TimeOnly begin, TimeOnly einde)
    {
        (Begin, Einde) = RequireTijden(begin, einde);
        Datum = datum;
    }

    private static (TimeOnly Begin, TimeOnly Einde) RequireTijden(TimeOnly begin, TimeOnly einde) =>
        einde > begin
            ? (begin, einde)
            : throw new ArgumentException("Het einde van de fiche moet na het begin liggen. Kies een later einduur.");
}
