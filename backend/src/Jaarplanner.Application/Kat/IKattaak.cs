using Jaarplanner.Domain.Kat;

namespace Jaarplanner.Application.Kat;

/// <summary>
/// What the cat does about a finding once, when the tick first notices it (TB-057, ADR-0059 K2). This is where the
/// content comes from: a task may call the AI, and what it writes is a proposal with status <c>voorgesteld</c>,
/// decided by the person Art. IV.1 names for it. It never decides anything itself.
/// <para>
/// <b>It runs for a new finding only.</b> A finding the tick already has a <see cref="Signaal"/> for is not passed
/// again, so the AI is called once per thing noticed, not once per tick, and an unchanged state costs nothing
/// (D1, and the school's AI budget once FB-055 exists).
/// </para>
/// <para>
/// <b>There is no implementation yet.</b> The first is the activiteitvoorstel on an aanbod-gat (FB-070); the
/// lesvoorbereidingen of a vervanging (FB-068) follow. TB-057 builds the seam and proves it is called, with a fake;
/// the first test against a faked AI client belongs to the ticket that makes the first real call.
/// </para>
/// </summary>
public interface IKattaak
{
    /// <summary>The soort this task acts on. A finding of another soort never reaches it.</summary>
    Signaalsoort Soort { get; }

    /// <summary>
    /// Acts on a finding the tick has just noticed for the first time. It runs inside the tick, after the signal is
    /// stored, so a task that throws loses its own work and not the round's (the round logs it and goes on).
    /// </summary>
    Task VoerUitAsync(Signaalvondst vondst, CancellationToken ct);
}
