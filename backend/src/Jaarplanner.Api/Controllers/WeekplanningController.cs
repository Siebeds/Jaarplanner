using Jaarplanner.Api.Infrastructure.Authenticatie;
using Jaarplanner.Api.Infrastructure.Autorisatie;
using Jaarplanner.Application.Planning.Weekplanning;
using Jaarplanner.Application.Planning.Weekvoorstel;
using Jaarplanner.Application.Toegang;
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
/// <b>Rights (E6-02 slice 3):</b> every write is the klas's planning, <c>KlasplanningBewerken</c> (admin and the
/// klas's own leerkrachten; ADR-0030 R7, R15, I21), against the klas in the route. The service finds a plaatsing only
/// inside that klas's plan, so a route cannot reach another klas's week. The read is <c>KlasplanningBekijken</c> (FB-013).
/// <i>Until slice 3 this paragraph said the controller was unauthenticated, like the other thirteen; E6-01 gave every
/// route a session and this story gave its writes a row.</i>
/// </para>
/// </summary>
[ApiController]
[Route("api/klassen/{klasId:guid}/jaarplan/weekplanning")]
public sealed class WeekplanningController : ControllerBase
{
    private readonly IWeekplanningService _service;
    private readonly IWeekvoorstelService _weekvoorstel;
    private readonly IRechtenService _rechten;

    public WeekplanningController(IWeekplanningService service, IWeekvoorstelService weekvoorstel, IRechtenService rechten)
    {
        _service = service;
        _weekvoorstel = weekvoorstel;
        _rechten = rechten;
    }

    /// <summary>
    /// The days between <paramref name="van"/> and <paramref name="tot"/> (both inclusive) with what is scheduled on
    /// them.
    /// <para>
    /// The range is <b>clamped to the school year</b> rather than refused, so the week containing the first or last
    /// school day is renderable. Closed days are returned with their closure named, never omitted.
    /// </para>
    /// </summary>
    [HttpGet]
    [RechtOp(Rechtenmatrix.Beleid.KlasplanningBekijken, Rechtbron.Klasinzage, "klasId")]
    public async Task<ActionResult<Weekplanningweergave>> Weekplanning(
        Guid klasId,
        [FromQuery] DateOnly van,
        [FromQuery] DateOnly tot,
        CancellationToken cancellationToken) =>
        Ok(await _service.HaalWeekplanningAsync(klasId, van, tot, cancellationToken));

    /// <summary>
    /// Every activiteit this klas has planned, with the days it stands on, over the whole school year (FB-076).
    /// <para>
    /// <b>Its own route rather than a field on the week</b>, for the reason <c>AlgemeneFicheplaatsingenController</c>
    /// gives: the panel fetches this beside the days it is showing, and it is not scoped to them. Nested under
    /// <c>weekplanning</c> anyway, because these are the placements that route creates and deletes.
    /// </para>
    /// </summary>
    // ABSOLUTE ROUTE, like the subthemaperiodes window below: relative to this controller's own mount it would read as
    // a range's placements, which is exactly what it is not.
    [HttpGet("/api/klassen/{klasId:guid}/jaarplan/activiteitplaatsingen")]
    [RechtOp(Rechtenmatrix.Beleid.KlasplanningBekijken, Rechtbron.Klasinzage, "klasId")]
    public async Task<ActionResult<Activiteitplaatsingenweergave>> Activiteitplaatsingen(
        Guid klasId,
        CancellationToken cancellationToken) =>
        Ok(await _service.HaalActiviteitplaatsingenAsync(klasId, cancellationToken));

