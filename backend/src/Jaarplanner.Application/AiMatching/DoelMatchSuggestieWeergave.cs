namespace Jaarplanner.Application.AiMatching;

/// <summary>
/// A read view of one persisted AI goal-match suggestion (E2-04, FR-4.1/4.2): a thema-level
/// <c>DoelKoppeling</c> the AI proposed with <see cref="Status"/> <c>voorgesteld</c> and its short
/// <see cref="AiMotivatie"/> ("waarom past dit doel hier?", Art. IV.3). It is the shape the query
/// path returns "per thema"; the teacher reviews and decides in E2-05 (Art. IV.1/IV.2).
/// </summary>
/// <param name="Id">The link's surrogate id.</param>
/// <param name="LeerplandoelCode">The suggested (read-only) leerplandoel's stable code (Art. III.5).</param>
/// <param name="Status">The human-in-the-loop status — always <c>voorgesteld</c> for a fresh suggestion (Art. IV.2).</param>
/// <param name="AiMotivatie">The AI's one-line motivation for the match (Art. IV.3).</param>
public sealed record DoelMatchSuggestieWeergave(
    Guid Id,
    string LeerplandoelCode,
    string Status,
    string? AiMotivatie);
