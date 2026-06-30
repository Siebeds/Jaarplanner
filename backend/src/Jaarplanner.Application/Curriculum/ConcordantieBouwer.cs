using Jaarplanner.Domain.Curriculum;

namespace Jaarplanner.Application.Curriculum;

/// <summary>
/// Builds the minimumdoel↔leerplandoel concordance from imported leerplandoelen against the
/// set of known (decreed/persisted) minimumdoel refs. Pure and DB-free, so the coverage-critical
/// concordance logic (Art. V.6) is unit-testable in isolation from EF Core.
/// <para>
/// The concordance key is the leerplandoel's <see cref="Leerplandoel.MinimumdoelRef"/> (Excel D
/// = B+C, Art. VII.1) matched against <see cref="Minimumdoel.Ref"/>. A leerplandoel with no ref
/// is simply not concorded. A leerplandoel whose ref matches no known minimumdoel — typically a
/// partial B-only/C-only key emitted by the parser when a cell was blank/hidden — yields a
/// <see cref="VerweesdeMinimumdoelRef"/>, <b>never</b> a phantom link (Art. III.5, Art. V.6).
/// </para>
/// </summary>
public static class ConcordantieBouwer
{
    /// <summary>
    /// Builds the concordance for the given leerplandoelen against the known minimumdoel refs.
    /// </summary>
    /// <param name="leerplandoelen">The leerplandoelen carrying optional minimumdoel refs.</param>
    /// <param name="bekendeMinimumdoelRefs">The refs of minimumdoelen known to exist.</param>
    /// <returns>The resolvable links plus any orphaned (unresolved) refs.</returns>
    public static ConcordantieBouwResultaat Bouw(
        IEnumerable<Leerplandoel> leerplandoelen,
        IEnumerable<string> bekendeMinimumdoelRefs)
    {
        ArgumentNullException.ThrowIfNull(leerplandoelen);
        ArgumentNullException.ThrowIfNull(bekendeMinimumdoelRefs);

        var bekend = new HashSet<string>(bekendeMinimumdoelRefs, StringComparer.Ordinal);

        var links = new List<Concordantie>();
        var verweesd = new List<VerweesdeMinimumdoelRef>();

        foreach (var doel in leerplandoelen)
        {
            var minimumdoelRef = doel.MinimumdoelRef;
            if (minimumdoelRef is null)
            {
                // No concordance on this leerplandoel — nothing to link.
                continue;
            }

            if (bekend.Contains(minimumdoelRef))
            {
                links.Add(new Concordantie(doel.Code, minimumdoelRef));
            }
            else
            {
                // The ref names no known minimumdoel (e.g. a partial key) — surface, do not link.
                verweesd.Add(new VerweesdeMinimumdoelRef(doel.Code, minimumdoelRef));
            }
        }

        return new ConcordantieBouwResultaat(links, verweesd);
    }
}
