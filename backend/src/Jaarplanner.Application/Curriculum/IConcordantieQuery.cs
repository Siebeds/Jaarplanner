using Jaarplanner.Domain.Curriculum;

namespace Jaarplanner.Application.Curriculum;

/// <summary>
/// Bidirectional read access to the persisted minimumdoel↔leerplandoel concordance — the
/// queryable seam that makes minimumdoel-level coverage possible (Art. V.1–2, feeds E5).
/// <para>
/// The concordance is derived read-only reference data (Art. III): this query never mutates
/// official content. Cardinality follows Op.stap reality — a leerplandoel concords to 0..1
/// minimumdoel (one Excel column D), a minimumdoel to 0..* leerplandoelen — so the two
/// directions return a single optional minimumdoel and a list of leerplandoelen respectively.
/// </para>
/// </summary>
public interface IConcordantieQuery
{
    /// <summary>
    /// The leerplandoelen concorded to the given minimumdoel (forward roll-up direction:
    /// a minimumdoel is gedekt when ≥1 of these is gedekt — Art. V.1).
    /// </summary>
    /// <param name="minimumdoelRef">The minimumdoel concordance key (Excel D).</param>
    /// <returns>The concorded leerplandoelen; empty when none concord to this minimumdoel.</returns>
    Task<IReadOnlyList<Leerplandoel>> LeerplandoelenVoorMinimumdoelAsync(
        string minimumdoelRef,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// The minimumdoel a leerplandoel concords to, if any (reverse direction). Returns
    /// <c>null</c> when the leerplandoel carries no ref or its ref matches no known minimumdoel
    /// (a partial/orphaned ref is never a phantom link — Art. III.5, V.6).
    /// </summary>
    /// <param name="leerplandoelCode">The leerplandoel identity (Excel E).</param>
    /// <returns>The concorded minimumdoel, or <c>null</c> when not concorded.</returns>
    Task<Minimumdoel?> MinimumdoelVoorLeerplandoelAsync(
        string leerplandoelCode,
        CancellationToken cancellationToken = default);
}
