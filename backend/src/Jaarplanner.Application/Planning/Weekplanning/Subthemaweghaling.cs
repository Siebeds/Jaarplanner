namespace Jaarplanner.Application.Planning.Weekplanning;

/// <summary>
/// What taking a subthema out of the agenda over a stretch of days would take with it (FB-096): the counts the
/// confirmation names before anything is gone.
/// <para>
/// <b>Computed by the same selection the delete uses</b> (<c>WeekplanningService.SelecteerSubthema</c>), so the numbers
/// a teacher confirms are the rows that go.
/// </para>
/// </summary>
/// <param name="AantalActiviteiten">
/// The activiteitplaatsingen of this subthema on those days, open proposals of a weekvoorstel included: they leave the
/// agenda too.
/// </param>
/// <param name="AantalHoekverrijkingen">
/// The hoekverrijkingen written against the windows that go (FB-020). They cascade with their window, and the owner's
/// rule for that is "mee weg, met aantal" (2026-09-15).
/// </param>
/// <param name="HeeftPeriode">
/// Whether a stored window goes. Only a window makes a subthema's goals count for the klas's dekking (ADR-0047), so a
/// run drawn from its activiteiten alone changes nothing there and the confirmation must not say it does.
/// </param>
/// <param name="BlijftElders">
/// Whether another window of the same subthema stays in this klas's plan, which keeps its goals counting.
/// </param>
public sealed record Subthemaweghaling(
    int AantalActiviteiten,
    int AantalHoekverrijkingen,
    bool HeeftPeriode,
    bool BlijftElders);
