using Jaarplanner.Api.Infrastructure.Autorisatie;
using Jaarplanner.Application.Ontwikkelingsrapport;
using Jaarplanner.Application.Toegang;
using Microsoft.AspNetCore.Mvc;

namespace Jaarplanner.Api.Controllers;

/// <summary>
/// Thin REST controller (Art. VIII) for the ontwikkelingsrapport of one child at one evaluatiemoment (FB-003, FR-13.3).
/// All logic lives in <see cref="IOntwikkelingsrapportService"/>. Under the leerling, since a report is always one
/// child's, and the moment in the route held to 1..3, so any other number is a 404 before anything runs.
/// <para>
/// <b>Rights (ADR-0030 §3 footnote ⁶, ADR-0035 §3.3), both on the child's klas.</b> Reading is
/// <c>OntwikkelingsrapportLezen</c>: admin, and the klas's own K3 leerkrachten, also after its schooljaar (R26); no
/// leerkracht of another klas (R17). Every write is <c>RapportInvullen</c>: admin always, and those leerkrachten only
/// during the schooljaar. The leerling is resolved before the check, so an unknown child is a 404 first.
/// </para>
/// <para>
/// <b>Pupil data (Art. VI.7).</b> Nothing here logs; the read is <c>no-store</c>, like the list of children, so no copy of
/// a report stays in a browser or proxy cache; request-body logging is off for the whole app.
/// </para>
/// </summary>
[ApiController]
[Route("api/leerlingen/{leerlingId:guid}/rapporten/{moment:int:range(1,3)}")]
public sealed class OntwikkelingsrapportenController : ControllerBase
{
    /// <summary>
    /// The largest request the drawing's upload reads: the file limit and room for the multipart envelope. A file between
    /// the two gets the service's Dutch refusal; anything larger is cut off by the server with a 413, which the screen
    /// answers in the same words (and it refuses such a file before sending it). There is deliberately no
    /// <c>RequestFormLimits</c> as well: it would cut the form off first, as an English model-binding 400 that names no
    /// limit.
    /// </summary>
    private const long TekeningAanvraagLimiet = Kindtekeningregels.MaxBytes + (1024 * 1024);

    private readonly IOntwikkelingsrapportService _service;
    private readonly IKindtekeningService _tekeningen;

    public OntwikkelingsrapportenController(IOntwikkelingsrapportService service, IKindtekeningService tekeningen)
    {
        _service = service;
        _tekeningen = tekeningen;
    }