    /// <summary>
    /// Schedules one activiteit onto one day at a time. <b>400</b> when the day is closed or outside the school year,
    /// when the end is not after the start, when the activiteit already starts at that time that day, or when it is
    /// for an age the class does not teach; <b>404</b> when the class or the activiteit does not exist; <b>200</b>
    /// with the affected week otherwise.
    /// <para>
    /// The placement lands as <c>manueel</c> — nothing here proposes anything, so there is no status for a teacher to
    /// review (Art. IV.2).
    /// </para>
    /// <para>
    /// Someone else's own activiteit is a 400 unless the caller holds admin (ADR-0049 D6), so the planner's rights go
    /// along.
    /// </para>
    /// </summary>
    [HttpPost]
    [RechtOp(Rechtenmatrix.Beleid.KlasplanningBewerken, Rechtbron.Klas, "klasId")]
    public async Task<ActionResult<Weekplanningweergave>> PlanActiviteit(
        Guid klasId,
        [FromBody] Dagplanning planning,
        CancellationToken cancellationToken)
    {
        var planner = Aanmelding.GebruikerId(User) is { } id ? await _rechten.HaalRechtenOpAsync(id, cancellationToken) : null;
        return Ok(await _service.PlanActiviteitAsync(
            klasId, planning.ActiviteitId, planning.Datum, planning.Begin, planning.Einde, planner, cancellationToken));
    }

    /// <summary>
    /// Marks off a stretch of days for a subthema, or moves the stretch it already had (owner ruling, 2026-08-25).
    /// <b>400</b> when the subthema belongs to another class or the dates run backwards, <b>404</b> when it does not
    /// exist, <b>200</b> with the affected range otherwise.
    /// <para>
    /// <b>What this is for.</b> A subthema's band used to be derived purely from the days its activiteiten sat on, so
    /// a teacher who marked off five days and had one activiteit ready saw a one-day band. Activiteiten are added
    /// later, which is the ordinary order of work, so the window has to be able to exist before its content does.
    /// </para>
    /// <para>
    /// Taken out again by <see cref="HaalSubthemaWeg"/> (FB-096), which the agenda's subthema bar calls.
    /// </para>
    /// </summary>
    // ABSOLUTE ROUTE, deliberately. This controller is mounted on `.../jaarplan/weekplanning`, and relative to that
    // the window would live at `.../jaarplan/weekplanning/subthemaperiodes`, which says a subthema period is part of
    // one week's planning. It is not: it is a range on the plan, and it commonly outlives and outspans the week a
    // teacher happens to be looking at. The code stays here because it shares the service and the returned view;
    // only the URL is corrected. The first version of this used the relative form and the frontend called the
    // absolute one, so the endpoint existed and nothing reached it — a 404 the browser pass caught and no test would
    // have, which is the reachable-vs-tested gap this repo has recorded five times.
    [HttpPost("~/api/klassen/{klasId:guid}/jaarplan/subthemaperiodes")]
    [RechtOp(Rechtenmatrix.Beleid.KlasplanningBewerken, Rechtbron.Klas, "klasId")]
    public async Task<ActionResult<Weekplanningweergave>> PlaatsSubthema(
        Guid klasId,
        [FromBody] Subthemaperiode periode,
        CancellationToken cancellationToken) =>
        Ok(await _service.PlaatsSubthemaAsync(
            klasId, periode.SubthemaId, periode.Van, periode.Tot, cancellationToken));

    /// <summary>
    /// What taking a subthema out of the agenda from <c>van</c> to <c>tot</c> would take with it, for the confirmation
    /// that comes first (FB-096). Changes nothing. <b>404</b> when nothing of the subthema is on those days.
    /// <para>
    /// The planning's write right rather than its read right: only whoever may take it out is ever asked this.
    /// </para>
    /// </summary>
    [HttpGet("~/api/klassen/{klasId:guid}/jaarplan/subthemaperiodes/weghaling")]
    [RechtOp(Rechtenmatrix.Beleid.KlasplanningBewerken, Rechtbron.Klas, "klasId")]
    public async Task<ActionResult<Subthemaweghaling>> BekijkSubthemaWeghaling(
        Guid klasId,
        [FromQuery] Guid subthemaId,
        [FromQuery] DateOnly van,
        [FromQuery] DateOnly tot,
        CancellationToken cancellationToken) =>
        Ok(await _service.BekijkSubthemaWeghalingAsync(klasId, subthemaId, van, tot, cancellationToken));

