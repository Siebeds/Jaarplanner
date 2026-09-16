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
/// An in-memory <see cref="IDekkingOpslag"/>. It records the arguments it was asked with, because some rules are only
/// observable in the <b>request</b> rather than in the answer: that the klas is passed through so the class-scoped
/// layers can be filtered, and which jaar/fasen and mijlpalen the scope asked for.
/// </summary>
internal sealed class FakeDekkingOpslag : IDekkingOpslag
{
    private readonly IReadOnlyList<Leerplandoel> _doelen;

    public FakeDekkingOpslag(IReadOnlyList<Leerplandoel> doelen)
    {
        _doelen = doelen;
    }

    /// <summary>The klas the service scoped the class-level layers to, or null when it never asked.</summary>
    public Guid? GevraagdeKlasId { get; private set; }

    /// <summary>The decided subdoel and activiteit links at the klas's leeftijd, with their placement (ADR-0047).</summary>
    public IReadOnlyList<Subthemakoppeling> Subthemakoppelingen { get; set; } = [];

    public Task<IReadOnlyList<Subthemakoppeling>> HaalSubthemakoppelingenAsync(
        Guid klasId,
        CancellationToken cancellationToken = default)
    {
        GevraagdeKlasId = klasId;
        return Task.FromResult(Subthemakoppelingen);
    }

    /// <summary>The minimumdoelen in store; filtered by mijlpaal like the real read.</summary>
    public IReadOnlyList<Minimumdoel> Minimumdoelen { get; set; } = [];

    public IReadOnlyCollection<string>? GevraagdeMijlpalen { get; private set; }

    public Task<IReadOnlyList<Minimumdoel>> HaalMinimumdoelenAsync(
        IReadOnlyCollection<string>? mijlpalen = null,
        CancellationToken cancellationToken = default)
    {
        GevraagdeMijlpalen = mijlpalen;
        return Task.FromResult<IReadOnlyList<Minimumdoel>>(mijlpalen is null
            ? Minimumdoelen
            : Minimumdoelen.Where(m => mijlpalen.Contains(m.Leeftijd, StringComparer.Ordinal)).ToList());
    }

    public IReadOnlyList<Themaminimumdoelkoppeling> ThemaMinimumdoelen { get; set; } = [];

    public Task<IReadOnlyList<Themaminimumdoelkoppeling>> HaalThemaMinimumdoelenAsync(
        CancellationToken cancellationToken = default) =>
        Task.FromResult(ThemaMinimumdoelen);

    public IReadOnlyList<KandidaatKoppeling> Kandidaten { get; set; } = [];

    /// <summary>The klas the service scoped the candidate read to, or null when it never asked.</summary>
    public Guid? GevraagdeKandidaatKlasId { get; private set; }

    /// <summary>
    /// Unfiltered: the whole point of this read is that it is <b>not</b> narrowed to what is placed, so a fake that
    /// narrowed it would make the <c>NietIngepland</c> cause unreachable and its tests vacuous.
    /// </summary>
    public Task<IReadOnlyList<KandidaatKoppeling>> HaalKandidaatKoppelingenAsync(
        Guid klasId,
        CancellationToken cancellationToken = default)
    {
        GevraagdeKandidaatKlasId = klasId;

        return Task.FromResult(Kandidaten);
    }

    /// <summary>
    /// The fifth layer's answer: the planned fiches' goals (owner ruling, 2026-09-11). Empty by default, which is the
    /// state every test written before fiches existed runs in, so none of them changes meaning.
    /// </summary>
    public IReadOnlyList<DekkendeFichekoppeling> Fichekoppelingen { get; set; } = [];

    /// <summary>The klas the service asked the fiche layer about, or null when it never asked.</summary>
    public Guid? GevraagdeFicheKlasId { get; private set; }

    public Task<IReadOnlyList<DekkendeFichekoppeling>> HaalFichekoppelingenAsync(
        Guid klasId,
        CancellationToken cancellationToken = default)
    {
        GevraagdeFicheKlasId = klasId;

        return Task.FromResult(Fichekoppelingen);
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
    /// It filters because the rule under test is arithmetic <i>over</i> the answer (<c>AantalLeerplandoelen</c> and
    /// <c>AantalBuitenBereik</c>), which cannot be observed unless a scope removes rows. The request is still pinned
    /// separately by <see cref="GevraagdeJaarFasen"/>. That the <i>real</i> query filters the same way is
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
    /// The discipline names by number (TB-022). Empty by default, which leaves every goal's name null: the state every
    /// test written before the overview grouped by discipline runs in.
    /// </summary>
    public IReadOnlyDictionary<string, string> Disciplinenamen { get; set; } = new Dictionary<string, string>();

    public Task<IReadOnlyDictionary<string, string>> HaalDisciplinenamenAsync(CancellationToken cancellationToken = default) =>
        Task.FromResult(Disciplinenamen);

    /// <summary>
    /// The class's leerjaar, or null to simulate a class that is gone. Settable because it is the input to the
    /// scope derivation, which is the behaviour E5-02 adds.
    /// </summary>
    public int? Leerjaar { get; set; }

    /// <summary>Whether the service asked for the leerjaar at all: the whole-curriculum path must not.</summary>
    public bool HeeftLeerjaarGevraagd { get; private set; }

    /// <summary>
    /// The class's own recorded jaar/fase, when a test is exercising the narrowing rather than the ordinal fallback
    /// (owner ruling, 2026-08-25). Null keeps the pre-existing behaviour, which is what every older test expects.
    /// </summary>
    public string? Jaarfase { get; set; }

    public Task<Klasscope?> HaalKlasscopeAsync(Guid klasId, CancellationToken cancellationToken = default)
    {
        HeeftLeerjaarGevraagd = true;

        return Task.FromResult(Leerjaar is null ? null : (Klasscope?)new Klasscope(Leerjaar.Value, Jaarfase));
    }
}