    [HttpGet]
    [RechtOp(Rechtenmatrix.Beleid.OntwikkelingsrapportLezen, Rechtbron.Leerling, "leerlingId")]
    [ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
    public async Task<ActionResult<RapportWeergave>> Detail(Guid leerlingId, int moment, CancellationToken cancellationToken) =>
        Ok(await _service.HaalRapportOpAsync(leerlingId, moment, cancellationToken));

    [HttpPut("rapportdoelen/{rapportdoelId:guid}")]
    [RechtOp(Rechtenmatrix.Beleid.RapportInvullen, Rechtbron.Leerling, "leerlingId")]
    public async Task<ActionResult<BeoordelingWeergave>> BewaarBeoordeling(
        Guid leerlingId,
        int moment,
        Guid rapportdoelId,
        [FromBody] BeoordelingInvoer invoer,
        CancellationToken cancellationToken) =>
        Ok(await _service.BewaarBeoordelingAsync(leerlingId, moment, rapportdoelId, invoer, cancellationToken));

    [HttpPut("besluit")]
    [RechtOp(Rechtenmatrix.Beleid.RapportInvullen, Rechtbron.Leerling, "leerlingId")]
    public async Task<ActionResult<BesluitWeergave>> BewaarBesluit(
        Guid leerlingId,
        int moment,
        [FromBody] BesluitInvoer invoer,
        CancellationToken cancellationToken) =>
        Ok(await _service.BewaarBesluitAsync(leerlingId, moment, invoer, cancellationToken));

    /// <summary>
    /// Asks the AI to rewrite one text of this report (FB-004, R21, R22). The same right as filling it in, so after the
    /// schooljaar a leerkracht cannot reach it by the address either, and nothing is stored whatever the answer.
    /// <para>
    /// <b>The failure bodies are English operator diagnostics</b> (Art. II.3) and quote no text. The screen never shows
    /// them: it says its own Dutch sentence per status, because a teacher cannot act on "Malformed JSON".
    /// </para>
    /// </summary>
    [HttpPost("herschrijvingen")]
    [RechtOp(Rechtenmatrix.Beleid.RapportInvullen, Rechtbron.Leerling, "leerlingId")]
    public async Task<ActionResult<HerschrijfVoorstel>> Herschrijf(
        Guid leerlingId,
        int moment,
        [FromBody] HerschrijfAanvraag aanvraag,
        CancellationToken cancellationToken)
    {
        var resultaat = await _service.StelHerschrijvingVoorAsync(
            leerlingId,
            moment,
            aanvraag?.RapportdoelId,
            aanvraag?.Tekst,
            cancellationToken);

        if (resultaat.IsGeslaagd)
        {
            return Ok(new HerschrijfVoorstel(resultaat.Voorstel!, resultaat.Zegel!));
        }

        var status = resultaat.Mislukking == Herschrijfmislukking.AiOnbereikbaar
            ? StatusCodes.Status503ServiceUnavailable
            : StatusCodes.Status422UnprocessableEntity;
        return StatusCode(status, new ProblemDetails
        {
            Status = status,
            Title = resultaat.Mislukking == Herschrijfmislukking.AiOnbereikbaar
                ? "AI unavailable"
                : "Invalid AI response",
            Detail = resultaat.Fout,
        });
    }

    /// <summary>Records that the teacher rejected a proposal (R23). 204 also when the text it was meant for is gone.</summary>
    [HttpPost("herschrijvingen/geweigerd")]
    [RechtOp(Rechtenmatrix.Beleid.RapportInvullen, Rechtbron.Leerling, "leerlingId")]
    public async Task<IActionResult> WeigerHerschrijving(
        Guid leerlingId,
        int moment,
        [FromBody] HerschrijfWeigering weigering,
        CancellationToken cancellationToken)
    {
        await _service.WeigerHerschrijvingAsync(
            leerlingId,
            moment,
            weigering?.RapportdoelId,
            weigering?.Herschrijving,
            cancellationToken);
        return NoContent();
    }

    /// <summary>
    /// The kindtekening's image (FB-005). Only through this route, which asks the same right as the report and answers
    /// <c>no-store</c>: there is no public or lasting address of a drawing (ADR-0035 D15). No file name is sent, so none
    /// exists to leak; <c>nosniff</c> holds the browser to the stated type.
    /// </summary>
    [HttpGet("tekening")]
    [RechtOp(Rechtenmatrix.Beleid.OntwikkelingsrapportLezen, Rechtbron.Leerling, "leerlingId")]
    [ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
    public async Task<IActionResult> Tekening(Guid leerlingId, int moment, CancellationToken cancellationToken)
    {
        var bestand = await _tekeningen.HaalOpAsync(leerlingId, moment, cancellationToken);
        Response.Headers.XContentTypeOptions = "nosniff";
        return File(bestand.Inhoud, bestand.MediaType);
    }

    /// <summary>
    /// Adds or replaces the kindtekening (FB-005): a multipart form with one file, <c>bestand</c>. The service re-encodes
    /// it before anything is stored. The upload's file name is never read.
    /// <para>
    /// <b>The form is read here, after the rights check, not bound as a parameter.</b> An <c>IFormFile</c> parameter makes
    /// the route multipart-only, and routing would then answer a request of any other type with a 415 before anyone is
    /// asked who they are. Read here, such a request gets the 403 every write route gives someone without the right, and
    /// with the right the service's Dutch "no file".
    /// </para>
    /// </summary>
    [HttpPut("tekening")]
    [RechtOp(Rechtenmatrix.Beleid.RapportInvullen, Rechtbron.Leerling, "leerlingId")]
    [RequestSizeLimit(TekeningAanvraagLimiet)]
    // The whole form stays in memory. Above the default 64 KB, ASP.NET Core would buffer the upload to a temp file,
    // and the photo as it came in, GPS position and all, would lie on the server's disk until the request ends
    // (ADR-0035 §3.6: nothing of it is stored before the re-encode). Only this threshold is set: a smaller multipart
    // limit here would cut the form off as an English 400 before the service can refuse it in Dutch.
    [RequestFormLimits(MemoryBufferThreshold = (int)TekeningAanvraagLimiet)]
    public async Task<ActionResult<TekeningWeergave>> BewaarTekening(Guid leerlingId, int moment, CancellationToken cancellationToken)
    {
        var bestand = Request.HasFormContentType
            ? (await Request.ReadFormAsync(cancellationToken)).Files.GetFile("bestand")
            : null;
        await using var stroom = bestand?.OpenReadStream() ?? Stream.Null;
        return Ok(await _tekeningen.BewaarAsync(leerlingId, moment, stroom, bestand?.Length ?? 0, cancellationToken));
    }

    /// <summary>Deletes the kindtekening (FB-005). 204 also when there was none.</summary>
    [HttpDelete("tekening")]
    [RechtOp(Rechtenmatrix.Beleid.RapportInvullen, Rechtbron.Leerling, "leerlingId")]
    public async Task<IActionResult> VerwijderTekening(Guid leerlingId, int moment, CancellationToken cancellationToken)
    {
        await _tekeningen.VerwijderAsync(leerlingId, moment, cancellationToken);
        return NoContent();
    }
}