    /// <summary>
    /// Takes a subthema out of the agenda from <c>van</c> to <c>tot</c> (FB-096): its windows there and its
    /// activiteiten on those days, together, and nothing that belongs to anything else. <b>404</b> when nothing of the
    /// subthema is on those days; <b>200</b> with the affected range otherwise.
    /// </summary>
    [HttpDelete("~/api/klassen/{klasId:guid}/jaarplan/subthemaperiodes")]
    [RechtOp(Rechtenmatrix.Beleid.KlasplanningBewerken, Rechtbron.Klas, "klasId")]
    public async Task<ActionResult<Weekplanningweergave>> HaalSubthemaWeg(
        Guid klasId,
        [FromQuery] Guid subthemaId,
        [FromQuery] DateOnly van,
        [FromQuery] DateOnly tot,
        CancellationToken cancellationToken) =>
        Ok(await _service.HaalSubthemaWegAsync(klasId, subthemaId, van, tot, cancellationToken));

    /// <summary>
    /// Moves a scheduled activiteit to another day and/or time — the teacher dragging a block in the time grid, or its
    /// bottom edge to make it longer (FR-6.2), persisted immediately (FR-6.5).
    /// <para>
    /// <b>Reversible for a decided block</b>: nothing is rewritten and nothing is destroyed, so no confirmation step
    /// belongs on it (see <c>Activiteitplaatsing.VerplaatsNaar</c>). An open proposal of a weekvoorstel she moves becomes
    /// hers (ADR-0067 W4), which is why the planner's rights go along: a colleague's own activiteit is not hers to decide.
    /// </para>
    /// </summary>
    [HttpPut("{plaatsingId:guid}/dag")]
    [RechtOp(Rechtenmatrix.Beleid.KlasplanningBewerken, Rechtbron.Klas, "klasId")]
    public async Task<ActionResult<Weekplanningweergave>> VerplaatsActiviteit(
        Guid klasId,
        Guid plaatsingId,
        [FromBody] Dagwijziging wijziging,
        CancellationToken cancellationToken)
    {
        // The planner's rights go along: moving an open proposal of a weekvoorstel decides it (ADR-0067 W4, W6).
        var planner = Aanmelding.GebruikerId(User) is { } id ? await _rechten.HaalRechtenOpAsync(id, cancellationToken) : null;
        return Ok(await _service.VerplaatsActiviteitAsync(
            klasId, plaatsingId, wijziging.Datum, wijziging.Begin, wijziging.Einde, planner, cancellationToken));
    }

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
    [RechtOp(Rechtenmatrix.Beleid.KlasplanningBewerken, Rechtbron.Klas, "klasId")]
    public async Task<ActionResult<Weekplanningweergave>> VerwijderActiviteitplaatsing(
        Guid klasId,
        Guid plaatsingId,
        CancellationToken cancellationToken) =>
        Ok(await _service.VerwijderActiviteitplaatsingAsync(klasId, plaatsingId, cancellationToken));

    /// <summary>
    /// Asks the AI to propose the week that holds <c>datum</c> (FB-027, ADR-0067): it picks from the activiteiten of the
    /// subthema's running then, and the tool fits them into the free time as open proposals. <b>400</b> with a Dutch
    /// sentence when there is nothing to ask; <b>422</b> with an English diagnostic and no change when the model's
    /// answer is not the JSON asked for (Art. IV.5).
    /// </summary>
    [HttpPost("~/api/klassen/{klasId:guid}/jaarplan/weekvoorstel")]
    [RechtOp(Rechtenmatrix.Beleid.KlasplanningBewerken, Rechtbron.Klas, "klasId")]
    public async Task<ActionResult<WeekvoorstelResultaat>> StelWeekVoor(
        Guid klasId,
        [FromBody] Weekvraag vraag,
        CancellationToken cancellationToken)
    {
        if (Aanmelding.GebruikerId(User) is not { } id)
        {
            return Forbid();
        }

        var vrager = await _rechten.HaalRechtenOpAsync(id, cancellationToken);
        var resultaat = await _weekvoorstel.StelVoorAsync(klasId, vraag.Datum, vrager, cancellationToken);
        return resultaat.IsGeldig
            ? Ok(resultaat)
            : UnprocessableEntity(new ProblemDetails
            {
                Status = StatusCodes.Status422UnprocessableEntity,
                Title = "Invalid AI response",
                Detail = resultaat.Fout,
            });
    }

