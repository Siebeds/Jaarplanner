namespace Jaarplanner.Domain.Schoolcontent;

/// <summary>
/// A school's own kennisrijk thema (Art. IX.2) — <b>school-scoped: shared school-wide</b> and
/// owned by the team/directie via the shared thema-bibliotheek. It carries the school-wide
/// attributes: <see cref="Invalshoeken"/>, a <see cref="DuurWeken"/> (≈ 4–6 wk, the themaperiode)
/// and the two-tier vocabulary — <see cref="Kernwoordenschat"/> (basiswoorden) and
/// <see cref="RijkeWoordenschat"/> (rijke themawoorden) — both of which are deliberately the same
/// across the school.
/// <para>
/// A thema aims at school-wide <see cref="Minimumdoelen"/>, its themadoelen (FB-043), and gathers the per-age
/// <see cref="Subthemas"/>. This entity is <b>mutable</b>: thema's are autonomous school content
/// (Art. III, professionele autonomie) — unlike the read-only Op.stap curriculum data.
/// </para>
/// </summary>
public sealed class Thema
{
    private readonly List<Themadoel> _themadoelen = [];
    private readonly List<ThemaMinimumdoel> _minimumdoelen = [];
    private readonly List<Subthema> _subthemas = [];
    private readonly List<DoelKoppeling> _doelsuggesties = [];
    private readonly List<string> _kernwoordenschat = [];
    private readonly List<string> _rijkeWoordenschat = [];

    // EF Core materialisation only.
    private Thema()
    {
        Naam = null!;
    }

    /// <summary>Creates a thema.</summary>
    /// <param name="naam">The thema name. Required.</param>
    /// <param name="duurWeken">The themaperiode duration in weeks (≈ 4–6). Must be positive.</param>
    /// <param name="invalshoeken">Optional angles of approach.</param>
    public Thema(string naam, int duurWeken, string? invalshoeken = null)
    {
        Naam = Require(naam, nameof(naam));
        DuurWeken = RequirePositive(duurWeken, nameof(duurWeken));
        Invalshoeken = Optional(invalshoeken);
    }

    /// <summary>Surrogate identity.</summary>
    public Guid Id { get; private set; } = Guid.NewGuid();

    /// <summary>The thema name.</summary>
    public string Naam { get; private set; }

    /// <summary>Optional angles of approach for the thema.</summary>
    public string? Invalshoeken { get; private set; }

    /// <summary>The themaperiode duration in weeks (≈ 4–6).</summary>
    public int DuurWeken { get; private set; }

    /// <summary>
    /// An optional emoji shown beside the naam (FB-060), never instead of it. <c>null</c> when the thema has none; see
    /// <see cref="ThemaIcoon"/> for what counts as one emoji.
    /// </summary>
    public string? Icoon { get; private set; }

    /// <summary>Kernwoordenschat (basiswoorden) — school-wide; two-tier with <see cref="RijkeWoordenschat"/>.</summary>
    public IReadOnlyList<string> Kernwoordenschat => _kernwoordenschat;

    /// <summary>Rijke (thema)woordenschat — school-wide; two-tier with <see cref="Kernwoordenschat"/>.</summary>
    public IReadOnlyList<string> RijkeWoordenschat => _rijkeWoordenschat;

    /// <summary>
    /// The themadoelen that link a leerplandoel (Art. IX.2). No screen adds one any more: a themadoel is a
    /// <see cref="Minimumdoelen">minimumdoel</see> now (FB-043). The FR-1 import still writes them, until its own ticket.
    /// </summary>
    public IReadOnlyList<Themadoel> Themadoelen => _themadoelen;

    /// <summary>
    /// The minimumdoelen this thema aims at, which are its themadoelen as a teacher sees them (FB-043, Art. IX.2). No
    /// upper bound. Each brings along the leerplandoelen that concord to it, at every leeftijd.
    /// </summary>
    public IReadOnlyList<ThemaMinimumdoel> Minimumdoelen => _minimumdoelen;

    /// <summary>The per-class/age subthema's that belong to this thema (Art. IX.2).</summary>
    public IReadOnlyList<Subthema> Subthemas => _subthemas;

    /// <summary>
    /// The AI goal-match suggestions for this thema (E2-04, FR-4). Each is a thema-level
    /// <see cref="DoelKoppeling"/> the AI proposed with status <see cref="KoppelingStatus.Voorgesteld"/>
    /// and an <see cref="DoelKoppeling.AiMotivatie"/> — advisory only, never auto-applied (Art. IV.1/IV.2).
    /// <para>
    /// This is deliberately <b>separate</b> from the curated 2–3 <see cref="Themadoelen"/>: a match run
    /// may propose any number of candidates, so it must not be bound by (or pollute) the themadoel cap.
    /// The teacher reviews these in E2-05; an accepted candidate is promoted to a <see cref="Themadoel"/>
    /// (or another link) at curation time, where the 2–3 bound applies. This keeps AI candidates and the
    /// school-authored anchors cleanly distinct while both remaining a <see cref="DoelKoppeling"/> — the
    /// single link entity of Art. IX.2 ("any link School-content↔Leerplandoel").
    /// </para>
    /// </summary>
    public IReadOnlyList<DoelKoppeling> Doelsuggesties => _doelsuggesties;

