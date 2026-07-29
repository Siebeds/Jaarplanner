using Jaarplanner.Domain.Curriculum;

namespace Jaarplanner.Application.AiAuthoring;

/// <summary>
/// The read-only query seam over the loaded Op.stap <see cref="Leerplandoel"/> reference data
/// (Art. III.1, Art. VIII layering) used by the goal-first authoring assist (E2-07, Art. IV.8).
/// The <see cref="ThemaOpbouwAssistService"/> depends only on this abstraction — never on EF Core —
/// so the whole assist flow runs against an in-memory fake with <b>no database and no network</b>
/// in tests (Art. IV.6).
/// <para>
/// It grounds and bounds the assist: it supplies the candidate leerplandoelen that (a) become the
/// prompt's "Beschikbare Op.stap-leerplandoelen" list — the only goals the model may propose
/// (Art. IV.4) — and (b) the resolvable set the service checks suggestions against so a fabricated
/// code is skipped, never invented (Art. III.5). The EF Core implementation lives in Infrastructure.
/// </para>
/// </summary>
public interface ILeerdoelCatalogus
{
    /// <summary>
    /// Loads the read-only Op.stap leerplandoelen that match <paramref name="selectie"/>. Never
    /// mutates curriculum data (Art. III.1). An empty selection dimension means "no filter on that
    /// dimension"; <see cref="LeerdoelSelectie.Alles"/> loads the full set. Matching is
    /// <b>case-insensitive</b> on every dimension — the values are typed by a teacher, so <c>k3</c> must
    /// find <c>K3</c> rather than silently returning nothing.
    /// </summary>
    Task<IReadOnlyList<Leerplandoel>> HaalLeerdoelenAsync(
        LeerdoelSelectie selectie,
        CancellationToken cancellationToken = default);
}
