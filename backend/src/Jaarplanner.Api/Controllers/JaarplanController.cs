using Jaarplanner.Application.Planning.Generatie;
using Jaarplanner.Domain.Schoolcontent;
using Microsoft.AspNetCore.Mvc;

namespace Jaarplanner.Api.Controllers;

/// <summary>
/// Thin REST controller (Art. VIII) for a class's <c>Jaarplan</c> (E3-01, FR-5.1). All logic lives in
/// <see cref="JaarplanGeneratieService"/>; the controller only binds, delegates and returns.
/// <para>
/// <b>This is the story's invocation surface, and it is the point.</b> Three consecutive audits on this project
/// found "done" features nobody could reach — the E2 matching service is still called from nothing but its own
/// unit tests, which is why M2 was withdrawn. Plan generation therefore ships with the trigger in the same change
/// as the service: <c>POST …/jaarplan/generatie</c> generates, <c>GET …/jaarplan</c> reviews, and the two PUTs let
/// the teacher decide and lock. A teacher-facing screen is E3-06's job, so today this is reachable by an API
/// client and not yet from a browser — stated plainly rather than implied.
/// </para>
/// <para>
/// <b>Nothing here auto-applies</b> (Art. IV.1/IV.2): generation persists placements as <c>voorgesteld</c> with a
/// motivation, and only the explicit status PUT moves one to aanvaard/geweigerd/manueel. A generation run whose AI
/// response is invalid changes nothing and reports 422 with the diagnostic (Art. IV.5).
/// </para>
/// </summary>
[ApiController]
[Route("api/klassen/{klasId:guid}/jaarplan")]
public sealed class JaarplanController : ControllerBase
{
    private readonly JaarplanGeneratieService _service;

    public JaarplanController(JaarplanGeneratieService service) => _service = service;

    /// <summary>Body for a teacher decision on one placement: the new status (aanvaard / geweigerd / manueel).</summary>
    public sealed record StatusWijziging(KoppelingStatus Status);

    /// <summary>Body for locking/unlocking one placement against (re)generation (Art. IX.3).</summary>
    public sealed record VergrendelingWijziging(bool Vergrendeld);

    /// <summary>
    /// The class's current jaarplan proposal (FR-5.1, Art. IV.2): every placement with its planningsblok, status,
    /// motivation and lock. A class that has not been generated for yet yields an empty plan, not a 404.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<JaarplanWeergave>> Detail(Guid klasId, CancellationToken cancellationToken) =>
        Ok(await _service.HaalJaarplanAsync(klasId, cancellationToken));

    /// <summary>
    /// Generates a plan proposal for the class (FR-5.1) and returns it. Placements land as <c>voorgesteld</c> with
    /// an AI motivation — advisory, never applied (Art. IV.1/IV.2). Locked and already-decided placements survive
    /// the run (Art. IX.3).
    /// <para>
    /// An invalid AI response yields <b>422 Unprocessable Entity</b> with the diagnostic and <b>no</b> change to
    /// the plan (Art. IV.5). 422 rather than 500 because nothing is broken — the model answered badly, and the
    /// caller can simply retry.
    /// </para>
    /// <para>
    /// <b>This 422 body is an operator/developer diagnostic, not teacher copy — and it is English throughout on
    /// purpose.</b> <c>Detail</c> carries the parser's diagnostic ("Malformed JSON: …", "Placement at index 2 has a
    /// missing/blank 'thema'"), which is deliberately English because it describes malformed model output that no
    /// teacher can act on. Pairing that with a Dutch <c>Title</c> made one payload bilingual for no reason, so the
    /// title is English too. The <b>teacher-facing</b> message for this case ("de AI gaf geen bruikbaar antwoord,
    /// probeer opnieuw") belongs in <c>frontend/src/i18n/nl.json</c>, keyed on the 422 status — not hard-coded here,
    /// whichever way the open Art. II.3 decision lands. Note this diverges from the Dutch <c>Title</c>s the
    /// school-content/AI-matching exception handlers use; those describe conditions a teacher <i>can</i> act on
    /// (a bad request, a missing thema), which this one is not.
    /// </para>
    /// </summary>
    [HttpPost("generatie")]
    public async Task<ActionResult<JaarplanGeneratieResultaat>> Genereer(Guid klasId, CancellationToken cancellationToken)
    {
        var resultaat = await _service.GenereerAsync(klasId, cancellationToken);

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
    /// Records the teacher's decision on one generated placement (Art. IV.1/IV.2): accept, reject or adjust
    /// (manueel). The persisted status survives a reload and a regeneration.
    /// </summary>
    [HttpPut("plaatsingen/{plaatsingId:guid}/status")]
    public async Task<ActionResult<JaarplanWeergave>> WijzigStatus(
        Guid klasId,
        Guid plaatsingId,
        [FromBody] StatusWijziging wijziging,
        CancellationToken cancellationToken) =>
        Ok(await _service.WijzigPlaatsingStatusAsync(klasId, plaatsingId, wijziging.Status, cancellationToken));

    /// <summary>
    /// Locks or unlocks a placement against (re)generation — Art. IX.3's <c>vergrendeld</c> flag, honoured by
    /// generation today and extended by E4's per-period regeneration.
    /// </summary>
    [HttpPut("plaatsingen/{plaatsingId:guid}/vergrendeling")]
    public async Task<ActionResult<JaarplanWeergave>> WijzigVergrendeling(
        Guid klasId,
        Guid plaatsingId,
        [FromBody] VergrendelingWijziging wijziging,
        CancellationToken cancellationToken) =>
        Ok(await _service.WijzigVergrendelingAsync(klasId, plaatsingId, wijziging.Vergrendeld, cancellationToken));
}