    /// <summary>
    /// Updates the thema's basic attributes (mutable autonomous content, Art. III). Used by the
    /// school-content import overwrite path (E1-08) and by CRUD; the naam (the match key) is not
    /// changed here.
    /// </summary>
    public void WerkBasisGegevensBij(int duurWeken, string? invalshoeken)
    {
        DuurWeken = RequirePositive(duurWeken, nameof(duurWeken));
        Invalshoeken = Optional(invalshoeken);
    }

    /// <summary>
    /// Renames the thema (CRUD, E1-10). Naam is the import match key, so the import path leaves it
    /// alone, but an explicit teacher rename through the beheerpagina is allowed (autonomous content,
    /// Art. III). School-wide scope is unaffected.
    /// </summary>
    public void WijzigNaam(string naam) => Naam = Require(naam, nameof(naam));

    /// <summary>Sets or clears the thema's emoji (FB-060). Empty clears it.</summary>
    /// <exception cref="ArgumentException">The value is not exactly one emoji.</exception>
    public void WijzigIcoon(string? icoon) => Icoon = ThemaIcoon.Normaliseer(icoon);

    /// <summary>
    /// Removes a subthema (and, via the EF cascade, its subdoelen + activiteiten) from this thema.
    /// CRUD delete of a class/age-scoped subthema (E1-10) — deleting a subthema never touches the
    /// school-wide thema attributes (level scoping, Art. IX.2).
    /// </summary>
    public void VerwijderSubthema(Subthema subthema)
    {
        ArgumentNullException.ThrowIfNull(subthema);
        _subthemas.Remove(subthema);
    }

    /// <summary>
    /// Whether the thema already aims at the pedagogically expected minimum of <see cref="MinThemadoelen"/>
    /// minimumdoelen (Art. IX.2). <b>Advisory</b>: a thema under construction may have fewer, so callers surface
    /// "nog niet compleet" rather than block (E1-10). It counts the <see cref="Minimumdoelen"/>, the themadoelen a
    /// teacher sees (FB-043).
    /// </summary>
    public bool HeeftVoldoendeThemadoelen => _minimumdoelen.Count >= MinThemadoelen;

    /// <summary>
    /// Links a minimumdoel to this thema as a themadoel (FB-043). There is no upper bound. Linking the same minimumdoel
    /// twice is refused, since the second link would say nothing the first does not.
    /// <para>
    /// That the ref names a minimumdoel the school has loaded is the application layer's check (Art. III.5): the
    /// domain cannot see the curriculum table.
    /// </para>
    /// </summary>
    /// <exception cref="InvalidOperationException">The minimumdoel is already linked to this thema.</exception>
    public ThemaMinimumdoel KoppelMinimumdoel(string minimumdoelRef)
    {
        var koppeling = new ThemaMinimumdoel(Id, minimumdoelRef);
        if (_minimumdoelen.Any(m => string.Equals(m.MinimumdoelRef, koppeling.MinimumdoelRef, StringComparison.Ordinal)))
        {
            throw new InvalidOperationException(
                $"Minimumdoel {koppeling.MinimumdoelRef} is al een themadoel van dit thema.");
        }

        _minimumdoelen.Add(koppeling);
        return koppeling;
    }

    /// <summary>
    /// Unlinks a minimumdoel from this thema. The leerplandoelen it brought along go with it: they were only ever read
    /// through the link.
    /// </summary>
    public void OntkoppelMinimumdoel(ThemaMinimumdoel koppeling)
    {
        ArgumentNullException.ThrowIfNull(koppeling);
        _minimumdoelen.Remove(koppeling);
    }

    /// <summary>
    /// Removes a themadoel from this thema. Used by the import overwrite reconciliation (E1-08) to drop
    /// an AI-only <c>voorgesteld</c> link the file no longer carries, or — only on explicit teacher
    /// confirmation — a discarded human decision (Art. IV.2).
    /// </summary>
    public void VerwijderThemadoel(Themadoel themadoel)
    {
        ArgumentNullException.ThrowIfNull(themadoel);
        _themadoelen.Remove(themadoel);
    }

    /// <summary>Replaces the school-wide kernwoordenschat list.</summary>
    public void StelKernwoordenschatIn(IEnumerable<string> woorden) =>
        Replace(_kernwoordenschat, woorden);

