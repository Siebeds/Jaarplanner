namespace Jaarplanner.Application.Ai;

/// <summary>
/// The injectable seam for all AI model calls (Art. IV.6, Art. VIII). The AI matching (FR-4) and
/// plan-generation (FR-5) logic depends only on this abstraction, never on Azure AI Foundry
/// directly, so:
/// <list type="bullet">
/// <item>the provider (currently Azure AI Foundry) is swappable and its key stays server-side
/// (Art. VI.4) — the interface exposes no endpoint or credential;</item>
/// <item>the matching/plan logic is <b>testable with a faked client, no network</b> (Art. IV.6) —
/// tests inject a fake that returns canned completions.</item>
/// </list>
/// The real implementation lives in Infrastructure (Art. VIII); the fake lives in the test project.
/// </summary>
public interface IAiClient
{
    /// <summary>
    /// Sends a grounded prompt to the model and returns its raw completion. The request is built
    /// only from school + Op.stap data (Art. IV.4); the returned <see cref="AiCompletion.Content"/>
    /// is the raw structured-JSON text (Art. IV.5) that E2-03 validates before it reaches the domain.
    /// </summary>
    /// <param name="request">The grounded system + user prompt (built in E2-02).</param>
    /// <param name="cancellationToken">Cancels an in-flight call.</param>
    /// <returns>The model's raw completion.</returns>
    Task<AiCompletion> CompleteAsync(AiRequest request, CancellationToken cancellationToken = default);
}
