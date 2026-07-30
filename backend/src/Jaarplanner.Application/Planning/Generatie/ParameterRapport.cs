using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;

namespace Jaarplanner.Application.Planning.Generatie;

/// <summary>
/// What became of the teacher's pre-generation parameters (FR-5.4), measured against the plan that actually came back.
/// <para>
/// <b>Threshold-free and verdict-free, exactly like <see cref="Spreidingsrapport"/>.</b> It states facts and attaches
/// no pass/fail. Generation never loops until the parameters are satisfied (Art. IV.1): a model that keeps ignoring a
/// request is a fact the teacher should see, not one the tool should hide inside a retry.
/// </para>
/// <para>
/// <b>Every entry is structured, never a pre-composed sentence.</b> An earlier revision returned strings like
/// <c>"Herfst @ 2026-09-01 (Schoolfeest)"</c> — server-authored presentation text carrying an ISO date no Dutch teacher
/// reads, destined straight for a screen. That is the shape E3-06 was reverted for, and it would have added two more
/// free-text lists to the migration surface of the open Art. II.3 ruling. The UI composes the sentence from
/// <c>nl.json</c> and formats the date itself.
/// </para>
/// <para>
/// <b>Four outcomes are kept apart because a teacher acts differently on each:</b> the model declined a request
/// (<see cref="NietGehonoreerdeStartthemas"/>); the teacher's own two instructions contradicted each other
/// (<see cref="TegenstrijdigeStartthemas"/>); the tool refused a placement (<see cref="GeweigerdDoorVastMoment"/>); or
/// an instruction could not be applied at all (<see cref="OnplaatsbareVasteMomenten"/>). Collapsing them into
/// "parameters honoured: yes/no" would hide which happened.
/// </para>
/// </summary>
public sealed record ParameterRapport
{
    private static readonly IReadOnlyList<string> LeegTekst = [];
    private static readonly IReadOnlyList<GeweigerdePlaatsing> LeegGeweigerd = [];
    private static readonly IReadOnlyList<VastMomentUitkomst> LeegMomenten = [];

    /// <summary>The report for a run where the teacher supplied no parameters.</summary>
    public static readonly ParameterRapport Geen = new();

    /// <summary>
    /// Start thema's the teacher asked for that the school does not own — reported, never invented (Art. IV.4). Kept
    /// apart from a declined request because otherwise a typo in a parameter is indistinguishable from a model that
    /// ignored it, and the teacher goes looking for the wrong problem.
    /// </summary>
    public IReadOnlyList<string> OnbekendeStartthemas { get; init; } = LeegTekst;

    /// <summary>Start thema's that <b>are</b> planned in the block their position asked for.</summary>
    public IReadOnlyList<string> GehonoreerdeStartthemas { get; init; } = LeegTekst;

    /// <summary>
    /// Start thema's the school owns, that the teacher asked for, and that the resulting plan does <b>not</b> place in
    /// the block their position asked for — <b>where the request was answerable at all</b>. Non-empty means the model
    /// declined a request; the plan still stands and the teacher decides.
    /// </summary>
    public IReadOnlyList<string> NietGehonoreerdeStartthemas { get; init; } = LeegTekst;

    /// <summary>
    /// Start thema's whose target block the teacher <b>also</b> blocked with a vast moment — two of their own
    /// instructions in direct conflict.
    /// <para>
    /// Separated from <see cref="NietGehonoreerdeStartthemas"/> because the model did not decline these: the tool
    /// refused them, on the teacher's own other instruction. Reporting that as model non-compliance would tell a
    /// teacher the AI ignored them when in fact their two inputs could not both be satisfied. This repo already treats
    /// that class of statement as a defect — see <c>JaarplanGeneratieResultaat.AantalVervangen</c>, which exists
    /// because the UI once said "er is niets gewijzigd" about a plan it had just wiped.
    /// </para>
    /// </summary>
    public IReadOnlyList<string> TegenstrijdigeStartthemas { get; init; } = LeegTekst;

    /// <summary>
    /// Placements the service <b>refused</b> because a blocking vast moment holds their period — the enforced half of
    /// FR-5.4. Each entry keeps the model's own <c>motivatie</c>, so the proposal survives the refusal and E3-07's
    /// re-placement action has something to act on.
    /// </summary>
    public IReadOnlyList<GeweigerdePlaatsing> GeweigerdDoorVastMoment { get; init; } = LeegGeweigerd;

    /// <summary>
    /// Every vast moment that was successfully resolved to a block, blocking or not. Reported in full — including a
    /// second moment landing in a period another already blocks — because a teacher who enters two and sees one
    /// acknowledged has no evidence the other was parsed. This is the same reasoning
    /// <see cref="OnplaatsbareVasteMomenten"/> exists for, applied one case over.
    /// </summary>
    public IReadOnlyList<VastMomentUitkomst> ToegepasteVasteMomenten { get; init; } = LeegMomenten;

    /// <summary>
    /// Vaste momenten whose date falls in no planningsblok at all — outside the school year, or inside a vakantie,
    /// which by ADR-0020 is part of no block. Reported rather than silently ignored: a teacher who blocked a period and
    /// saw nothing refused would otherwise conclude the block was honoured when it was never applied.
    /// </summary>
    public IReadOnlyList<VastMomentUitkomst> OnplaatsbareVasteMomenten { get; init; } = LeegMomenten;

