using Jaarplanner.Application.AiMatching;
using Jaarplanner.Application.Toegang;
using Jaarplanner.Domain.Schoolcontent;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace Jaarplanner.Api.Controllers;

/// <summary>
/// Thin REST controller (Art. VIII) for a thema's doelsuggesties (FB-053, ADR-0050, FR-4.1/4.2/4.3): the AI proposes
/// minimumdoelen as themadoel, and a person accepts or rejects each. All logic lives in <see cref="DoelMatchingService"/>.
/// <para>
/// Nothing is applied by the AI: a run stores each proposal as <c>voorgesteld</c> with a motivation, and only an explicit
/// decision moves one (Art. IV.1/IV.2). Generating and deciding are directie's and themabeheer's (R14), checked here.
/// Not-found, an invalid decision and the two refusals of TB-007 surface through <c>AiMatchingExceptionHandler</c>.
/// </para>
/// </summary>
[ApiController]
[Route("api/themas/{themaId:guid}/doelsuggesties")]
public sealed class DoelsuggestiesController : ControllerBase
{
    private readonly DoelMatchingService _service;

    public DoelsuggestiesController(DoelMatchingService service) => _service = service;

    /// <summary>Body for a decision: <c>Aanvaard</c> or <c>Geweigerd</c>.</summary>
    public sealed record StatusWijziging(KoppelingStatus Status);

    /// <summary>Lists the doelsuggesties stored for a thema, open and decided, each with its minimumdoel's text (FR-4.2).</summary>
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<DoelMatchSuggestieWeergave>>> Lijst(Guid themaId, CancellationToken cancellationToken) =>
        Ok(await _service.HaalSuggestiesVoorThemaAsync(themaId, cancellationToken));

    /// <summary>
    /// Asks the model for minimumdoelen that fit the thema as themadoel (FR-4.1) and returns what it stored.
    /// <para>
    /// The body is <b>optional</b>: its <c>jaarFasen</c> say for which leeftijden, and without them the leeftijden of the
    /// thema's subthema's apply. A thema without any answers <b>400</b> (TB-007), as does a prompt over the ceiling; both
    /// carry a Dutch sentence and neither calls the model. An invalid AI answer yields <b>422</b> with an English operator
    /// diagnostic and no change to the thema (Art. IV.5); the Dutch copy for it lives in the frontend.
    /// </para>
    /// </summary>
    [HttpPost("genereer")]
    [Authorize(Policy = Rechtenmatrix.Beleid.DoelsuggestiesMaken)]
    public async Task<ActionResult<DoelMatchResultaat>> Genereer(
        Guid themaId,
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] DoelsuggestieGeneratieVerzoek? verzoek,
        CancellationToken cancellationToken)
    {
        var resultaat = await _service.GenereerSuggestiesAsync(themaId, verzoek?.JaarFasen, cancellationToken);

        return resultaat.IsGeslaagd
            ? Ok(resultaat)
            : UnprocessableEntity(new ProblemDetails
            {
                Status = StatusCodes.Status422UnprocessableEntity,
                Title = "Invalid AI response",
                Detail = resultaat.Fout,
            });
    }

    /// <summary>
    /// Records the decision on one proposal (FR-4.3): accepting makes the minimumdoel a themadoel, rejecting keeps it
    /// from being proposed again. A proposal is decided once; anything else answers 400.
    /// </summary>
    [HttpPut("{suggestieId:guid}/status")]
    [Authorize(Policy = Rechtenmatrix.Beleid.DoelsuggestiesBeoordelen)]
    public async Task<ActionResult<DoelMatchSuggestieWeergave>> WijzigStatus(
        Guid themaId,
        Guid suggestieId,
        [FromBody] StatusWijziging wijziging,
        CancellationToken cancellationToken) =>
        Ok(await _service.WijzigSuggestieStatusAsync(themaId, suggestieId, wijziging.Status, cancellationToken));
}
