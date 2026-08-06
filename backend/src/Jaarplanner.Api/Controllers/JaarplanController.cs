using Jaarplanner.Application.Dekking;
using Jaarplanner.Application.Planning.Generatie;
using Jaarplanner.Domain.Schoolcontent;
using Microsoft.AspNetCore.Mvc;

namespace Jaarplanner.Api.Controllers;

/// <summary>
/// Thin REST controller (Art. VIII) for a class's <c>Jaarplan</c> (E3-01, FR-5.1). All logic lives in
/// <see cref="JaarplanGeneratieService"/>; the controller binds, delegates and returns.
/// <para>
/// <b>One action composes two services, and it is the only one</b>: <c>POST …/generatie</c> asks
/// <see cref="DekkingService"/> for the run's dekkingsvooruitzicht (E3-03, FR-5.3) and attaches it to the result. No
/// rule is applied here — the coverage rules stay in the service that owns them, and the composition sits at this
/// layer because that service reads the plan through <c>IJaarplanLezer</c>, which the generation service implements.
/// See <c>JaarplanGeneratieResultaat.Vooruitzicht</c>.
/// </para>
/// <para>
/// <b>This is the story's invocation surface, and it is the point.</b> Three consecutive audits on this project
/// found "done" features nobody could reach — the E2 matching service is still called from nothing but its own
/// unit tests, which is why M2 was withdrawn. Plan generation therefore ships with the trigger in the same change
/// as the service: <c>POST …/jaarplan/generatie</c> generates, <c>GET …/jaarplan</c> reviews,
/// <c>GET …/jaarplan/parameters</c> reads the class's kept pre-generation settings,
/// <c>POST …/jaarplan/plaatsingen</c> places a thema by hand, the three PUTs let the teacher decide, lock and move,
/// and <c>DELETE …/jaarplan/plaatsingen/{id}</c> removes a placement outright. The kalender (E3-06/E3-07/E4-03)
/// reaches all of them from a browser.
/// </para>
/// <para>
/// <b>The DELETE is listed deliberately.</b> It is the only destructive member here, it ignores status and lock by
/// design (Art. IX.3 scopes <c>vergrendeld</c> to regeneration, and Art. IV.2's "adjustable" presupposes
/// revisable), and E3-07 owns the UI confirmation that compensates. An earlier revision of this summary enumerated
/// only the two PUTs and silently omitted it — the same stale-comment drift that produced two of this story's
/// audit findings, so the enumeration is kept complete on purpose.
/// </para>
/// <para>
/// <b>Nothing the AI proposes auto-applies</b> (Art. IV.1/IV.2): generation persists placements as <c>voorgesteld</c>
/// with a motivation, and nothing but an explicit teacher action moves one to aanvaard/geweigerd/manueel. A generation
/// run whose AI response is invalid changes nothing and reports 422 with the diagnostic (Art. IV.5).
/// <br/>
/// Read that as a constraint on <i>AI output</i>, not as "every placement starts as a proposal": the status PUT is no
/// longer the only route to <c>manueel</c>, since a move (E3-07) and a hand-placement (E4-03) are both teacher
/// decisions and are recorded as such at once. An earlier revision of this paragraph said "only the explicit status
/// PUT", which the POST below falsified the moment it landed.
/// </para>
/// </summary>
[ApiController]
[Route("api/klassen/{klasId:guid}/jaarplan")]
public sealed class JaarplanController : ControllerBase
{
    private readonly JaarplanGeneratieService _service;
    private readonly DekkingService _dekking;

