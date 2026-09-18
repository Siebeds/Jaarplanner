using Jaarplanner.Domain.Curriculum;

namespace Jaarplanner.Application.Curriculum.Import;

/// <summary>
/// Where the decreed minimumdoelen come from (E1-12, ADR-0032). A port, so the import logic runs in tests without a
/// network and the source can change without touching it. The one implementation reads KOV's Op.stap API.
/// </summary>
public interface IMinimumdoelBron
{
    /// <summary>
    /// Reads every decreed minimumdoel the source publishes today, mapped to <see cref="Minimumdoel"/>, together with the
    /// rows that could not be mapped.
    /// </summary>
    /// <exception cref="OpstapBronFout">
    /// The read was refused as a whole: the source could not be reached or read, or its answer cannot be trusted as a
    /// whole (a partial list, a row that cannot be identified). Nothing has been written.
    /// </exception>
    Task<MinimumdoelBronResultaat> HaalOpAsync(CancellationToken cancellationToken = default);
}

/// <summary>What one read of the minimumdoelen source produced.</summary>
public sealed class MinimumdoelBronResultaat
{
    /// <summary>Constructs a source result.</summary>
    /// <param name="minimumdoelen">The rows that mapped cleanly, at most one per <see cref="Minimumdoel.Ref"/>.</param>
    /// <param name="problemen">The rows that were not imported, and why.</param>
    public MinimumdoelBronResultaat(
        IReadOnlyList<Minimumdoel> minimumdoelen,
        IReadOnlyList<MinimumdoelBronProbleem> problemen)
    {
        Minimumdoelen = minimumdoelen;
        Problemen = problemen;
    }

    /// <summary>The rows that mapped cleanly, at most one per <see cref="Minimumdoel.Ref"/>.</summary>
    public IReadOnlyList<Minimumdoel> Minimumdoelen { get; }

    /// <summary>The rows that were not imported, and why.</summary>
    public IReadOnlyList<MinimumdoelBronProbleem> Problemen { get; }
}

/// <summary>
/// A source row that was not imported. Its <see cref="Reden"/> is <b>English</b>: a malformed or expired row in KOV's
/// data is nothing a teacher or admin can fix, so it is an operator diagnostic (Art. II.3 as amended 2026-07-30),
/// the same choice <c>OpstapRijProbleem</c> made for the Excel path.
/// </summary>
/// <param name="Sleutel">
/// The row's <c>uniqueCode</c>, always a well-formed ref: a row that cannot be identified makes the whole read fail with
/// <see cref="OpstapBronFout"/>, so the import can tell a minimumdoel that was not read from one that vanished.
/// </param>
/// <param name="Reden">Why the row was left out.</param>
public readonly record struct MinimumdoelBronProbleem(string Sleutel, string Reden);
