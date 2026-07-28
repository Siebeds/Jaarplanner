using Jaarplanner.Domain.Schoolcontent;

namespace Jaarplanner.Application.AiMatching;

/// <summary>
/// The persistence seam for the goal-matching flow (E2-04, Art. VIII layering). The
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
    /// Loads the thema (with its themadoelen and existing AI suggestions) for a match run, tracked so
    /// that added suggestions persist on <see cref="BewaarAsync"/>. Returns <c>null</c> if no such thema.
    /// </summary>
    Task<Thema?> LaadThemaAsync(Guid themaId, CancellationToken cancellationToken = default);

    /// <summary>Persists the pending changes on the loaded aggregate (a single unit of work).</summary>
    Task BewaarAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// The query path (FR-4.1/4.2): the AI match suggestions persisted for the given thema, as
    /// read views. Read-only; does not mutate curriculum data (Art. III.1).
    /// </summary>
    Task<IReadOnlyList<DoelMatchSuggestieWeergave>> HaalSuggestiesVoorThemaAsync(
        Guid themaId,
        CancellationToken cancellationToken = default);
}