    /// <summary>Replaces the school-wide rijke woordenschat list.</summary>
    public void StelRijkeWoordenschatIn(IEnumerable<string> woorden) =>
        Replace(_rijkeWoordenschat, woorden);

    /// <summary>
    /// Adds a themadoel that links a leerplandoel. Only the FR-1 import and the demo seed still call this (FB-043), and
    /// the import keeps this bound of <see cref="MaxThemadoelen"/> until its own ticket.
    /// </summary>
    public Themadoel VoegThemadoelToe(DoelKoppeling koppeling)
    {
        ArgumentNullException.ThrowIfNull(koppeling);
        if (_themadoelen.Count >= MaxThemadoelen)
        {
            throw new InvalidOperationException(
                $"Een thema heeft ten hoogste {MaxThemadoelen} themadoelen die een leerplandoel zijn.");
        }

        var themadoel = new Themadoel(Id, koppeling);
        _themadoelen.Add(themadoel);
        return themadoel;
    }

    /// <summary>
    /// Records an AI goal-match suggestion at thema level (E2-04, FR-4). The link must be
    /// <see cref="KoppelingStatus.Voorgesteld"/> — the AI only ever proposes and nothing is
    /// auto-applied (Art. IV.1/IV.2). Unlike <see cref="VoegThemadoelToe"/> this carries no cap:
    /// a match run may surface any number of candidates for the teacher to curate (Art. IV.8).
    /// </summary>
    public DoelKoppeling VoegDoelsuggestieToe(DoelKoppeling koppeling)
    {
        ArgumentNullException.ThrowIfNull(koppeling);
        if (koppeling.Status != KoppelingStatus.Voorgesteld)
        {
            throw new InvalidOperationException(
                "Een AI-doelsuggestie start altijd als 'voorgesteld'; de leerkracht beslist (Art. IV.1/IV.2).");
        }

        _doelsuggesties.Add(koppeling);
        return koppeling;
    }

    /// <summary>
    /// Whether this thema already carries a link (a curated themadoel or an existing AI suggestion) to
    /// <paramref name="leerplandoelCode"/>. Used by the matching flow to stay idempotent across re-runs
    /// and to avoid re-proposing an already-anchored doel (E2-04).
    /// </summary>
    public bool IsAlGekoppeldAan(string leerplandoelCode)
    {
        if (string.IsNullOrWhiteSpace(leerplandoelCode))
        {
            return false;
        }

        var code = leerplandoelCode.Trim();
        return _doelsuggesties.Any(k => string.Equals(k.LeerplandoelCode, code, StringComparison.Ordinal))
            || _themadoelen.Any(td => string.Equals(td.Koppeling.LeerplandoelCode, code, StringComparison.Ordinal));
    }

    /// <summary>
    /// Removes an AI suggestion from this thema (E2-04 re-import reconciliation / E2-05 reject cleanup).
    /// Only a <c>voorgesteld</c> suggestion lives here; a teacher decision is recorded elsewhere.
    /// </summary>
    public void VerwijderDoelsuggestie(DoelKoppeling suggestie)
    {
        ArgumentNullException.ThrowIfNull(suggestie);
        _doelsuggesties.Remove(suggestie);
    }

    /// <summary>
    /// Adds an age-scoped subthema to this thema. The subthema must name its <paramref name="leeftijd"/> —
    /// scoping is structural (Art. IX.2) — and it holds for every klas that teaches that age.
    /// </summary>
    public Subthema VoegSubthemaToe(string naam, int duurWeken, string leeftijd)
    {
        var subthema = new Subthema(Id, naam, duurWeken, leeftijd);
        _subthemas.Add(subthema);
        return subthema;
    }

    /// <summary>The bound the FR-1 import keeps on leerplandoel themadoelen, until its own ticket (FB-043). A screen has none.</summary>
    public const int MaxThemadoelen = 3;

    /// <summary>The pedagogically expected minimum number of themadoelen per thema (Art. IX.2), advisory.</summary>
    public const int MinThemadoelen = 2;

    private static void Replace(List<string> target, IEnumerable<string> source)
    {
        ArgumentNullException.ThrowIfNull(source);
        target.Clear();
        target.AddRange(source
            .Where(w => !string.IsNullOrWhiteSpace(w))
            .Select(w => w.Trim()));
    }

    private static string Require(string value, string paramName)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new ArgumentException($"'{paramName}' is required.", paramName);
        }

        return value.Trim();
    }

    private static int RequirePositive(int value, string paramName) =>
        value > 0 ? value : throw new ArgumentOutOfRangeException(paramName, value, "Duur in weken moet positief zijn.");

    private static string? Optional(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
