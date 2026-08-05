using Jaarplanner.Application.Dekking;
using Jaarplanner.Application.Planning.Generatie;
using Jaarplanner.Domain.Curriculum;

namespace Jaarplanner.UnitTests.Dekking;

/// <summary>
/// A hand-built <see cref="IJaarplanLezer"/>: it returns whatever plan the test hands it, so a coverage test can
/// state a placement's status and staleness directly instead of arranging a school year, a grid and a generation run
/// to produce them. Art. V.6 asks for the coverage logic to be covered well, and the tests that get written are the
/// ones whose arrangement fits on a screen.
/// </summary>
internal sealed class FakeJaarplanLezer : IJaarplanLezer
{
    private readonly JaarplanWeergave _plan;

    public FakeJaarplanLezer(JaarplanWeergave plan) => _plan = plan;

    public int AantalAanroepen { get; private set; }

    public Task<JaarplanWeergave> HaalJaarplanAsync(Guid klasId, CancellationToken cancellationToken = default)
    {
        AantalAanroepen++;

        return Task.FromResult(_plan);
    }
}

/// <summary>
/// An in-memory <see cref="IDekkingOpslag"/>. It records the arguments it was asked with, because two of this
/// story's rules are only observable in the <b>request</b> rather than in the answer: that a rejected or stale
/// placement's thema is never asked about at all, and that the klas is passed through so the class-scoped layers can
/// be filtered. A fake that only returned data could not prove either.
/// </summary>
internal sealed class FakeDekkingOpslag : IDekkingOpslag
{
    private readonly IReadOnlyList<DekkendeKoppeling> _koppelingen;
    private readonly IReadOnlyList<Leerplandoel> _doelen;

    public FakeDekkingOpslag(
        IReadOnlyList<DekkendeKoppeling> koppelingen,
        IReadOnlyList<Leerplandoel> doelen)
    {
        _koppelingen = koppelingen;
        _doelen = doelen;
    }

    /// <summary>The klas the service scoped the class-level layers to, or null when it never asked.</summary>
    public Guid? GevraagdeKlasId { get; private set; }

    /// <summary>The thema ids the service asked about, or null when it never asked.</summary>
    public IReadOnlyCollection<Guid>? GevraagdeThemaIds { get; private set; }

    public int AantalKoppelingAanroepen { get; private set; }

    /// <summary>
    /// Links per thema, for the tests that need the answer to <b>depend</b> on which thema's were asked about
    /// (E3-03). When set, it is used instead of the flat list.
    /// <para>
    /// <b>Why the flat list is not enough for the vooruitzicht.</b> That computation asks this port twice — once for
    /// the decided placements and once for those plus the standing proposals — and the difference between the two
    /// answers <i>is</i> the figure under test. A fake that returns everything both times makes
    /// <c>AantalGedekt</c> and <c>AantalMogelijkGedekt</c> equal by construction, so a service that ignored the
    /// distinction entirely would pass. The dekking tests below need no such thing, which is why this is opt-in and
    /// the unfiltered default stays exactly as documented above.
    /// </para>
    /// </summary>
    public IReadOnlyDictionary<Guid, IReadOnlyList<DekkendeKoppeling>>? KoppelingenPerThema { get; set; }

    /// <summary>Every thema id set this port was asked about, in order — one entry per call (E3-03).</summary>
    public List<IReadOnlyCollection<Guid>> AlleGevraagdeThemaIds { get; } = [];

    public Task<IReadOnlyList<DekkendeKoppeling>> HaalDekkendeKoppelingenAsync(
        Guid klasId,
        IReadOnlyCollection<Guid> themaIds,
        CancellationToken cancellationToken = default)
    {
        AantalKoppelingAanroepen++;
        GevraagdeKlasId = klasId;
        GevraagdeThemaIds = themaIds;
        AlleGevraagdeThemaIds.Add(themaIds.ToList());

        if (KoppelingenPerThema is not null)
        {
            return Task.FromResult<IReadOnlyList<DekkendeKoppeling>>(
                themaIds
                    .SelectMany(id => KoppelingenPerThema.TryGetValue(id, out var lijst) ? lijst : [])
                    .ToList());
        }

        // Returns everything it was given, UNFILTERED. An earlier revision of this comment claimed the fake filtered
        // by themaIds "so it cannot hand back coverage the service did not request"; it never did, and a documented
        // guard that does not exist is worse than none — the next test to rely on it would pass silently.
        //
        // No filter is needed, and that is a property of the tests rather than an accident: the cases where the
        // service must NOT count a thema (rejected, stale, voorgesteld) are asserted by
        // `AantalKoppelingAanroepen == 0` plus `GevraagdeThemaIds` being null, i.e. by proving the port was never
        // reached at all. That is a stronger assertion than a filtered answer, because a filtered fake could still
        // hide a service that asked about the wrong thema and got an empty list back. `GevraagdeThemaIds` is what
        // pins which ids were asked for.
        return Task.FromResult<IReadOnlyList<DekkendeKoppeling>>(_koppelingen.ToList());
    }

