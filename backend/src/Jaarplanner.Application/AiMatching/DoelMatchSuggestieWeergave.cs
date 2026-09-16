namespace Jaarplanner.Application.AiMatching;

/// <summary>
/// A read view of one stored doelsuggestie of a thema (FB-053, FR-4.2): the AI's proposal of a minimumdoel as a
/// themadoel, with its <see cref="Status"/> and one-sentence <see cref="AiMotivatie"/> (Art. IV.3).
/// <para>
/// <see cref="Omschrijving"/> and <see cref="Mijlpaal"/> are copies of the read-only minimumdoel, resolved per read and
/// never stored on the proposal (Art. III.1), so the person judges the goal itself and not a bare ref. Both are null
/// when the ref no longer resolves; the row is then still shown.
/// </para>
/// </summary>
/// <param name="Id">The proposal's surrogate id.</param>
/// <param name="MinimumdoelRef">The proposed minimumdoel's stable ref (Art. III.5).</param>
/// <param name="Status"><c>Voorgesteld</c>, <c>Aanvaard</c> or <c>Geweigerd</c> (Art. IV.2).</param>
/// <param name="AiMotivatie">The AI's one-sentence motivation (Art. IV.3).</param>
/// <param name="Omschrijving">The minimumdoel's decreed text; null when unresolvable.</param>
/// <param name="Mijlpaal">The minimumdoel's mijlpaal (<c>K-</c>, <c>4-</c>, <c>6-</c>); null when unresolvable.</param>
public sealed record DoelMatchSuggestieWeergave(
    Guid Id,
    string MinimumdoelRef,
    string Status,
    string AiMotivatie,
    string? Omschrijving = null,
    string? Mijlpaal = null);
