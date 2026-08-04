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
/// tolerable for one primary school and it is what a single-figure overview and an export need; each request also
/// costs four link queries plus a full thema load.
/// <b>E5-02 took that decision consciously and kept it unpaged</b>, for a reason paging cannot satisfy: the totals
/// and the reliability verdict are properties of the <i>whole</i> scope, so a page of rows could not carry them, and
/// the default scope is now one jaar/fase rather than the whole curriculum (see below), which is what makes the
/// volume reasonable. The whole-curriculum switch is the expensive case and it is a deliberate, named action.
/// </para>
/// <para>
/// <b>The denominator is scoped, and the scope is a query parameter (owner ruling 2026-08-04).</b>
/// <c>?bereik=EigenJaarFase</c> (the default) measures the class against the jaar/fase derived from its own
/// <c>Leerjaar</c>; <c>?bereik=HeelCurriculum</c> is E5-01's original unscoped behaviour, kept as an explicit
/// choice. The response always states which one it applied, which codes it used and how many goals it left out, so
/// no consumer can print a total without being able to say what it is a total <i>of</i>.
/// An unparseable value yields the framework's model-binding 400, like every other malformed parameter in this API;
/// no Dutch message is authored for it, because the only way to produce one is to hand-edit the URL and the
/// frontend sends the enum name.
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
    /// The class's current coverage (FR-9.1): every in-scope leerplandoel with whether this plan covers it and
    /// through which thema's, plus the reliability of the summary figure. A class that has never been generated for
    /// yields 0 covered rather than a 404 — Art. IX.3 says a klas <i>has</i> a jaarplan, and an empty one covers
    /// nothing.
    /// </summary>
    /// <param name="klasId">The class.</param>
    /// <param name="bereik">
    /// Which leerplandoelen to measure against; defaults to the class's own jaar/fase (owner ruling 2026-08-04).
    /// Omitting it therefore gives the ruled answer rather than the unscoped one E5-01 shipped.
    /// </param>
    /// <param name="cancellationToken">Cancellation.</param>
    [HttpGet]
    public async Task<ActionResult<DekkingWeergave>> Detail(
        Guid klasId,
        CancellationToken cancellationToken,
        [FromQuery] Dekkingsbereik bereik = Dekkingsbereik.EigenJaarFase) =>
        Ok(await _service.BerekenAsync(klasId, bereik, cancellationToken));
}
