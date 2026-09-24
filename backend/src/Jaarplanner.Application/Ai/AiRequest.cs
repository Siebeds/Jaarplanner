namespace Jaarplanner.Application.Ai;

/// <summary>
/// A single, transport-agnostic request to the AI model (Art. IV, Art. VIII). It carries only the grounded prompt parts
/// and no provider details, so the same request type serves every AI flow without leaking a provider's specifics into
/// the Application layer: the seam an <see cref="IAiClient"/> speaks.
/// <para>
/// <b>Three parts, in this order</b> (TB-043): <see cref="SystemPrompt"/>, then <see cref="VasteContext"/>, then
/// <see cref="UserPrompt"/>, with the earlier turns of a conversation (<see cref="Gesprek"/>, the cat's chat only) between
/// the last two. The first two are the stable prefix, identical across requests of the same kind, which a
/// provider can serve from its prompt cache; everything that differs per request, the school's own content above all,
/// goes in the last. A cache only matches an identical beginning, so a builder that puts anything volatile in the first
/// two parts silently makes every request pay the full price.
/// </para>
/// <para>
/// The prompt itself is built by each caller's prompt builder, grounded on what Art. IV.4 allows that flow. This record
/// is only the envelope that carries it to whatever client is wired.
/// </para>
/// </summary>
public sealed record AiRequest
{
    /// <summary>
    /// The system prompt: the role and instructions that frame the model (e.g. "match Op.stap leerplandoelen to school
    /// thema's and answer only with structured JSON"). Fixed text per kind of request.
    /// </summary>
    public required string SystemPrompt { get; init; }

    /// <summary>
    /// The stable part of the prompt (e.g. the candidate goal list), identical across requests of the same kind, sent
    /// after the <see cref="SystemPrompt"/> and before the <see cref="UserPrompt"/>, and cached where the provider
    /// supports it; empty means none. Never put anything here that differs per thema, per klas or per person: the codes a
    /// thema already links, for instance, belong in the <see cref="UserPrompt"/>.
    /// </summary>
    public string VasteContext { get; init; } = string.Empty;

    /// <summary>
    /// The user prompt: the volatile, grounded payload (the thema's themadoelen, subthema's and activiteiten, and which
    /// goals not to propose). Contains only what Art. IV.4 allows the flow.
    /// </summary>
    public required string UserPrompt { get; init; }

    /// <summary>
    /// The earlier turns of a conversation, oldest first, sent as alternating user and assistant messages after the
    /// stable prefix and before the <see cref="UserPrompt"/> (FB-093, ADR-0069). Empty for every flow but the cat's chat:
    /// a model remembers nothing, so a conversation is its turns sent again with each question.
    /// </summary>
    public IReadOnlyList<AiBeurt> Gesprek { get; init; } = [];
}

/// <summary>One earlier turn of a conversation: what the user asked, and what the assistant answered.</summary>
public sealed record AiBeurt(string Vraag, string Antwoord);
