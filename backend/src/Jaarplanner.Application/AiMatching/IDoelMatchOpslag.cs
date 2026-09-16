using Jaarplanner.Domain.Schoolcontent;

namespace Jaarplanner.Application.AiMatching;

/// <summary>
/// The persistence seam for a thema's doelsuggesties (FB-053, Art. VIII layering). The
/// <see cref="DoelMatchingService"/> depends only on this abstraction — not on EF Core — so the
/// end-to-end flow (build prompt → call AI → parse → persist) runs against an in-memory fake with
/// <b>no database and no network</b> in unit tests. The EF Core implementation lives in Infrastructure.
/// <para>
/// It loads the thema aggregate (tracked, with its themadoelen + existing suggestions so the flow can
/// stay idempotent), persists the mutations, and exposes the query path that makes the persisted
/// suggestions retrievable per thema (the "queryable per thema/activiteit" acceptance of FR-4.1/4.2).
/// </para>
/// </summary>
public interface IDoelMatchOpslag
{
    /// <summary>
    /// Loads the thema (with its minimumdoelen, its proposals and its subthema's) for a run or a decision, tracked so
    /// that what changes persists on <see cref="BewaarAsync"/>. Returns <c>null</c> if no such thema.
    /// </summary>
    Task<Thema?> LaadThemaAsync(Guid themaId, CancellationToken cancellationToken = default);

    /// <summary>Persists the pending changes on the loaded aggregate (a single unit of work).</summary>
    Task BewaarAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// The query path (FR-4.1/4.2): the proposals stored for the given thema, open and decided, each with its
    /// minimumdoel's text. Read-only (Art. III.1); empty for an unknown thema.
    /// </summary>
    Task<IReadOnlyList<DoelMatchSuggestieWeergave>> HaalSuggestiesVoorThemaAsync(
        Guid themaId,
        CancellationToken cancellationToken = default);
}
