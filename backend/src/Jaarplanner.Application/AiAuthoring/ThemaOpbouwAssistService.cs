using Jaarplanner.Application.Ai;
using Jaarplanner.Application.AiMatching.Response;
using Jaarplanner.Domain.Curriculum;

namespace Jaarplanner.Application.AiAuthoring;

/// <summary>
/// The goal-first authoring assist service (E2-07, Art. IV.8, Gap A.7). It provides the wizard's
/// step 2 (themadoel) and step 6 (subdoel) AI hooks end-to-end behind two injectable seams — the
/// <see cref="IAiClient"/> (E2-01) and the <see cref="ILeerdoelCatalogus"/> read port (E2-07) — so
/// the whole flow runs against fakes with <b>no network and no database</b> in tests (Art. IV.6).
/// Each hook:
/// <list type="number">
/// <item>loads the bounded, read-only Op.stap leerplandoel candidates (grounding + resolvable set);</item>
/// <item>builds the grounded authoring prompt (<see cref="ThemaOpbouwPromptBuilder"/>, Art. IV.4);</item>
/// <item>calls the model through the injected client (E2-01);</item>
/// <item>parses + validates the raw completion against the structured-JSON contract, <b>reusing the
/// E2-03 <see cref="DoelMatchResponseParser"/></b> since the authoring response is the same
/// <c>{code, motivatie}</c> shape (Art. IV.5);</item>
/// <item>returns the validated suggestions as <b>advisory, transient</b> advice — resolving each code
/// against the loaded set (a fabricated code is skipped, never invented; Art. III.5/IV.4) and
/// enriching it from the read-only leerplandoel. <b>Nothing is persisted or auto-applied</b>
/// (Art. IV.1/IV.2); the wizard persists an accepted suggestion via the beheer endpoints (E1/E6).</item>
/// </list>
/// On any invalid/malformed output nothing is returned and the failure is surfaced (Art. IV.5).
/// </summary>
public sealed class ThemaOpbouwAssistService : IThemaOpbouwAssistService
{
    private readonly IAiClient _aiClient;
    private readonly ILeerdoelCatalogus _catalogus;

    /// <summary>Constructs the service around the injected AI client and leerdoel catalogus (DI / tests).</summary>
    public ThemaOpbouwAssistService(IAiClient aiClient, ILeerdoelCatalogus catalogus)
    {
        ArgumentNullException.ThrowIfNull(aiClient);
        ArgumentNullException.ThrowIfNull(catalogus);
        _aiClient = aiClient;
        _catalogus = catalogus;
    }

    /// <inheritdoc />
    public async Task<ThemaOpbouwAdviesResultaat> StelThemadoelenVoorAsync(
        ThemadoelSuggestieVerzoek verzoek,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(verzoek);
        ArgumentNullException.ThrowIfNull(verzoek.Thema);

        var leerdoelen = await _catalogus.HaalLeerdoelenAsync(verzoek.Selectie ?? LeerdoelSelectie.Alles, cancellationToken);
        var request = ThemaOpbouwPromptBuilder.BouwThemadoelRequest(verzoek.Thema, leerdoelen);
        return await VoerAssistUitAsync(request, leerdoelen, verzoek.Thema.GekozenThemadoelCodes, cancellationToken);
    }

    /// <inheritdoc />
    public async Task<ThemaOpbouwAdviesResultaat> StelSubdoelenVoorAsync(
        SubdoelSuggestieVerzoek verzoek,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(verzoek);
        ArgumentNullException.ThrowIfNull(verzoek.Thema);
        ArgumentNullException.ThrowIfNull(verzoek.Subthema);

        var leerdoelen = await _catalogus.HaalLeerdoelenAsync(verzoek.Selectie ?? LeerdoelSelectie.Alles, cancellationToken);
        var request = ThemaOpbouwPromptBuilder.BouwSubdoelRequest(verzoek.Thema, verzoek.Subthema, leerdoelen);
        return await VoerAssistUitAsync(request, leerdoelen, verzoek.Thema.GekozenThemadoelCodes, cancellationToken);
    }

    // Shared step 3–5: call the model, validate (reusing the E2-03 parser), then turn the validated
    // suggestions into advisory, transient advice — resolving/enriching against the loaded set and
    // skipping fabricated codes. Nothing is persisted here (Art. IV.1/IV.2).
    private async Task<ThemaOpbouwAdviesResultaat> VoerAssistUitAsync(
        AiRequest request,
        IReadOnlyCollection<Leerplandoel> leerdoelen,
        IReadOnlyCollection<string>? reedsGekozenCodes,
        CancellationToken cancellationToken)
    {
        var completion = await _aiClient.CompleteAsync(request, cancellationToken);
        var parse = DoelMatchResponseParser.Parse(completion);

        // On any invalid/malformed output: return NOTHING and surface the failure (Art. IV.5).
        if (!parse.IsGeldig)
        {
            return ThemaOpbouwAdviesResultaat.Mislukt(parse.Fout!);
        }

        var perCode = leerdoelen
            .GroupBy(d => d.Code, StringComparer.Ordinal)
            .ToDictionary(g => g.Key, g => g.First(), StringComparer.Ordinal);

        // Exclude any themadoel codes already chosen (step 2 output) so a subdoel run never re-proposes
        // an anchor; harmless/empty at step 2 itself.
        var uitgesloten = new HashSet<string>(
            (reedsGekozenCodes ?? []).Where(c => !string.IsNullOrWhiteSpace(c)).Select(c => c.Trim()),
            StringComparer.Ordinal);

        var gezien = new HashSet<string>(StringComparer.Ordinal);
        var suggesties = new List<ThemaOpbouwAdvies>();
        var onbekend = new List<string>();

        foreach (var suggestie in parse.Suggesties)
        {
            // Skip a code the model returned twice in one response.
            if (!gezien.Add(suggestie.Code))
            {
                continue;
            }

            if (uitgesloten.Contains(suggestie.Code))
            {
                continue;
            }

            // Only codes that actually exist in the loaded set are resolvable — never fabricate (Art. III.5/IV.4).
            if (!perCode.TryGetValue(suggestie.Code, out var doel))
            {
                onbekend.Add(suggestie.Code);
                continue;
            }

            suggesties.Add(new ThemaOpbouwAdvies
            {
                Code = doel.Code,
                Motivatie = suggestie.Motivatie,
                Tekst = doel.Tekst,
                Doelsoort = doel.Doelsoort.ToCode(),
                JaarFase = doel.JaarFase,
            });
        }

        return ThemaOpbouwAdviesResultaat.Geslaagd(suggesties, onbekend);
    }
}
