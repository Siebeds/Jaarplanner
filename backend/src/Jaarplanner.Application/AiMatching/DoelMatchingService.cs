using Jaarplanner.Application.Ai;
using Jaarplanner.Application.AiMatching.Response;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Schoolcontent;

namespace Jaarplanner.Application.AiMatching;

/// <summary>
/// The AI goal-matching service (FR-4). It wires the E2 pipeline end-to-end behind two injectable
/// seams — the <see cref="IAiClient"/> (E2-01) and the <see cref="IDoelMatchOpslag"/> persistence
/// port (E2-04) — so the whole flow runs against fakes with <b>no network and no database</b> in
/// tests (Art. IV.6). The flow for a thema is:
/// <list type="number">
/// <item>build the grounded prompt from the school thema + loaded Op.stap goals (E2-02, Art. IV.4);</item>
/// <item>call the model through the injected client (E2-01);</item>
/// <item>parse + validate the raw completion against the structured-JSON contract (E2-03, Art. IV.5);</item>
/// <item>persist each validated suggestion as a <c>DoelKoppeling</c> with status <c>voorgesteld</c>
/// and the AI motivation (Art. IV.2) — advisory only, never auto-applied (Art. IV.1).</item>
/// </list>
/// If the response is invalid, <b>nothing is persisted</b> and the failure is surfaced (Art. IV.5).
/// A returned code that is not in the loaded leerplandoel set is skipped, never fabricated
/// (Art. III.5/IV.4).
/// </summary>
public sealed class DoelMatchingService
{
    private readonly IAiClient _aiClient;
    private readonly IDoelMatchOpslag _opslag;

    /// <summary>Constructs the service around the injected AI client and persistence port (DI / tests).</summary>
    public DoelMatchingService(IAiClient aiClient, IDoelMatchOpslag opslag)
    {
        ArgumentNullException.ThrowIfNull(aiClient);
        ArgumentNullException.ThrowIfNull(opslag);
        _aiClient = aiClient;
        _opslag = opslag;
    }

    /// <summary>
    /// Runs the end-to-end match for a thema and persists the validated suggestions as
    /// <c>voorgesteld</c> <c>DoelKoppeling</c> rows (E2-04). Never auto-accepts (Art. IV.1/IV.2).
    /// </summary>
    /// <param name="themaId">The thema to match (loaded via the persistence port).</param>
    /// <param name="leerdoelen">The relevant, already-loaded Op.stap leerplandoelen to choose from — the grounding + the resolvable set.</param>
    /// <param name="minimumdoelen">Optional concorded minimumdoelen for extra grounding context.</param>
    /// <param name="cancellationToken">Cancels an in-flight call.</param>
    /// <returns>A success result (with what was persisted/skipped) or an explicit failure — nothing persisted on failure.</returns>
    /// <exception cref="ThemaNietGevondenFout">The thema does not exist.</exception>
    public async Task<DoelMatchResultaat> MatchThemaAsync(
        Guid themaId,
        IReadOnlyCollection<Leerplandoel> leerdoelen,
        IReadOnlyCollection<Minimumdoel>? minimumdoelen = null,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(leerdoelen);

        var thema = await _opslag.LaadThemaAsync(themaId, cancellationToken)
            ?? throw new ThemaNietGevondenFout($"Thema {themaId} bestaat niet.");

        // 1–3: build the grounded prompt, call the model, validate the raw completion (E2-02/01/03).
        var request = MatchingPromptBuilder.Bouw(thema, leerdoelen, minimumdoelen);
        var completion = await _aiClient.CompleteAsync(request, cancellationToken);
        var parse = DoelMatchResponseParser.Parse(completion);

        // On any invalid/malformed output: persist NOTHING and surface the failure (Art. IV.5).
        if (!parse.IsGeldig)
        {
            return DoelMatchResultaat.Mislukt(parse.Fout!);
        }

        // Only codes that actually exist in the loaded set are resolvable — never fabricate (Art. III.5/IV.4).
        var geldigeCodes = new HashSet<string>(leerdoelen.Select(d => d.Code), StringComparer.Ordinal);

        var bewaard = new List<DoelMatchSuggestieWeergave>();
        var onbekend = new List<string>();
        var duplicaat = new List<string>();

        foreach (var suggestie in parse.Suggesties)
        {
            if (!geldigeCodes.Contains(suggestie.Code))
            {
                onbekend.Add(suggestie.Code);
                continue;
            }

            // Idempotent: skip a code already linked (existing suggestion or curated themadoel).
            if (thema.IsAlGekoppeldAan(suggestie.Code))
            {
                duplicaat.Add(suggestie.Code);
                continue;
            }

            // 4: persist as `voorgesteld` + aiMotivatie — advisory, never auto-applied (Art. IV.1/IV.2).
            var koppeling = thema.VoegDoelsuggestieToe(
                new DoelKoppeling(suggestie.Code, KoppelingStatus.Voorgesteld, suggestie.Motivatie));
            bewaard.Add(MapSuggestie(koppeling));
        }

        // Persist only when there is something to persist (a valid all-duplicate/all-unknown run
        // changes nothing, so it needs no unit of work).
        if (bewaard.Count > 0)
        {
            await _opslag.BewaarAsync(cancellationToken);
        }

        return DoelMatchResultaat.Geslaagd(bewaard, onbekend, duplicaat);
    }

    /// <summary>
    /// The query path (FR-4.1/4.2): the AI match suggestions persisted for a thema. Read-only.
    /// </summary>
    public Task<IReadOnlyList<DoelMatchSuggestieWeergave>> HaalSuggestiesVoorThemaAsync(
        Guid themaId,
        CancellationToken cancellationToken = default) =>
        _opslag.HaalSuggestiesVoorThemaAsync(themaId, cancellationToken);

    private static DoelMatchSuggestieWeergave MapSuggestie(DoelKoppeling koppeling) =>
        new(koppeling.Id, koppeling.LeerplandoelCode, koppeling.Status.ToString(), koppeling.AiMotivatie);
}
