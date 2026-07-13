using Jaarplanner.Application.AiMatching;
using Jaarplanner.Domain.Schoolcontent;

namespace Jaarplanner.UnitTests.Ai;

/// <summary>
/// In-memory <see cref="IDoelMatchOpslag"/> for tests (E2-04): it holds one thema and records whether
/// the flow committed, with <b>no database</b> whatsoever — proving the end-to-end matching flow runs
/// against fakes with no network and no DB (Art. IV.6). The query path reads straight back from the
/// same in-memory thema, so a test can assert the persisted suggestions are queryable per thema.
/// </summary>
public sealed class FakeDoelMatchOpslag : IDoelMatchOpslag
{
    private readonly Thema? _thema;

    /// <summary>How many times <see cref="BewaarAsync"/> was called (0 ⇒ nothing persisted).</summary>
    public int AantalKeerBewaard { get; private set; }

    public FakeDoelMatchOpslag(Thema? thema) => _thema = thema;

    public Task<Thema?> LaadThemaAsync(Guid themaId, CancellationToken cancellationToken = default) =>
        Task.FromResult(_thema);

    public Task BewaarAsync(CancellationToken cancellationToken = default)
    {
        AantalKeerBewaard++;
        return Task.CompletedTask;
    }

    public Task<IReadOnlyList<DoelMatchSuggestieWeergave>> HaalSuggestiesVoorThemaAsync(
        Guid themaId,
        CancellationToken cancellationToken = default)
    {
        IReadOnlyList<DoelMatchSuggestieWeergave> lijst = _thema is null
            ? []
            : _thema.Doelsuggesties
                .Select(k => new DoelMatchSuggestieWeergave(k.Id, k.LeerplandoelCode, k.Status.ToString(), k.AiMotivatie))
                .ToList();
        return Task.FromResult(lijst);
    }
}
