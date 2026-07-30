namespace Jaarplanner.Application.Planning.Generatie;

/// <summary>
/// What the teacher supplies <b>before</b> generation runs (FR-5.4). The FR names three things — vakanties, vaste
/// momenten and gewenste startthema's — and only two of them belong here.
/// <para>
/// <b>Vakanties are deliberately NOT a parameter.</b> They are already school data on the <see cref="Schooljaar"/>
/// (<c>Schoolsluiting</c>, E3-05), and because planningsblokken are <i>derived</i> from that data a block can never
/// span a vakantie (ADR-0020). So the vakantie half of FR-5.4 is satisfied structurally and was before this story:
/// generation cannot place a thema across a holiday because no such slot is ever offered to the model. Accepting
/// vakanties again here would create a second source of truth for the school calendar, and the first time the two
/// disagreed the plan would be built on the wrong one. If a teacher needs to correct a vakantie, that is an edit to
/// the schooljaar (E6-03), and the directie ruling of 2026-07-28 already governs what that does to existing
/// placements.
/// </para>
/// <para>
/// <b>The two halves that do live here are deliberately different in kind, and the difference is the whole design.</b>
/// A <i>gewenst startthema</i> is a preference: it is advisory, it goes into the prompt, and the report says whether
/// the model honoured it. A <i>vast moment</i> that blocks placement is a constraint: it is enforced by the service,
/// which skips any placement landing in that period. Enforcing the first would mean the tool placing a thema the
/// model never proposed, leaving its provenance unstatable — <c>voorgesteld</c> would be false (no AI proposed it)
/// and <c>manueel</c> would survive regeneration, stranding a parameter the teacher had since changed. Merely asking
/// for the second would mean a teacher who said "this period is taken" getting a thema in it anyway.
/// </para>
/// <para>
/// <b>Nothing here is a quality judgement.</b> E3-02 deliberately refused to let the tool veto a bad spread, because
/// what counts as a good spread is the school's question, not the code's. This type does not reopen that: it carries
/// only instructions the teacher stated outright, and honouring a human's explicit instruction is the opposite of
/// the tool deciding (Art. IV.1). Every resulting placement is still <c>voorgesteld</c> and still reviewable.
/// </para>
/// </summary>
public sealed record JaarplanGeneratieParameters
{
    /// <summary>The no-parameters case — what <c>GenereerAsync</c> uses when a caller supplies nothing.</summary>
    public static readonly JaarplanGeneratieParameters Geen = new();

    /// <summary>
    /// Thema names the teacher wants the year to open with, in the order given (FR-5.4 "gewenste startthema's").
    /// <b>Advisory</b>: carried into the prompt, and <see cref="ParameterRapport"/> reports whether the returned plan
    /// actually opened with them. A name the school does not own is reported, never invented (Art. IV.4).
    /// </summary>
    public IReadOnlyList<string> GewensteStartthemas { get; init; } = [];

    /// <summary>
    /// Dates the school has already committed (FR-5.4 "vaste momenten") — a schoolfeest, a sportdag, a
    /// pedagogische studiedag that is not a closure. Each names itself in the teacher's own words and resolves to
    /// whichever planningsblok contains it, so a teacher never has to know where a block boundary falls.
    /// </summary>
    public IReadOnlyList<VastMoment> VasteMomenten { get; init; } = [];

    /// <summary>True when the teacher supplied nothing, so the prompt can omit the section entirely.</summary>
    public bool IsLeeg => GewensteStartthemas.Count == 0 && VasteMomenten.Count == 0;

    /// <summary>
    /// The startthema names with blanks dropped and duplicates removed, order preserved. Normalising here rather
    /// than in the prompt builder keeps the builder pure and keeps the report measuring the same list the model saw.
    /// </summary>
    public IReadOnlyList<string> GenormaliseerdeStartthemas() =>
        GewensteStartthemas
            .Where(naam => !string.IsNullOrWhiteSpace(naam))
            .Select(naam => naam.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
}

/// <summary>
/// One date the school has already committed, supplied by the teacher before generation (FR-5.4).
/// </summary>
/// <param name="Naam">
/// What it is, in the teacher's own words ("Schoolfeest", "Sportdag"). Rendered into the prompt so the model can
/// reason about it, and echoed in the report.
/// </param>
/// <param name="Datum">
/// When it falls. A <b>date</b>, not a block: the service resolves which planningsblok contains it at generation
/// time. Keying on the block's start date instead would ask the teacher to know the grid, and would go stale the
/// moment a vakantie edit reshaped it — the same reasoning ADR-0020 §3 applies to placements.
/// </param>
/// <param name="BlokkeertPlaatsing">
/// When <c>true</c>, no new thema may be placed in the period containing this date, and the service skips any that
/// the model returns there. When <c>false</c> the moment is context only: the model is told it exists so it can
/// reason about the period's real capacity, but nothing is refused. Defaults to <c>false</c>, because the weaker
/// reading is the safe one to assume when a caller does not say.
/// </param>
public sealed record VastMoment(string Naam, DateOnly Datum, bool BlokkeertPlaatsing = false);
