using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;

namespace Jaarplanner.Application.Planning.Generatie;

/// <summary>
/// What became of the teacher's pre-generation parameters (FR-5.4's "measurably influence the result"), measured
/// against the plan that actually came back.
/// <para>
/// <b>Threshold-free and verdict-free, exactly like <see cref="Spreidingsrapport"/>.</b> It states facts — you asked
/// for these thema's to open the year, here is what opened it; you blocked these periods, here is what was refused —
/// and attaches no pass/fail and triggers no retry. Generation never loops until the parameters are satisfied
/// (Art. IV.1): a model that keeps ignoring a request is a fact the teacher should see, not one the tool should hide
/// inside a retry.
/// </para>
/// <para>
/// <b>Why the two halves report differently.</b> The blocked-period half reports what the service <i>enforced</i>, so
/// it is a record of an action taken. The startthema half reports what the model <i>chose</i>, so it is a record of a
/// request possibly declined. Collapsing them into one "parameters honoured: yes/no" would hide which of the two
/// happened, and a teacher acts differently on each: a declined preference is worth re-running or overriding by hand,
/// while an enforced block working as asked needs no action at all.
/// </para>
/// </summary>
public sealed record ParameterRapport
{
    private static readonly IReadOnlyList<string> Leeg = [];

    /// <summary>The report for a run where the teacher supplied no parameters.</summary>
    public static readonly ParameterRapport Geen = new();

    /// <summary>
    /// Start thema's the teacher asked for that the school does not own — reported, never invented (Art. IV.4). A
    /// typo in a parameter is otherwise indistinguishable from a model that ignored the request.
    /// </summary>
    public IReadOnlyList<string> OnbekendeStartthemas { get; init; } = Leeg;

    /// <summary>
    /// Start thema's the teacher asked for that <b>are</b> placed in the year's first planningsblok in the resulting
    /// plan. Compared against <see cref="NietGehonoreerdeStartthemas"/> this says plainly how far the model complied.
    /// </summary>
    public IReadOnlyList<string> GehonoreerdeStartthemas { get; init; } = Leeg;

    /// <summary>
    /// Start thema's the school owns, that the teacher asked for, and that the resulting plan does <b>not</b> place in
    /// the first block. Non-empty means the model declined a request; the plan still stands and the teacher decides.
    /// </summary>
    public IReadOnlyList<string> NietGehonoreerdeStartthemas { get; init; } = Leeg;

    /// <summary>
    /// Placements the service <b>refused</b> because they landed in a period a blocking vast moment holds — the
    /// enforced half of FR-5.4. Each entry names the thema, the period and the moment that blocked it, because
    /// "something was dropped" without saying which teacher instruction dropped it is not actionable.
    /// </summary>
    public IReadOnlyList<string> GeweigerdDoorVastMoment { get; init; } = Leeg;

    /// <summary>
    /// Vaste momenten whose date falls in no planningsblok at all — outside the school year, or inside a vakantie,
    /// which by ADR-0020 is not part of any block. Reported rather than silently ignored: a teacher who blocked a
    /// period and sees nothing refused would otherwise conclude the block was honoured when it was never applied.
    /// </summary>
    public IReadOnlyList<string> OnplaatsbareVasteMomenten { get; init; } = Leeg;

    /// <summary>True when the teacher asked for something that did not happen — the one thing a UI must surface.</summary>
    public bool HeeftAandachtspunten =>
        OnbekendeStartthemas.Count > 0
        || NietGehonoreerdeStartthemas.Count > 0
        || OnplaatsbareVasteMomenten.Count > 0;

    /// <summary>
    /// Measures the startthema half against the resulting plan. The blocked-period half is recorded by the service as
    /// it enforces, because only the service knows what it refused.
    /// </summary>
    /// <param name="parameters">What the teacher asked for.</param>
    /// <param name="plaatsingen">The resulting plan's placements on the generation tier.</param>
    /// <param name="themaPerId">Thema lookup, for turning a placement back into a name.</param>
    /// <param name="eersteBlok">
    /// The year's first planningsblok, or <c>null</c> when the year yields no blocks at all — in which case no
    /// startthema can be honoured and every requested one is reported as not honoured rather than as satisfied.
    /// </param>
    /// <param name="themaNamen">The names the school owns, for separating a typo from a declined request.</param>
    public static ParameterRapport Meet(
        JaarplanGeneratieParameters parameters,
        IEnumerable<Themaplaatsing> plaatsingen,
        IReadOnlyDictionary<Guid, Thema> themaPerId,
        Planningsblok? eersteBlok,
        IReadOnlySet<string> themaNamen)
    {
        ArgumentNullException.ThrowIfNull(parameters);
        ArgumentNullException.ThrowIfNull(plaatsingen);
        ArgumentNullException.ThrowIfNull(themaPerId);
        ArgumentNullException.ThrowIfNull(themaNamen);

        var gevraagd = parameters.GenormaliseerdeStartthemas();
        if (gevraagd.Count == 0)
        {
            return Geen;
        }

        // Only placements that are actually planned count as honouring the request. A rejected placement survives
        // regeneration (see JaarplanGeneratieResultaat.Afgewezen) but nothing is taught because of it, so reporting a
        // startthema as honoured on the strength of one the teacher threw out would be the same defect the E3-02 code
        // review found in the spreading report.
        var inEersteBlok = eersteBlok is null
            ? new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            : plaatsingen
                .Where(p => p.IsGepland && p.BlokStart == eersteBlok.Start)
                .Select(p => themaPerId.TryGetValue(p.ThemaId, out var thema) ? thema.Naam : null)
                .Where(naam => naam is not null)
                .Select(naam => naam!)
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var onbekend = new List<string>();
        var gehonoreerd = new List<string>();
        var niet = new List<string>();

        foreach (var naam in gevraagd)
        {
            if (!themaNamen.Contains(naam))
            {
                onbekend.Add(naam);
            }
            else if (inEersteBlok.Contains(naam))
            {
                gehonoreerd.Add(naam);
            }
            else
            {
                niet.Add(naam);
            }
        }

        return new ParameterRapport
        {
            OnbekendeStartthemas = onbekend,
            GehonoreerdeStartthemas = gehonoreerd,
            NietGehonoreerdeStartthemas = niet,
        };
    }
}
