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
/// as the service: <c>POST …/jaarplan/generatie</c> generates, <c>GET …/jaarplan</c> reviews, the two PUTs let the
/// teacher decide and lock, and <c>DELETE …/jaarplan/plaatsingen/{id}</c> removes a placement outright. A
/// teacher-facing screen is E3-06's job, so today this is reachable by an API client and not yet from a browser —
/// stated plainly rather than implied.
/// </para>
/// <para>
/// <b>The DELETE is listed deliberately.</b> It is the only destructive member here, it ignores status and lock by
/// design (Art. IX.3 scopes <c>vergrendeld</c> to regeneration, and Art. IV.2's "adjustable" presupposes
/// revisable), and E3-07 owns the UI confirmation that compensates. An earlier revision of this summary enumerated
/// only the two PUTs and silently omitted it — the same stale-comment drift that produced two of this story's
/// audit findings, so the enumeration is kept complete on purpose.
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
    /// Body for moving one placement to another period (E3-07): the <b>start date</b> of the target planningsblok.
    /// Never an ordinal — the ordinal is a display position that shifts when the school edits its vakanties
    /// (ADR-0020 §3), so accepting one here would reintroduce exactly the silent relocation the date key prevents.
    /// </summary>
    public sealed record BlokWijziging(DateOnly BlokStart);

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

    /// <summary>
    /// Moves a thema to another period (E3-07, FR-6.2) and persists it immediately (FR-6.5) — the endpoint behind
    /// dragging a card across the kalender, and the re-placement route for a stale placement.
    /// <para>
    /// The body carries the target block's <b>start date</b>. Exact response contract, because an earlier revision of
    /// this comment got it wrong in the direction that makes the API look stricter than it is:
    /// <list type="bullet">
    /// <item><b>400</b> — the date starts no current block (refused, never snapped to the nearest period, which is
    /// what the stale-placement ruling of 2026-07-28 forbids);</item>
    /// <item><b>400</b> — <i>another</i> placement of the same thema already sits in the target period;</item>
    /// <item><b>400</b> — the placement is <c>geweigerd</c> (reverse the rejection first, see below);</item>
    /// <item><b>200, unchanged</b> — the target is the period the placement is <i>already</i> in. A no-op, not an
    /// error: dropping a card back where it started is a normal gesture and must not cost a standing proposal its
    /// status and motivation.</item>
    /// </list>
    /// </para>
    /// <para>
    /// A successful move sets the placement to <c>manueel</c> and drops its AI motivation: the position is now the
    /// teacher's, so attributing it to the model would misreport who decided (Art. IV.3), and E4-02 already rules
    /// that overriding an AI proposal moves it to <c>manueel</c>. Side effect the teacher wants: a moved placement is
    /// no longer replaceable, so the next generation run cannot undo the move. <b>Not reversible</b> — moving it back
    /// restores the date only — so the UI discloses the consequence before the move rather than after.
    /// </para>
    /// <para>
    /// <b>A <c>geweigerd</c> placement is refused rather than converted.</b> It is the only transition here that
    /// changes <i>dekking</i>: a rejected placement teaches nothing and a manual one does (Art. V.1), so a drag that
    /// silently reversed a rejection would move a thema from "not taught" to "taught" in an inspectie-facing figure.
    /// Reversing a rejection stays an explicit teacher decision via the status PUT.
    /// </para>
    /// </summary>
    [HttpPut("plaatsingen/{plaatsingId:guid}/blok")]
    public async Task<ActionResult<JaarplanWeergave>> VerplaatsPlaatsing(
        Guid klasId,
        Guid plaatsingId,
        [FromBody] BlokWijziging wijziging,
        CancellationToken cancellationToken) =>
        Ok(await _service.VerplaatsPlaatsingAsync(klasId, plaatsingId, wijziging.BlokStart, cancellationToken));

    /// <summary>
    /// Removes a thema from a period (FR-7), whatever the placement's status or lock — an explicit teacher action is
    /// the one actor Art. IV.2 allows to discard a human decision.
    /// <para>
    /// <b>Why this ships with E3-01 rather than waiting for E3-07/E4.</b> The <c>Klas</c> delete guard added in fix
    /// round 1 refuses while any placement is a human decision. Without a way to remove one, a single accepted or
    /// rejected placement made the class permanently undeletable and the guard's own error message instructed an
    /// action the API did not offer — a guard whose remediation does not exist is a trap, not a safeguard. It is also
    /// the only way a <c>geweigerd</c> placement can ever leave a plan; before this, rejecting a thema in a period was
    /// irreversible.
    /// </para>
    /// <para>
    /// Returns the updated plan rather than 204, matching the two PUTs above so a caller never has to re-fetch to
    /// render the result.
    /// </para>
    /// </summary>
    [HttpDelete("plaatsingen/{plaatsingId:guid}")]
    public async Task<ActionResult<JaarplanWeergave>> VerwijderPlaatsing(
        Guid klasId,
        Guid plaatsingId,
        CancellationToken cancellationToken) =>
        Ok(await _service.VerwijderPlaatsingAsync(klasId, plaatsingId, cancellationToken));
}