    /// <summary>
    /// True when the teacher asked for something that did not happen — what a UI must surface.
    /// <para>
    /// <b><see cref="GeweigerdDoorVastMoment"/> counts.</b> An earlier revision excluded it on the reasoning that "an
    /// enforced block working as asked needs no action", which is wrong: a thema the teacher wanted taught is now
    /// planned nowhere, which lowers dekking (Art. V) and is precisely an action. A UI honouring the old contract would
    /// have hidden a lost thema.
    /// </para>
    /// </summary>
    public bool HeeftAandachtspunten =>
        OnbekendeStartthemas.Count > 0
        || NietGehonoreerdeStartthemas.Count > 0
        || TegenstrijdigeStartthemas.Count > 0
        || GeweigerdDoorVastMoment.Count > 0
        || OnplaatsbareVasteMomenten.Count > 0;

    /// <summary>
    /// Measures the startthema half against the resulting plan. The vast-moment half is recorded by the service as it
    /// enforces, because only the service knows what it refused.
    /// </summary>
    /// <param name="parameters">What the teacher asked for.</param>
    /// <param name="plaatsingen">The resulting plan's placements on the generation tier.</param>
    /// <param name="themaPerId">Thema lookup, for turning a placement back into a name.</param>
    /// <param name="blokken">The year's blocks in order; the i-th requested start thema targets the i-th of these.</param>
    /// <param name="themaNamen">The names the school owns, for separating a typo from a declined request.</param>
    /// <param name="geblokkeerdeBlokken">
    /// Block start dates a blocking vast moment holds, so a start thema the tool itself refused is reported as a
    /// conflict rather than as the model declining.
    /// </param>
    public static ParameterRapport Meet(
        JaarplanGeneratieParameters parameters,
        IEnumerable<Themaplaatsing> plaatsingen,
        IReadOnlyDictionary<Guid, Thema> themaPerId,
        IReadOnlyList<Planningsblok> blokken,
        IReadOnlySet<string> themaNamen,
        IReadOnlySet<DateOnly> geblokkeerdeBlokken)
    {
        ArgumentNullException.ThrowIfNull(parameters);
        ArgumentNullException.ThrowIfNull(plaatsingen);
        ArgumentNullException.ThrowIfNull(themaPerId);
        ArgumentNullException.ThrowIfNull(blokken);
        ArgumentNullException.ThrowIfNull(themaNamen);
        ArgumentNullException.ThrowIfNull(geblokkeerdeBlokken);

        var gevraagd = parameters.GenormaliseerdeStartthemas();
        if (gevraagd.Count == 0)
        {
            return Geen;
        }

        // Only placements that are actually planned count. A rejected placement survives regeneration (see
        // JaarplanGeneratieResultaat.Afgewezen) but nothing is taught because of it, so crediting a start thema on the
        // strength of one the teacher threw out would be the defect the E3-02 code review found in the spreading
        // report. Keyed by (block start, thema name) because the request is positional.
        var geplandPerBlok = plaatsingen
            .Where(p => p.IsGepland)
            .Select(p => (p.BlokStart, Naam: themaPerId.TryGetValue(p.ThemaId, out var thema) ? thema.Naam : null))
            .Where(x => x.Naam is not null)
            .ToHashSet();

        var geordendeBlokken = blokken.OrderBy(b => b.Start).ToList();

        var onbekend = new List<string>();
        var gehonoreerd = new List<string>();
        var niet = new List<string>();
        var tegenstrijdig = new List<string>();

        for (var i = 0; i < gevraagd.Count; i++)
        {
            var naam = gevraagd[i];

            if (!themaNamen.Contains(naam))
            {
                onbekend.Add(naam);
                continue;
            }

            // Asked for more start thema's than the year has blocks: not answerable, and not the model's fault.
            if (i >= geordendeBlokken.Count)
            {
                tegenstrijdig.Add(naam);
                continue;
            }

            var doelBlok = geordendeBlokken[i].Start;

            // The teacher blocked the very period they asked this thema to occupy. The tool refused it, so this is a
            // conflict between two of their own inputs, never model non-compliance.
            if (geblokkeerdeBlokken.Contains(doelBlok))
            {
                tegenstrijdig.Add(naam);
            }
            else if (geplandPerBlok.Contains((doelBlok, naam)))
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
            TegenstrijdigeStartthemas = tegenstrijdig,
        };
    }
}

/// <summary>
/// One placement the service refused because a blocking vast moment holds its period. Structured rather than
/// pre-composed so the UI writes the sentence in its own Dutch and formats the date itself (Art. II.3), and so the
/// model's proposal is not destroyed by being refused.
/// </summary>
/// <param name="ThemaNaam">The thema the model proposed.</param>
/// <param name="BlokStart">The block it was proposed for — the stable key, never an ordinal (ADR-0020 §3).</param>
/// <param name="MomentNaam">The teacher's own name for the moment that blocked it, so the refusal is attributable.</param>
/// <param name="AiMotivatie">
/// The model's reason for proposing it, kept so a refusal is not a silent loss: the teacher can still read what was
/// suggested and place it by hand (Art. IV.2/IV.3).
/// </param>
public sealed record GeweigerdePlaatsing(
    string ThemaNaam,
    DateOnly BlokStart,
    string MomentNaam,
    string? AiMotivatie);

/// <summary>
/// What became of one vast moment: the block it resolved to, or none. <paramref name="BlokStart"/> is <c>null</c> when
/// the date falls in no block (outside the year, or inside a vakantie, which belongs to no block per ADR-0020).
/// </summary>
public sealed record VastMomentUitkomst(
    string Naam,
    DateOnly Datum,
    bool BlokkeertPlaatsing,
    DateOnly? BlokStart);