    public JaarplanController(JaarplanGeneratieService service, DekkingService dekking)
    {
        _service = service;
        _dekking = dekking;
    }

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
    /// Body for placing a thema in a period by hand (E4-03): which thema, and the <b>start date</b> of the period.
    /// A date rather than an ordinal for the reason given on <see cref="BlokWijziging"/>, and no status field: a
    /// hand-placement is <c>manueel</c> by definition, so letting a client name its own status would let it claim the
    /// AI proposed something (Art. IV.3).
    /// </summary>
    public sealed record HandmatigePlaatsing(Guid ThemaId, DateOnly BlokStart);

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
    /// <param name="klasId">The class to generate for.</param>
    /// <param name="parameters">
    /// Optional pre-generation parameters (FR-5.4, E3-04): gewenste startthema's and vaste momenten. Vakanties are
    /// deliberately not accepted: they are schooljaar data and the derived grid already honours them.
    /// <para>
    /// <b>A body <i>replaces</i> the class's kept settings; no body <i>uses</i> them</b> (owner ruling, 2026-07-30, and
    /// see <c>GET …/jaarplan/parameters</c>). So a plain POST is no longer "generate as if no parameters existed": it is
    /// "generate with the settings this class last saved", which is what makes an FR-8/E4 regeneration keep a blocked
    /// period blocked. For a class that has never saved any, it is byte-for-byte the run it always was. An explicitly
    /// empty body clears the settings, which is the only way to clear them, since the settings are saved as part of this
    /// call and there is deliberately no separate "Bewaren" control.
    /// </para>
    /// <para>
    /// The settings are committed <b>before</b> the model is called, so a failed generation does not cost the teacher
    /// the input they just typed. A malformed body is a 400 and stores nothing.
    /// </para>
    /// </param>
    /// <param name="jaarFase">
    /// The kleuterjaar the teacher has narrowed the screen to (owner ruling 2026-08-04), passed through to the
    /// dekkingsvooruitzicht only. It changes <b>nothing</b> about the generation itself: the run is over the whole
    /// class either way, and this is purely which leerplandoelen the reported figures are measured against, so that
    /// they match the live dekking line the same screen shows. Ignored when it is not one of this class's codes.
    /// </param>
    /// <param name="cancellationToken">Cancels an in-flight call.</param>
    [HttpPost("generatie")]
    public async Task<ActionResult<JaarplanGeneratieResultaat>> Genereer(
        Guid klasId,
        [FromBody] JaarplanGeneratieParameters? parameters,
        CancellationToken cancellationToken,
        [FromQuery] string? jaarFase = null)
    {
        var resultaat = await _service.GenereerAsync(klasId, parameters, cancellationToken);

        if (!resultaat.IsGeslaagd)
        {
            return UnprocessableEntity(new ProblemDetails
            {
                Status = StatusCodes.Status422UnprocessableEntity,
                Title = "Invalid AI response",
                Detail = resultaat.Fout,
            });
        }

        // FR-5.3's measured half (E3-03), composed here rather than inside the generation service because the coverage
        // rules have exactly one owner and that owner reads the plan through IJaarplanLezer, which the generation
        // service itself implements: a generator that depended on it would close the loop. See
        // JaarplanGeneratieResultaat.Vooruitzicht.
        //
        // It runs only on success, and only after the run has persisted, so it measures the plan the teacher is about
        // to be shown. A failed run leaves it null: nothing was persisted, so there is no new plan to look ahead over.
        //
        // `jaarFase` is the kalender's own kleuterjaar choice, passed through so this figure and the live dekking line
        // on the SAME SCREEN are over the same denominator (antagonist round 1: the chooser is on the kalender, not on
        // /dekking as an earlier comment claimed). Ignored by the service when it is not one of the class's codes,
        // exactly as GET …/dekking ignores it, so a stale link can never break a generation run.
        var vooruitzicht = await _dekking.BerekenVooruitzichtAsync(
            klasId, jaarFase: jaarFase, cancellationToken: cancellationToken);

        return Ok(resultaat with { Vooruitzicht = vooruitzicht });
    }

    /// <summary>
    /// The class's <b>kept</b> pre-generation settings (E3-04, FR-5.4) — what the form loads so a teacher sees the
    /// settings they last used instead of starting empty every time (owner ruling, 2026-07-30).
    /// <para>
    /// A class with nothing kept answers <c>200</c> with empty lists, never a 404: "no settings" is the normal state
    /// before the first parameterised run, and a 404 would make a form treat it as a failure.
    /// </para>
    /// <para>
    /// <b>There is no PUT beside this GET, deliberately.</b> The settings are saved as part of
    /// <c>POST …/jaarplan/generatie</c>, so the flow is: open the form, see the last settings, adjust, generate. A
    /// separate "Bewaren" button would be a second control for one intention, and would let the saved settings and the
    /// generated plan disagree about what was asked for.
    /// </para>
    /// <para>
    /// <b>A kept start thema whose period no longer exists is returned as stored.</b> The response is not filtered
    /// against the current grid: the caller compares it with the derived blocks and says so, because silently dropping
    /// a stranded setting is what the stale-placement ruling of 2026-07-28 forbids one layer up. A run reports the same
    /// fact as <c>ParameterRapport.VervallenStartthemas</c>.
    /// </para>
    /// </summary>
    [HttpGet("parameters")]
    public async Task<ActionResult<JaarplanGeneratieParameters>> Parameters(
        Guid klasId,
        CancellationToken cancellationToken) =>
        Ok(await _service.HaalParametersAsync(klasId, cancellationToken));

    /// <summary>
    /// Places a thema in a period <b>by hand, without the AI</b> (E4-03, FR-7.2) and persists it immediately (FR-7).
    /// <para>
    /// <b>The only endpoint here that works on a class with no plan yet</b>, and the one that makes a fully hand-built
    /// year possible: before it, a thema could enter a jaarplan only through a generation run, so "manual editing,
    /// independent of the AI" meant editing something the AI had produced first. The plan is created on the first
    /// hand-placement, exactly as generation creates it on the first run.
    /// </para>
    /// <para>
    /// Response contract: <b>400</b> when the period starts no block of the current grid (refused, never snapped) or
    /// when that thema is already in that period; <b>404</b> when the class or the thema does not exist; <b>200</b>
    /// with the updated plan otherwise. The placement lands as <c>manueel</c>, so it counts for dekking (Art. V.1) and
    /// survives regeneration (Art. IX.3).
    /// </para>
    /// </summary>
    [HttpPost("plaatsingen")]
    public async Task<ActionResult<JaarplanWeergave>> VoegPlaatsingToe(
        Guid klasId,
        [FromBody] HandmatigePlaatsing plaatsing,
        CancellationToken cancellationToken) =>
        Ok(await _service.VoegPlaatsingToeAsync(
            klasId, plaatsing.ThemaId, plaatsing.BlokStart, cancellationToken));

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
