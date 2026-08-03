using Jaarplanner.Application.Dekking;
using Microsoft.AspNetCore.Mvc;

namespace Jaarplanner.Api.Controllers;

/// <summary>
/// Thin REST controller (Art. VIII) for a class's dekking (E5-01, FR-9.1). All logic lives in
/// <see cref="DekkingService"/>; the controller only binds, delegates and returns.
/// <para>
/// <b>Read-only by construction.</b> There is no POST, PUT or DELETE, and there could not be: dekking is computed,
/// never stored (Art. V.1), so there is nothing here to write. The GET recomputes on every call.
/// </para>
/// <para>
/// <b>It is an invocation surface for a computation, not yet a screen.</b> This project has withdrawn a milestone
/// over a service reachable only from its own unit tests (E2-08), so the endpoint ships in the same change as the
/// computation. It is deliberately <b>not</b> a claim that FR-9 is satisfied: the dekkingsoverzicht itself is
/// E5-02/E5-03/E5-05, and until one of those ships no teacher can see this. What this surface does buy is that the
/// figure can be verified against a real database by anyone, including this story's own gates.
/// </para>
/// <para>
/// <b>Unauthenticated, like every other read surface here, and that is debt rather than a decision.</b> This adds one
/// more anonymous read of any class's planning data. FA §3.2 lets all three roles <i>view</i> dekking (another class
/// as "lezen"), so the role matrix demands no gate here — but it does demand a signed-in user, and there is none:
/// <b>E7-11</b> owns that app-wide gap and is blocked on E6-01/E6-02. Noted on this controller rather than left
/// implicit, because "12 of 13 controllers are already open" is an explanation and not a justification.
/// </para>
/// <para>
/// <b>The payload is the whole in-scope curriculum, unpaged, with each goal's full text.</b> That is a deliberate
/// divergence from the register (E1-16), which pages precisely because it "renders thousands of these". It is
/// tolerable for one primary school and it is what a single-figure overview and an export need; it is recorded here
/// so <b>E5-02/E5-03</b> decide consciously whether the anchor screen adopts the register's paging/filter shape
/// instead of inheriting this one. Each request also costs four link queries plus a full thema load.
/// </para>
/// <para>
/// <b>Two things this response deliberately cannot do.</b> It cannot report a total while any placement is
/// unresolved: <c>aantalGedekt</c> is <c>null</c> in that state and <c>isBetrouwbaar</c> is <c>false</c>, per the
/// directie ruling of 2026-07-28 that coverage must not claim what it cannot prove. And it says nothing about
/// <b>minimumdoel</b>-level coverage, the level the onderwijsinspectie actually tests (Art. V.2): that is E5-04 and
/// it is blocked on E1-12, because no <c>Minimumdoel</c> row can exist until directie supplies the decreed source
/// file. Each doel carries its <c>minimumdoelRef</c> so that roll-up needs no second pass, but the roll-up is not
/// here and must not be read as present.
/// </para>
/// </summary>
[ApiController]
[Route("api/klassen/{klasId:guid}/dekking")]
public sealed class DekkingController : ControllerBase
{
    private readonly DekkingService _service;

    public DekkingController(DekkingService service) => _service = service;

    /// <summary>
    /// The class's current coverage (FR-9.1): every leerplandoel with whether this plan covers it and through which
    /// thema's, plus the reliability of the summary figure. A class that has never been generated for yields 0
    /// covered rather than a 404 — Art. IX.3 says a klas <i>has</i> a jaarplan, and an empty one covers nothing.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<DekkingWeergave>> Detail(Guid klasId, CancellationToken cancellationToken) =>
        Ok(await _service.BerekenAsync(klasId, cancellationToken));
}