    /// <summary>
    /// The jaar/fase scope the service asked for: the codes for <c>Dekkingsbereik.EigenJaarFase</c>, null for
    /// <c>HeelCurriculum</c>. This is where E5-02's ruling is observable as a <b>request</b>, independently of what
    /// comes back.
    /// </summary>
    public IReadOnlyCollection<string>? GevraagdeJaarFasen { get; private set; }

    public bool HeeftLeerplandoelenGevraagd { get; private set; }

    /// <summary>
    /// The curriculum, filtered to <paramref name="jaarFasen"/> when a scope is given (E5-02).
    /// <para>
    /// <b>This fake filters where <see cref="HaalDekkendeKoppelingenAsync"/> deliberately does not, and the asymmetry
    /// has a reason.</b> There, filtering would weaken the test: the rules under test are proven by the port never
    /// being reached, and a filtered answer could hide a service asking about the wrong thema. Here the rule under
    /// test is arithmetic <i>over</i> the answer — <c>AantalLeerplandoelen</c> and <c>AantalBuitenBereik</c> — which
    /// cannot be observed at all unless a scope actually removes rows. The request is still pinned separately by
    /// <see cref="GevraagdeJaarFasen"/>, so a service that passed the wrong codes and a fake that filtered them
    /// wrongly cannot cancel out. That the <i>real</i> query filters the same way is
    /// <c>DekkingEndpointsTests</c>'s job, against PostgreSQL.
    /// </para>
    /// </summary>
    public Task<IReadOnlyList<Leerplandoel>> HaalLeerplandoelenAsync(
        IReadOnlyCollection<string>? jaarFasen = null,
        CancellationToken cancellationToken = default)
    {
        HeeftLeerplandoelenGevraagd = true;
        GevraagdeJaarFasen = jaarFasen;

        if (jaarFasen is not { Count: > 0 })
        {
            return Task.FromResult(_doelen);
        }

        // Ordinal, matching the port's documented contract: the canonical jaarFase form is ruled and the import
        // normalises to it, so folding case here would let a service pass "l3" and still look correct.
        var fasen = jaarFasen.ToHashSet(StringComparer.Ordinal);

        return Task.FromResult<IReadOnlyList<Leerplandoel>>(
            _doelen.Where(d => fasen.Contains(d.JaarFase)).ToList());
    }

    /// <summary>The unfiltered total, which is what the real <c>COUNT</c> returns.</summary>
    public Task<int> TelAlleLeerplandoelenAsync(CancellationToken cancellationToken = default)
    {
        AantalTelAanroepen++;

        return Task.FromResult(_doelen.Count);
    }

    /// <summary>
    /// How often the total was counted. Asserted so the whole-curriculum path stays free of a query it cannot need:
    /// unscoped, the list already IS the total.
    /// </summary>
    public int AantalTelAanroepen { get; private set; }

    /// <summary>
    /// The class's leerjaar, or null to simulate a class that is gone. Settable because it is the input to the
    /// scope derivation, which is the behaviour E5-02 adds.
    /// </summary>
    public int? Leerjaar { get; set; }

    /// <summary>Whether the service asked for the leerjaar at all: the whole-curriculum path must not.</summary>
    public bool HeeftLeerjaarGevraagd { get; private set; }

    public Task<int?> HaalLeerjaarAsync(Guid klasId, CancellationToken cancellationToken = default)
    {
        HeeftLeerjaarGevraagd = true;

        return Task.FromResult(Leerjaar);
    }
}
