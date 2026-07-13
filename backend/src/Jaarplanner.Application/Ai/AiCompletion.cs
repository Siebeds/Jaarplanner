namespace Jaarplanner.Application.Ai;

/// <summary>
/// The model's <b>raw</b> structured response to an <see cref="AiRequest"/> (Art. IV.5). It is a
/// thin envelope around the returned text and deliberately does <b>not</b> parse or validate that
/// text: the structured-JSON contract + validation lands in E2-03, and only validated objects ever
/// reach the domain. Keeping the completion raw here preserves that clean boundary.
/// </summary>
public sealed record AiCompletion
{
    /// <summary>
    /// The raw text returned by the model — expected to be the structured JSON the prompt asked for
    /// (Art. IV.5), but treated here as an opaque string. Validated/repaired downstream (E2-03).
    /// </summary>
    public required string Content { get; init; }
}
