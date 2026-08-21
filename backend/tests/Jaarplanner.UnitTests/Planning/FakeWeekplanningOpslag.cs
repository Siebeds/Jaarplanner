using Jaarplanner.Application.Planning.Weekplanning;
using Jaarplanner.Domain.Planning;

namespace Jaarplanner.UnitTests.Planning;

/// <summary>
/// In-memory <see cref="IWeekplanningOpslag"/> for tests (Art. IV.6, Art. VIII). It proves the day-planning flow runs
/// with <b>no database</b>: nothing here touches EF Core. It also counts commits so a test can assert that a refused
/// request persisted nothing.
/// <para>
/// <b>What this fake deliberately cannot catch, stated here so no test claims otherwise.</b> The real store has to
/// <c>Include</c> the activiteit placements, because they are a regular navigation rather than an owned collection —
/// forget it and every day renders empty. This fake holds the aggregate in memory, so its collection is always
/// populated and it would pass either way. That gap is covered by a Postgres integration test, not here.
/// </para>
/// </summary>
internal sealed class FakeWeekplanningOpslag : IWeekplanningOpslag
{
    private readonly Klas? _klas;
    private readonly Schooljaar? _schooljaar;
    private readonly List<Activiteitinhoud> _inhoud;
    private Jaarplan? _jaarplan;

    public FakeWeekplanningOpslag(
        Klas? klas,
        Schooljaar? schooljaar,
        IEnumerable<Activiteitinhoud>? inhoud = null,
        Jaarplan? jaarplan = null)
    {
        _klas = klas;
        _schooljaar = schooljaar;
        _inhoud = inhoud?.ToList() ?? [];
        _jaarplan = jaarplan;
    }

    /// <summary>How many times the flow committed a unit of work. 0 after a refusal is the assertion that matters.</summary>
    public int AantalKeerBewaard { get; private set; }

    /// <summary>The plan as it stands in the store — what a reload would return.</summary>
    public Jaarplan? Jaarplan => _jaarplan;

    public Task<(Klas Klas, Schooljaar Schooljaar)?> LaadKlasMetSchooljaarAsync(
        Guid klasId,
        CancellationToken cancellationToken = default) =>
        Task.FromResult(_klas is null || _schooljaar is null || _klas.Id != klasId
            ? null
            : ((Klas, Schooljaar)?)(_klas, _schooljaar));

    public Task<Jaarplan?> LaadJaarplanAsync(Guid klasId, CancellationToken cancellationToken = default) =>
        Task.FromResult(_jaarplan?.KlasId == klasId ? _jaarplan : null);

    public void VoegJaarplanToe(Jaarplan jaarplan) => _jaarplan = jaarplan;

    public Task<Activiteitinhoud?> LaadActiviteitinhoudAsync(
        Guid activiteitId,
        CancellationToken cancellationToken = default) =>
        Task.FromResult(_inhoud.FirstOrDefault(i => i.ActiviteitId == activiteitId));

    public Task<IReadOnlyList<Activiteitinhoud>> LaadActiviteitinhoudAsync(
        IReadOnlyCollection<Guid> activiteitIds,
        CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<Activiteitinhoud>>(
            _inhoud.Where(i => activiteitIds.Contains(i.ActiviteitId)).ToList());

    public Task BewaarAsync(CancellationToken cancellationToken = default)
    {
        AantalKeerBewaard++;

        return Task.CompletedTask;
    }
}
