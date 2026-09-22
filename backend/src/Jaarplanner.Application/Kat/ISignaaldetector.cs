namespace Jaarplanner.Application.Kat;

/// <summary>
/// Notices one kind of thing about a klas, without AI (ADR-0059 K1, D2). Every detector registered is run for every
/// klas of a tick, and again when the deurmat shows what it found, so it must be pure with respect to the data: it
/// reads, it never writes, and the same state yields the same findings with the same sleutels.
/// <para>
/// <b>No AI client belongs here.</b> A finding that needs content asks for it through <see cref="IKattaak"/>, which
/// runs after the tick has decided the finding is new.
/// </para>
/// </summary>
public interface ISignaaldetector
{
    /// <summary>What this detector notices about <paramref name="context"/>'s klas right now; empty when nothing.</summary>
    Task<IReadOnlyList<Signaalvondst>> DetecteerAsync(Katcontext context, CancellationToken ct);
}
