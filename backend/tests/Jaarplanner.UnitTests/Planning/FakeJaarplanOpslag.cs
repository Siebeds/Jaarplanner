using Jaarplanner.Application.Planning.Generatie;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;

namespace Jaarplanner.UnitTests.Planning;

/// <summary>
/// In-memory <see cref="IJaarplanOpslag"/> for tests (Art. IV.6, Art. VIII). It proves the generation flow runs
/// with <b>no database</b>: nothing here touches EF Core. It also counts commits so a test can assert that a failed
/// run persisted nothing at all.
/// </summary>
internal sealed class FakeJaarplanOpslag : IJaarplanOpslag
{
    private readonly Klas? _klas;
    private readonly Schooljaar? _schooljaar;
    private readonly List<Thema> _themas;
    private Jaarplan? _jaarplan;
    private Generatieparameters? _parameters;

    public FakeJaarplanOpslag(Klas? klas, Schooljaar? schooljaar, IEnumerable<Thema>? themas = null, Jaarplan? jaarplan = null)
    {
        _klas = klas;
        _schooljaar = schooljaar;
        _themas = themas?.ToList() ?? [];
        _jaarplan = jaarplan;
    }

    /// <summary>How many times the flow committed a unit of work.</summary>
    public int AantalKeerBewaard { get; private set; }

    /// <summary>The plan as it stands in the store — what a reload would return.</summary>
    public Jaarplan? Jaarplan => _jaarplan;

    /// <summary>The kept pre-generation settings as they stand in the store (E3-04), or null when none were saved.</summary>
    public Generatieparameters? Generatieparameters => _parameters;

    public Task<(Klas Klas, Schooljaar Schooljaar)?> LaadKlasMetSchooljaarAsync(
        Guid klasId,
        CancellationToken cancellationToken = default) =>
        Task.FromResult(_klas is null || _schooljaar is null || _klas.Id != klasId
            ? null
            : ((Klas, Schooljaar)?)(_klas, _schooljaar));

    public Task<Jaarplan?> LaadJaarplanAsync(Guid klasId, CancellationToken cancellationToken = default) =>
        Task.FromResult(_jaarplan?.KlasId == klasId ? _jaarplan : null);

    public void VoegJaarplanToe(Jaarplan jaarplan) => _jaarplan = jaarplan;

    // Keyed on BOTH ids, exactly like the EF implementation: a fake that ignored the school year would hide the very
    // leak the pair key exists to prevent (a date from another year loaded into this one's form).
    public Task<Generatieparameters?> LaadGeneratieparametersAsync(
        Guid klasId,
        Guid schooljaarId,
        CancellationToken cancellationToken = default) =>
        Task.FromResult(_parameters?.KlasId == klasId && _parameters.SchooljaarId == schooljaarId
            ? _parameters
            : null);

    /// <summary>
    /// Set by a test to simulate a concurrent generation run that inserted the settings row <b>first</b>: the next
    /// insert attempt is refused (as the unique index refuses it) and this row is what the losing run then loads.
    /// </summary>
    public Generatieparameters? GelijktijdigeWinnaar { get; set; }

    public Task<bool> ProbeerGeneratieparametersToeTeVoegenAsync(
        Generatieparameters parameters,
        CancellationToken cancellationToken = default)
    {
        AantalKeerBewaard++;

        if (GelijktijdigeWinnaar is not null)
        {
            _parameters = GelijktijdigeWinnaar;
            GelijktijdigeWinnaar = null;

            return Task.FromResult(false);
        }

        _parameters = parameters;

        return Task.FromResult(true);
    }

    public Task<IReadOnlyList<Thema>> LaadThemasAsync(CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<Thema>>(_themas);

    public Task BewaarAsync(CancellationToken cancellationToken = default)
    {
        AantalKeerBewaard++;

        return Task.CompletedTask;
    }
}