    /// <summary>
    /// Accepts or rejects one open proposal (FB-027, ADR-0067 W4). <b>400</b> when it is no open proposal any more, or
    /// when accepting a colleague's own activiteit without admin (W6).
    /// </summary>
    [HttpPut("{plaatsingId:guid}/beslissing")]
    [RechtOp(Rechtenmatrix.Beleid.KlasplanningBewerken, Rechtbron.Klas, "klasId")]
    public async Task<ActionResult<Weekplanningweergave>> BeslisVoorstel(
        Guid klasId,
        Guid plaatsingId,
        [FromBody] Voorstelbeslissing beslissing,
        CancellationToken cancellationToken)
    {
        var beslisser = Aanmelding.GebruikerId(User) is { } id ? await _rechten.HaalRechtenOpAsync(id, cancellationToken) : null;
        return Ok(await _service.BeslisVoorstelAsync(klasId, plaatsingId, beslissing.Aanvaard, beslisser, cancellationToken));
    }

    /// <summary>Accepts every open proposal from <c>van</c> to <c>tot</c> the caller may accept (FB-027 "allemaal").</summary>
    [HttpPost("~/api/klassen/{klasId:guid}/jaarplan/weekvoorstel/aanvaard")]
    [RechtOp(Rechtenmatrix.Beleid.KlasplanningBewerken, Rechtbron.Klas, "klasId")]
    public async Task<ActionResult<Weekplanningweergave>> AanvaardWeek(
        Guid klasId,
        [FromBody] Weekbereik bereik,
        CancellationToken cancellationToken)
    {
        var beslisser = Aanmelding.GebruikerId(User) is { } id ? await _rechten.HaalRechtenOpAsync(id, cancellationToken) : null;
        return Ok(await _service.AanvaardVoorstellenAsync(klasId, bereik.Van, bereik.Tot, beslisser, cancellationToken));
    }
}

/// <summary>The body of a weekvoorstel request.</summary>
/// <param name="Datum">Any day of the week to propose.</param>
public sealed record Weekvraag(DateOnly Datum);

/// <summary>The body of a decision on one open proposal.</summary>
/// <param name="Aanvaard">True to accept it, false to reject it.</param>
public sealed record Voorstelbeslissing(bool Aanvaard);

/// <summary>The days whose open proposals are accepted, both inclusive.</summary>
public sealed record Weekbereik(DateOnly Van, DateOnly Tot);

/// <summary>The body of a scheduling request.</summary>
/// <param name="ActiviteitId">The activiteit to schedule. Must belong to the class in the path (Art. IX.2).</param>
/// <param name="Datum">The day. Must be a teaching day inside the school year.</param>
/// <param name="Begin">
/// When it starts, as <c>HH:mm:ss</c> (ADR-0027). <b>No default</b>, unlike the <c>Volgorde</c> it replaced: "first"
/// was a sensible answer for a slot number, while a clock time nobody chose would be the tool deciding the teacher's
/// day. A body that omits it binds to midnight and is refused, because the end cannot be before it.
/// </param>
/// <param name="Einde">When it ends. Must lie after <paramref name="Begin"/>.</param>
public sealed record Dagplanning(Guid ActiviteitId, DateOnly Datum, TimeOnly Begin, TimeOnly Einde);

/// <summary>The body of a request to mark off days for a subthema.</summary>
/// <param name="SubthemaId">The subthema. Must belong to the class in the path (Art. IX.2).</param>
/// <param name="Van">First day, inclusive. Clamped into the school year rather than refused.</param>
/// <param name="Tot">
/// Last day, inclusive. May equal <paramref name="Van"/> for a single day. <b>Neither date has to be a teaching
/// day</b>: a stretch of any length contains weekends and usually a vakantie, and refusing those would make the
/// ordinary two-week subthemaperiode unplannable.
/// </param>
public sealed record Subthemaperiode(Guid SubthemaId, DateOnly Van, DateOnly Tot);

/// <summary>The body of a move.</summary>
/// <param name="Datum">The target day. Must be a teaching day; the placement's current day is not validated.</param>
/// <param name="Begin">When it starts on the target day. Sent unchanged by a resize.</param>
/// <param name="Einde">When it ends. Must lie after <paramref name="Begin"/>.</param>
public sealed record Dagwijziging(DateOnly Datum, TimeOnly Begin, TimeOnly Einde);
