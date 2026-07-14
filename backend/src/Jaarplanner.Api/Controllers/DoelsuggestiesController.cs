using Jaarplanner.Application.AiMatching;
using Jaarplanner.Domain.Schoolcontent;
using Microsoft.AspNetCore.Mvc;

namespace Jaarplanner.Api.Controllers;

/// <summary>
/// Thin REST controller (Art. VIII) for reviewing a thema's AI goal-match suggestions (E2-05, FR-4.3).
/// It exposes the read query "suggesties per thema" and lets the teacher record a decision — accept /
/// reject / adjust — on a single suggestion. All logic lives in <see cref="DoelMatchingService"/>; the
/// controller only binds, delegates and returns. The AI never auto-applies: every status change here is
/// an explicit teacher action (Art. IV.1/IV.2), and the persisted status is what E5 coverage reads.
/// Not-found / invalid-status surface via <c>AiMatchingExceptionHandler</c> (Program.cs).
/// </summary>
[ApiController]
[Route("api/themas/{themaId:guid}/doelsuggesties")]
public sealed class DoelsuggestiesController : ControllerBase
{
    private readonly DoelMatchingService _service;

    public DoelsuggestiesController(DoelMatchingService service) => _service = service;

    /// <summary>Body for a teacher decision: the new status (aanvaard / geweigerd / manueel).</summary>
    public sealed record StatusWijziging(KoppelingStatus Status);

    /// <summary>Lists the AI doelsuggesties persisted for a thema, each with its code, status and motivation (FR-4.3).</summary>
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<DoelMatchSuggestieWeergave>>> Lijst(Guid themaId, CancellationToken cancellationToken) =>
        Ok(await _service.HaalSuggestiesVoorThemaAsync(themaId, cancellationToken));

    /// <summary>
    /// Records the teacher's decision on one suggestion (E2-05, FR-4.3): accept, reject or adjust
    /// (manueel). The change persists and drives coverage (E5). No auto-apply (Art. IV.1/IV.2).
    /// </summary>
    [HttpPut("{suggestieId:guid}/status")]
    public async Task<ActionResult<DoelMatchSuggestieWeergave>> WijzigStatus(
        Guid themaId,
        Guid suggestieId,
        [FromBody] StatusWijziging wijziging,
        CancellationToken cancellationToken) =>
        Ok(await _service.WijzigSuggestieStatusAsync(themaId, suggestieId, wijziging.Status, cancellationToken));
}
