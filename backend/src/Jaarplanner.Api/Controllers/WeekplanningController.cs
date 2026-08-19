using Jaarplanner.Application.Planning.Weekplanning;
using Microsoft.AspNetCore.Mvc;

namespace Jaarplanner.Api.Controllers;

/// <summary>
/// Day-level planning inside one class's jaarplan (E9-03, FR-6.2/FR-7.2): reading a stretch of days with the
/// activiteiten on them, and scheduling, moving or unscheduling one.
/// <para>
/// <b>Nested under the jaarplan route, not beside it.</b> A day-level placement has no meaning outside the plan of one
/// class in one school year, and the class is what every guard here compares against — so the class is in the path
/// rather than in a body a caller could omit.
/// </para>
/// <para>
/// <b>Thin, like every controller here</b> (Art. VIII): no status-code plumbing. <c>OngeldigeDagplanningFout</c> becomes
/// a 400 and <c>SchoolcontentNietGevondenFout</c> a 404, both through the exception handlers.
/// </para>
/// <para>
/// <b>Unauthenticated, like the other thirteen controllers</b> — filed as E7-11, not fixed here. Stated rather than left
/// implicit, because this one accepts writes that reshape a teacher's week.
/// </para>
/// </summary>
[ApiController]
[Route("api/klassen/{klasId:guid}/jaarplan/weekplanning")]
public sealed class WeekplanningController : ControllerBase
{
    private readonly IWeekplanningService _service;

    public WeekplanningController(IWeekplanningService service) => _service = service;

    /// <summary>
    /// The days between <paramref name="van"/> and <paramref name="tot"/> (both inclusive) with what is scheduled on
    /// them.
    /// <para>
    /// The range is <b>clamped to the school year</b> rather than refused, so the week containing the first or last
    /// school day is renderable. Closed days are returned with their closure named, never omitted.
    /// </para>
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<Weekplanningweergave>> Weekplanning(
        Guid klasId,
        [FromQuery] DateOnly van,
        [FromQuery] DateOnly tot,
        CancellationToken cancellationToken) =>
        Ok(await _service.HaalWeekplanningAsync(klasId, van, tot, cancellationToken));

    /// <summary>
    /// Schedules one activiteit onto one day. <b>400</b> when the day is closed or outside the school year, when the
    /// activiteit is already on that day, or when it belongs to another class; <b>404</b> when the class or the
    /// activiteit does not exist; <b>200</b> with the affected week otherwise.
    /// <para>
    /// The placement lands as <c>manueel</c> — nothing here proposes anything, so there is no status for a teacher to
    /// review (Art. IV.2).
    /// </para>
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<Weekplanningweergave>> PlanActiviteit(
        Guid klasId,
        [FromBody] Dagplanning planning,
        CancellationToken cancellationToken) =>
        Ok(await _service.PlanActiviteitAsync(
            klasId, planning.ActiviteitId, planning.Datum, planning.Volgorde, cancellationToken));

    /// <summary>
    /// Moves a scheduled activiteit to another day and/or position — the teacher dragging a card within the week view
    /// (FR-6.2), persisted immediately (FR-6.5).
    /// <para>
    /// <b>Reversible, unlike a thema move.</b> Nothing is rewritten and nothing is destroyed: there is no AI motivation
    /// to lose and no proposal to override, because every placement here is the teacher's own. So no confirmation step
    /// belongs on it — see <c>Activiteitplaatsing.VerplaatsNaar</c>.
    /// </para>
    /// </summary>
    [HttpPut("{plaatsingId:guid}/dag")]
    public async Task<ActionResult<Weekplanningweergave>> VerplaatsActiviteit(
        Guid klasId,
        Guid plaatsingId,
        [FromBody] Dagwijziging wijziging,
        CancellationToken cancellationToken) =>
        Ok(await _service.VerplaatsActiviteitAsync(
            klasId, plaatsingId, wijziging.Datum, wijziging.Volgorde, cancellationToken));

    /// <summary>
    /// Takes an activiteit off its day, whatever its status — an explicit teacher action is the one actor Art. IV.2
    /// allows to discard a human decision.
    /// <para>
    /// <b>This is the remediation two Restrict guards name</b>, and it ships in the same story as they do rather than
    /// later. The class delete guard and the activiteit delete guard both tell a teacher to clear the weekplanning
    /// first; a guard whose remedy the API does not offer is a trap, which is a mistake this codebase made once
    /// already (see <c>JaarplanController.VerwijderPlaatsing</c>).
    /// </para>
    /// <para>
    /// Returns the affected week rather than 204, matching the other endpoints so a caller never re-fetches to render.
    /// </para>
    /// </summary>
    [HttpDelete("{plaatsingId:guid}")]
    public async Task<ActionResult<Weekplanningweergave>> VerwijderActiviteitplaatsing(
        Guid klasId,
        Guid plaatsingId,
        CancellationToken cancellationToken) =>
        Ok(await _service.VerwijderActiviteitplaatsingAsync(klasId, plaatsingId, cancellationToken));
}

/// <summary>The body of a scheduling request.</summary>
/// <param name="ActiviteitId">The activiteit to schedule. Must belong to the class in the path (Art. IX.2).</param>
/// <param name="Datum">The day. Must be a teaching day inside the school year.</param>
/// <param name="Volgorde">
/// Position within the day. Defaults to 0 — "first" — because a day usually holds several activiteiten and a caller
/// that does not care about order must still get a defined one.
/// </param>
public sealed record Dagplanning(Guid ActiviteitId, DateOnly Datum, int Volgorde = 0);

/// <summary>The body of a move.</summary>
/// <param name="Datum">The target day. Must be a teaching day; the placement's current day is not validated.</param>
/// <param name="Volgorde">Position within the target day.</param>
public sealed record Dagwijziging(DateOnly Datum, int Volgorde = 0);
