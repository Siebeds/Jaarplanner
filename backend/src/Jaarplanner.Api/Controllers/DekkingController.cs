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
/// </para>
/// <para>
/// <b>What happens to a bad <c>bereik</c>, measured rather than assumed, over two audit rounds.</b> A value binding
/// cannot parse, and any out-of-range <i>numeric</i> form, yields a <b>400</b> from model binding:
/// <c>?bereik=5</c>, <c>?bereik=-1</c> and <c>?bereik=onzin</c> are all rejected. No Dutch message is authored for it,
/// because the frontend validates against its own union before asking, so the only way to produce one is by hand or
/// from another API consumer, which makes it an operator diagnostic under the ratified Art. II.3 split.
/// <list type="bullet">
/// <item><b>Round 1</b> reported that binding accepts an undefined numeric enum, so <c>?bereik=5</c> would return
/// whole-curriculum figures under a label no consumer knows — and correctly flagged the finding as not empirically
/// executed, asking for confirmation first. It does not reproduce: with an explicit <c>Enum.IsDefined</c> guard
/// deliberately removed, all three values still answered 400, so the guard came out again rather than staying with a
/// justification that is untrue. <b>The test stayed</b>
/// (<c>Een_bereik_dat_niet_bestaat_geeft_400_en_geen_cijfer</c>), because it pins the behaviour whoever enforces it.</item>
/// <item><b>Round 2</b> then falsified the sentence that replaced it. "Anything other than the two names yields 400"
/// is too strong: <c>?bereik=EigenJaarFase,HeelCurriculum</c> <i>binds</i>, because <c>Enum.Parse</c> reads the comma
/// as a flags combination. It resolves to a defined member, so the response still self-labels with a scope a consumer
/// knows and no figure is mislabelled. <b>The claim was wrong, not the behaviour</b>, which is why this paragraph is
/// now scoped to what was actually measured.</item>
/// </list>
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
    private readonly IDekkingExport _export;

    public DekkingController(DekkingService service, IDekkingExport export)
    {
        _service = service;
        _export = export;
    }

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
    /// <param name="jaarFase">
    /// Narrows the class's own scope to one of its codes, for a class that has more than one (owner ruling
    /// 2026-08-04: a kleutergroep is JK+K2+K3 and the teacher says which). Ignored when it is not one of them, so a
    /// stale link degrades to the full scope rather than to an error; the response reports what was applied.
    /// </param>
    /// <param name="cancellationToken">Cancellation.</param>
    [HttpGet]
    public async Task<ActionResult<DekkingWeergave>> Detail(
        Guid klasId,
        CancellationToken cancellationToken,
        [FromQuery] Dekkingsbereik bereik = Dekkingsbereik.EigenJaarFase,
        [FromQuery] string? jaarFase = null) =>
        Ok(await _service.BerekenAsync(klasId, bereik, jaarFase, cancellationToken));

    /// <summary>
    /// The same coverage, as a downloadable .xlsx: the dekkingsoverzicht as proof of coverage (E5-06, FR-9.5,
    /// FR-11.2, Art. V.4).
    /// <para>
    /// <b>It computes through <see cref="DekkingService"/>, exactly as <see cref="Detail"/> does</b>, so the document
    /// and the screen are two renderings of one computation rather than two computations that agree today. The export
    /// generator is handed the finished record and can query nothing.
    /// </para>
    /// <para>
    /// <b>It takes the scope parameters and nothing else, by owner ruling of 2026-08-06: the export is always the
    /// full set in scope.</b> <c>bereik</c> and <c>jaarFase</c> are part of what the figures <i>mean</i> (the same
    /// class has two legitimate denominators, and a kleutergroep chooses its kleuterjaar), so they travel. The
    /// screen's doelsoort filter and its gaps-only toggle are presentation over that set, so they do not, and there
    /// is deliberately no query parameter for either: a caller cannot narrow this document at all. The consequence
    /// is stated <i>inside</i> the document as well as beside the link, because the file outlives the screen.
    /// </para>
    /// <para>
    /// <b>Unauthenticated, like every other read here, and that is debt rather than a decision</b> (E7-11, blocked on
    /// E6-01/E6-02). Worth one extra sentence on this route specifically: it hands out a whole class's planning and
    /// coverage as a single file to anyone who can guess a klas id, which is a larger blast radius than the JSON read
    /// beside it even though it exposes not one field more.
    /// </para>
    /// </summary>
    /// <param name="klasId">The class.</param>
    /// <param name="cancellationToken">Cancellation.</param>
    /// <param name="bereik">Which leerplandoelen to measure against; same meaning and default as <see cref="Detail"/>.</param>
    /// <param name="jaarFase">Narrows the class's own scope to one of its codes; same meaning as <see cref="Detail"/>.</param>
    [HttpGet("export")]
    public async Task<IActionResult> Export(
        Guid klasId,
        CancellationToken cancellationToken,
        [FromQuery] Dekkingsbereik bereik = Dekkingsbereik.EigenJaarFase,
        [FromQuery] string? jaarFase = null)
    {
        var dekking = await _service.BerekenAsync(klasId, bereik, jaarFase, cancellationToken);
        var bestand = _export.Genereer(dekking);

        return File(bestand.Inhoud, bestand.ContentType, bestand.Bestandsnaam);
    }
}
