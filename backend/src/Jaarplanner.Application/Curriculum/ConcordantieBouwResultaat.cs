namespace Jaarplanner.Application.Curriculum;

/// <summary>
/// The outcome of building the minimumdoel↔leerplandoel concordance from a set of
/// leerplandoelen against the known (persisted/decreed) minimumdoel refs.
/// <para>
/// <see cref="Links"/> are the real concordances — every link points at a minimumdoel that
/// actually exists. <see cref="VerweesdeRefs"/> ("orphaned refs") are leerplandoel refs that
/// match no known minimumdoel: these must <b>not</b> become a phantom link (Art. III.5 —
/// codes/refs are the stable identity; Art. V.6 — coverage logic must be sound). They are
/// surfaced for diagnosis (e.g. a partial B-only/C-only key from a hidden/blank Excel cell,
/// or a discipline whose minimumdoelen are not yet imported) rather than silently dropped.
/// </para>
/// </summary>
public sealed class ConcordantieBouwResultaat
{
    /// <summary>Constructs a concordance-build result.</summary>
    /// <param name="links">The real, resolvable concordance links.</param>
    /// <param name="verweesdeRefs">Leerplandoel refs that match no known minimumdoel (no link made).</param>
    public ConcordantieBouwResultaat(
        IReadOnlyList<Concordantie> links,
        IReadOnlyList<VerweesdeMinimumdoelRef> verweesdeRefs)
    {
        Links = links;
        VerweesdeRefs = verweesdeRefs;
    }

    /// <summary>The concordances that resolve to an existing minimumdoel.</summary>
    public IReadOnlyList<Concordantie> Links { get; }

    /// <summary>
    /// Leerplandoel refs that matched no known minimumdoel; deliberately <b>not</b> turned into
    /// a concordance link (no phantom coverage). Surfaced for review.
    /// </summary>
    public IReadOnlyList<VerweesdeMinimumdoelRef> VerweesdeRefs { get; }

    /// <summary>True when every referenced minimumdoel ref resolved (no orphans).</summary>
    public bool IsVolledig => VerweesdeRefs.Count == 0;
}

/// <summary>
/// A leerplandoel that names a <see cref="MinimumdoelRef"/> which does not match any known
/// minimumdoel — the reason no concordance link was created for it.
/// </summary>
/// <param name="LeerplandoelCode">The leerplandoel that carried the unresolved ref.</param>
/// <param name="MinimumdoelRef">The unresolved minimumdoel ref (e.g. partial B-only/C-only key).</param>
public readonly record struct VerweesdeMinimumdoelRef(string LeerplandoelCode, string MinimumdoelRef);
