using Jaarplanner.Domain.Curriculum;

namespace Jaarplanner.Application.AiMatching;

/// <summary>
/// A read view of one persisted AI goal-match suggestion (E2-04, FR-4.1/4.2): a thema-level
/// <c>DoelKoppeling</c> the AI proposed with <see cref="Status"/> <c>voorgesteld</c> and its short
/// <see cref="AiMotivatie"/> ("waarom past dit doel hier?", Art. IV.3). It is the shape the query
/// path returns "per thema"; the teacher reviews and decides in E2-05 (Art. IV.1/IV.2).
/// <para>
/// <b><see cref="Tekst"/> and <see cref="Doelsoort"/> were added by E2-08</b> because FR-4.2's purpose
/// clause is <i>"zodat de leerkracht ze kan beoordelen"</i>, and a bare code plus one AI sentence is not
/// something a non-technical teacher can judge. They are copies of read-only Op.stap content, resolved
/// per read and never persisted on the link — the curriculum stays the single source (Art. III.1). Both
/// are nullable: a link whose code cannot be resolved in the currently loaded set must still be shown
/// honestly rather than hidden.
/// </para>
/// </summary>
/// <param name="Id">The link's surrogate id.</param>
/// <param name="LeerplandoelCode">The suggested (read-only) leerplandoel's stable code (Art. III.5).</param>
/// <param name="Status">The human-in-the-loop status — always <c>voorgesteld</c> for a fresh suggestion (Art. IV.2).</param>
/// <param name="AiMotivatie">The AI's one-line motivation for the match (Art. IV.3).</param>
/// <param name="Tekst">The leerplandoel's official text, so the teacher judges the goal itself (FR-4.2); null when unresolvable.</param>
/// <param name="Doelsoort">The leerplandoel's goal type (serialised by name), for the badge; null when unresolvable.</param>
public sealed record DoelMatchSuggestieWeergave(
    Guid Id,
    string LeerplandoelCode,
    string Status,
    string? AiMotivatie,
    string? Tekst = null,
    Doelsoort? Doelsoort = null);
