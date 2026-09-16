namespace Jaarplanner.Application.Ai;

/// <summary>
/// The injectable seam for all AI model calls (Art. IV.6, Art. VIII). The AI matching (FR-4), the
/// plan generation (FR-5), a woordweb's words (FB-036) and the rewrite of a rapporttekst (FR-13.4,
/// FB-004) all depend only on this abstraction, never on Azure AI Foundry directly, so:
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
    /// Sends a grounded prompt to the model and returns its raw completion. What may be in that
    /// prompt is each caller's to answer, not this seam's (Art. IV.4): school and Op.stap data for
    /// the matching and the planning, a woordweb's own words under the Art. IV.4 exception
    /// (ADR-0043), and, for a rapporttekst rewrite, that one text with the klas's names already
    /// replaced (ADR-0035 §3.5). The returned <see cref="AiCompletion.Content"/> is the raw
    /// structured-JSON text (Art. IV.5) that each caller's parser validates before it reaches the
    /// domain.
    /// </summary>
    /// <param name="request">The grounded system + user prompt, built by the caller's prompt builder.</param>
    /// <param name="cancellationToken">Cancels an in-flight call.</param>
    /// <returns>The model's raw completion.</returns>
    Task<AiCompletion> CompleteAsync(AiRequest request, CancellationToken cancellationToken = default);
}
