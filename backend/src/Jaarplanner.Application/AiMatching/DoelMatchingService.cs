using Jaarplanner.Application.Ai;
using Jaarplanner.Application.AiAuthoring;
using Jaarplanner.Application.AiMatching.Response;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Schoolcontent;

namespace Jaarplanner.Application.AiMatching;

/// <summary>
/// A thema's doelsuggesties (FB-053, ADR-0049, FR-4): the AI proposes minimumdoelen as themadoel, and a person with the
/// right accepts or rejects each. It works behind three injectable seams, the <see cref="IAiClient"/>, the
/// <see cref="IDoelMatchOpslag"/> and the read-only <see cref="ILeerdoelCatalogus"/>, so the whole flow runs against
/// fakes with no network and no database (Art. IV.6).
/// <para>
/// A run: the leeftijden (chosen, or the subthema's) give the mijlpalen (<see cref="Jaarfasen.MijlpalenVoor"/>), their
/// minimumdoelen are the candidates, <see cref="MatchingPromptBuilder"/> writes the grounded prompt (Art. IV.4), the
/// model answers, <see cref="DoelMatchResponseParser"/> validates it (Art. IV.5), and each valid, new proposal is stored
/// as <c>voorgesteld</c> with its motivation (Art. IV.2). An invalid answer stores nothing.
/// </para>
/// <para>
/// <b>Refs are matched exactly.</b> A ref is a decreed identifier (Art. III.5): a model that answers <c>k-1.1.1</c> for
/// <c>K-1.1.1</c> has altered it, so the answer is skipped and reported, never repaired.
/// </para>
/// </summary>
public sealed class DoelMatchingService
{
    private readonly IAiClient _aiClient;
    private readonly IDoelMatchOpslag _opslag;
    private readonly ILeerdoelCatalogus _catalogus;
    private readonly Promptbegrenzing _begrenzing;

    /// <summary>Constructs the service around its seams and the prompt ceiling of TB-007 (DI / tests).</summary>
    public DoelMatchingService(
        IAiClient aiClient,
        IDoelMatchOpslag opslag,
        ILeerdoelCatalogus catalogus,
        Promptbegrenzing begrenzing)
    {
        ArgumentNullException.ThrowIfNull(aiClient);
        ArgumentNullException.ThrowIfNull(opslag);
        ArgumentNullException.ThrowIfNull(catalogus);
        ArgumentNullException.ThrowIfNull(begrenzing);
        _aiClient = aiClient;
        _opslag = opslag;
        _catalogus = catalogus;
        _begrenzing = begrenzing;
    }

    /// <summary>
    /// Runs the doelsuggesties for a thema (FR-4.1), the trigger behind <c>POST …/doelsuggesties/genereer</c>.
    /// </summary>
    /// <param name="themaId">The thema.</param>
    /// <param name="jaarFasen">The leeftijden chosen; null or empty takes the leeftijden of the thema's subthema's.</param>
    /// <param name="cancellationToken">Cancels an in-flight call.</param>
    /// <exception cref="ThemaNietGevondenFout">The thema does not exist.</exception>
    /// <exception cref="JaarfaseKeuzeNodigFout">No leeftijd was chosen and no subthema has a known one.</exception>
    /// <exception cref="PromptTeGrootFout">The prompt is over the configured ceiling; the model was not called.</exception>
    public async Task<DoelMatchResultaat> GenereerSuggestiesAsync(
        Guid themaId,
        IReadOnlyCollection<string>? jaarFasen = null,
        CancellationToken cancellationToken = default)
    {
        var thema = await _opslag.LaadThemaAsync(themaId, cancellationToken)
            ?? throw new ThemaNietGevondenFout($"Thema {themaId} bestaat niet.");

        var gekozen = Gekozen(jaarFasen);
        var fasen = gekozen.Count > 0 ? gekozen : LeeftijdenVan(thema);
        var mijlpalen = Jaarfasen.MijlpalenVoor(fasen);
        if (mijlpalen.Count == 0)
        {
            throw new JaarfaseKeuzeNodigFout("Kies eerst voor welke leeftijden je doelsuggesties wil.");
        }

        var kandidaten = await _catalogus.HaalMinimumdoelenAsync(mijlpalen, cancellationToken);
        var resultaat = await MatchAsync(thema, kandidaten, cancellationToken);
        return resultaat with { JaarFasen = fasen, Mijlpalen = mijlpalen };
    }

    // The chosen codes in the canonical form and the order of the vocabulary; an unknown code is dropped.
    private static IReadOnlyList<string> Gekozen(IReadOnlyCollection<string>? jaarFasen)
    {
        var codes = (jaarFasen ?? [])
            .Where(j => !string.IsNullOrWhiteSpace(j))
            .Select(j => Jaarfasen.Normaliseer(j.Trim().ToUpperInvariant()))
            .ToHashSet(StringComparer.Ordinal);
        return Jaarfasen.Alle.Where(codes.Contains).ToList();
    }

    // The thema's own leeftijden in the canonical form (3K is K3) and the order of the vocabulary. A leeftijd that is
    // none of the nine codes, which an older import can hold, meets no mijlpaal and is left out.
    private static IReadOnlyList<string> LeeftijdenVan(Thema thema)
    {
        var leeftijden = thema.Subthemas.Select(s => Jaarfasen.Normaliseer(s.Leeftijd)).ToHashSet(StringComparer.Ordinal);
        return Jaarfasen.Alle.Where(leeftijden.Contains).ToList();
    }

