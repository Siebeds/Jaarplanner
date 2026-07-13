using Jaarplanner.Application.Ai;

namespace Jaarplanner.Application.AiMatching;

/// <summary>
/// The AI goal-matching service (FR-4). This is the <b>seam</b> introduced by E2-01: it depends only
/// on the injectable <see cref="IAiClient"/>, so the matching flow runs against a faked client with
/// no network in tests (Art. IV.6). The surrounding pieces land in the next E2 stories and slot in
/// around this same dependency:
/// <list type="bullet">
/// <item>E2-02 builds the grounded <see cref="AiRequest"/> from the school + Op.stap data;</item>
/// <item>E2-03 validates the raw <see cref="AiCompletion"/> against the structured-JSON contract;</item>
/// <item>E2-04 persists the validated matches as <c>DoelKoppeling</c> rows (status <c>voorgesteld</c>
/// + <c>aiMotivatie</c>), advisory only (Art. IV.1/IV.2).</item>
/// </list>
/// For E2-01 the method is a thin pass-through that proves the injected client is reachable
/// end-to-end; it deliberately does no prompt building or validation yet (those are the stories
/// above), keeping this change small and the seam honest.
/// </summary>
public sealed class DoelMatchingService
{
    private readonly IAiClient _aiClient;

    /// <summary>Constructs the service around the injected AI client (DI / tests).</summary>
    public DoelMatchingService(IAiClient aiClient)
    {
        ArgumentNullException.ThrowIfNull(aiClient);
        _aiClient = aiClient;
    }

    /// <summary>
    /// Requests raw goal-match suggestions for a grounded prompt. Returns the model's raw completion
    /// unchanged — validation (E2-03) and persistence (E2-04) are layered on later. Nothing here is
    /// applied automatically: the AI only proposes (Art. IV.1).
    /// </summary>
    /// <param name="request">The grounded prompt (built by E2-02).</param>
    /// <param name="cancellationToken">Cancels an in-flight call.</param>
    /// <returns>The model's raw completion, to be validated downstream.</returns>
    public async Task<AiCompletion> VraagSuggestiesAsync(
        AiRequest request,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        return await _aiClient.CompleteAsync(request, cancellationToken);
    }
}
