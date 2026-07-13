namespace Jaarplanner.Application.Ai;

/// <summary>
/// A single, transport-agnostic request to the AI model (Art. IV, Art. VIII). It carries only the
/// two grounded prompt parts and no provider details, so the same request type serves both the
/// goal-matching (FR-4) and the plan-generation (FR-5) flows without leaking Azure specifics into
/// the Application layer — the seam an <see cref="IAiClient"/> speaks.
/// <para>
/// The prompt itself is built downstream (E2-02) exclusively from the school's own thema's/
/// activiteiten and the loaded Op.stap goals — never external sources (Art. IV.4). This record is
/// only the envelope that carries that grounded prompt to whatever client is wired.
/// </para>
/// </summary>
public sealed record AiRequest
{
    /// <summary>
    /// The system prompt: the role/instructions that frame the model (e.g. "match Op.stap
    /// leerplandoelen to school thema's and answer only with structured JSON"). Built in E2-02.
    /// </summary>
    public required string SystemPrompt { get; init; }

    /// <summary>
    /// The user prompt: the grounded payload (the relevant leerplandoelen + the thema's
    /// themadoelen/subthema's/activiteiten). Contains only school + Op.stap data (Art. IV.4).
    /// Built in E2-02.
    /// </summary>
    public required string UserPrompt { get; init; }
}