    private async Task<DoelMatchResultaat> MatchAsync(
        Thema thema,
        IReadOnlyList<Minimumdoel> kandidaten,
        CancellationToken cancellationToken)
    {
        var perRef = kandidaten
            .GroupBy(m => m.Ref, StringComparer.Ordinal)
            .ToDictionary(g => g.Key, g => g.First(), StringComparer.Ordinal);

        // No candidates: nothing could be proposed, so the model is not called.
        if (perRef.Count == 0)
        {
            return DoelMatchResultaat.Geslaagd([], [], [], aantalKandidaten: 0);
        }

        var request = MatchingPromptBuilder.Bouw(thema, kandidaten, thema.NietVoorTeStellenMinimumdoelen());

        // Over the ceiling the model is not called and nothing is stored (TB-007).
        _begrenzing.Bewaak(request, kandidaten);
        var completion = await _aiClient.CompleteAsync(request, cancellationToken);
        var parse = DoelMatchResponseParser.Parse(completion);

        // An invalid answer stores nothing (Art. IV.5). No retry: judging quality is the person's job (Art. IV.7).
        if (!parse.IsGeldig)
        {
            return DoelMatchResultaat.Mislukt(parse.Fout!, perRef.Count);
        }

        var bewaard = new List<DoelMatchSuggestieWeergave>();
        var onbekend = new List<string>();
        var duplicaat = new List<string>();

        foreach (var suggestie in parse.Suggesties)
        {
            if (!perRef.TryGetValue(suggestie.Code, out var doel))
            {
                onbekend.Add(suggestie.Code);
                continue;
            }

            // A themadoel, an open or rejected proposal (an earlier one, or this answer's own), ADR-0049 D1. A minimumdoel
            // accepted before and unlinked since passes, and its row is proposed again.
            if (thema.IsUitgeslotenVoorVoorstel(doel.Ref))
            {
                duplicaat.Add(suggestie.Code);
                continue;
            }

            // At most eight are kept, whatever the model sends (ADR-0049 D3).
            if (bewaard.Count == MatchingPromptBuilder.MaxSuggesties)
            {
                break;
            }

            var voorstel = thema.VoegDoelsuggestieToe(doel.Ref, suggestie.Motivatie);
            bewaard.Add(Map(voorstel, doel));
        }

        if (bewaard.Count > 0)
        {
            await _opslag.BewaarAsync(cancellationToken);
        }

        return DoelMatchResultaat.Geslaagd(bewaard, onbekend, duplicaat, perRef.Count);
    }

    /// <summary>The doelsuggesties stored for a thema, open and decided (FR-4.2). Read-only.</summary>
    public Task<IReadOnlyList<DoelMatchSuggestieWeergave>> HaalSuggestiesVoorThemaAsync(
        Guid themaId,
        CancellationToken cancellationToken = default) =>
        _opslag.HaalSuggestiesVoorThemaAsync(themaId, cancellationToken);

    /// <summary>
    /// Records a person's decision on one proposal (FR-4.3): <see cref="KoppelingStatus.Aanvaard"/> makes the minimumdoel
    /// a themadoel of the thema, <see cref="KoppelingStatus.Geweigerd"/> keeps it from being proposed again. A proposal
    /// is decided once (ADR-0049 D2).
    /// </summary>
    /// <exception cref="OngeldigeSuggestieStatusFout">The status is not aanvaard or geweigerd, or the proposal was already decided.</exception>
    /// <exception cref="ThemaNietGevondenFout">The thema does not exist.</exception>
    /// <exception cref="DoelsuggestieNietGevondenFout">The thema has no proposal with that id.</exception>
    public async Task<DoelMatchSuggestieWeergave> WijzigSuggestieStatusAsync(
        Guid themaId,
        Guid suggestieId,
        KoppelingStatus status,
        CancellationToken cancellationToken = default)
    {
        if (status is not (KoppelingStatus.Aanvaard or KoppelingStatus.Geweigerd))
        {
            throw new OngeldigeSuggestieStatusFout("Een voorstel wordt aanvaard of geweigerd.");
        }

        var thema = await _opslag.LaadThemaAsync(themaId, cancellationToken)
            ?? throw new ThemaNietGevondenFout($"Thema {themaId} bestaat niet.");

        var suggestie = thema.Doelsuggesties.FirstOrDefault(s => s.Id == suggestieId)
            ?? throw new DoelsuggestieNietGevondenFout($"Doelsuggestie {suggestieId} bestaat niet op thema {themaId}.");

        if (suggestie.Status != KoppelingStatus.Voorgesteld)
        {
            throw new OngeldigeSuggestieStatusFout("Over dit voorstel is al beslist.");
        }

        if (status == KoppelingStatus.Aanvaard)
        {
            thema.AanvaardDoelsuggestie(suggestie);
        }
        else
        {
            thema.WeigerDoelsuggestie(suggestie);
        }

        await _opslag.BewaarAsync(cancellationToken);

        // Read after the decision is stored, so it must not fail the request: an unresolvable ref shows without text.
        var doel = (await _catalogus.HaalMinimumdoelenOpRefAsync([suggestie.MinimumdoelRef], cancellationToken))
            .FirstOrDefault(m => string.Equals(m.Ref, suggestie.MinimumdoelRef, StringComparison.Ordinal));
        return Map(suggestie, doel);
    }

    private static DoelMatchSuggestieWeergave Map(Minimumdoelsuggestie suggestie, Minimumdoel? doel) =>
        new(suggestie.Id,
            suggestie.MinimumdoelRef,
            suggestie.Status.ToString(),
            suggestie.AiMotivatie,
            doel?.Omschrijving,
            doel?.Leeftijd);
}
