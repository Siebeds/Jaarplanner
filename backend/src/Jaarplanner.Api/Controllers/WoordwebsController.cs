using Jaarplanner.Api.Infrastructure.Authenticatie;
using Jaarplanner.Api.Infrastructure.Autorisatie;
using Jaarplanner.Application.Toegang;
using Jaarplanner.Application.Woordwebs;
using Microsoft.AspNetCore.Mvc;

namespace Jaarplanner.Api.Controllers;

/// <summary>
/// Thin REST controller (Art. VIII) for the woordweb, the brainstorm of step 3 (FB-036, ADR-0043). All rules live in
/// the <see cref="Domain.Schoolcontent.Woordweb"/> aggregate and <see cref="IWoordwebService"/>.
/// <para>
/// <b>Rights.</b> Reading every web on a subthema needs a session only (W2). Adding words to <b>one's own</b> web needs
/// a session only too (D2): that route takes the web from the caller's identity and never from the body, so it cannot
/// reach anyone else's. Every action on a web by its id is the <c>WoordwebBewerken</c> row: its owner, and admin (D3).
/// </para>
/// <para>
/// <b>The AI request answers 422 on a model answer outside the contract</b>, with an English diagnostic and no change
/// (Art. IV.5), as <see cref="DoelsuggestiesController"/> does, so the two AI triggers behave alike. A web without a word
/// of the teacher's own is refused with a 400 before any call (W5).
/// </para>
/// </summary>
[ApiController]
public sealed class WoordwebsController : ControllerBase
{
    private readonly IWoordwebService _service;

    public WoordwebsController(IWoordwebService service) => _service = service;

    /// <summary>Every woordweb on the subthema, the caller's own first.</summary>
    [HttpGet("api/subthemas/{subthemaId:guid}/woordwebs")]
    public async Task<ActionResult<IReadOnlyList<WoordwebWeergave>>> VoorSubthema(Guid subthemaId, CancellationToken cancellationToken) =>
        Aanmelding.GebruikerId(User) is { } gebruikerId
            ? Ok(await _service.HaalVoorSubthemaAsync(subthemaId, gebruikerId, cancellationToken))
            : Forbid();

    /// <summary>Adds typed words to the caller's own web on the subthema, creating it on the first word (D2).</summary>
    [HttpPost("api/subthemas/{subthemaId:guid}/woordwebs/eigen/woorden")]
    public async Task<ActionResult<WoordwebWeergave>> VoegEigenWoordenToe(
        Guid subthemaId,
        [FromBody] WoordenInvoer invoer,
        CancellationToken cancellationToken) =>
        Aanmelding.GebruikerId(User) is { } gebruikerId
            ? Ok(await _service.VoegEigenWoordenToeAsync(subthemaId, gebruikerId, invoer.Woorden ?? [], cancellationToken))
            : Forbid();

    /// <summary>Adds typed words to a web by its id: its owner, or admin.</summary>
    [HttpPost("api/woordwebs/{woordwebId:guid}/woorden")]
    [RechtOp(Rechtenmatrix.Beleid.WoordwebBewerken, Rechtbron.Woordweb, "woordwebId")]
    public async Task<ActionResult<WoordwebWeergave>> VoegWoordenToe(
        Guid woordwebId,
        [FromBody] WoordenInvoer invoer,
        CancellationToken cancellationToken) =>
        Ok(await _service.VoegWoordenToeAsync(woordwebId, Aanmelder(), invoer.Woorden ?? [], cancellationToken));

    /// <summary>Takes a word out of a web (D6).</summary>
    [HttpDelete("api/woordwebs/{woordwebId:guid}/woorden/{woordId:guid}")]
    [RechtOp(Rechtenmatrix.Beleid.WoordwebBewerken, Rechtbron.Woordweb, "woordwebId")]
    public async Task<ActionResult<WoordwebWeergave>> VerwijderWoord(Guid woordwebId, Guid woordId, CancellationToken cancellationToken) =>
        Ok(await _service.VerwijderWoordAsync(woordwebId, woordId, Aanmelder(), cancellationToken));

    /// <summary>Accepts or rejects a word the AI proposed (Art. IV.1, IV.2).</summary>
    [HttpPut("api/woordwebs/{woordwebId:guid}/woorden/{woordId:guid}/status")]
    [RechtOp(Rechtenmatrix.Beleid.WoordwebBewerken, Rechtbron.Woordweb, "woordwebId")]
    public async Task<ActionResult<WoordwebWeergave>> Beslis(
        Guid woordwebId,
        Guid woordId,
        [FromBody] WoordBeslissing beslissing,
        CancellationToken cancellationToken) =>
        Ok(await _service.BeslisAsync(woordwebId, woordId, beslissing.Status, Aanmelder(), cancellationToken));

    /// <summary>Asks the AI for words (W5, W6, D1).</summary>
    [HttpPost("api/woordwebs/{woordwebId:guid}/voorstellen")]
    [RechtOp(Rechtenmatrix.Beleid.WoordwebBewerken, Rechtbron.Woordweb, "woordwebId")]
    public async Task<ActionResult<WoordwebVoorstelResultaat>> StelVoor(Guid woordwebId, CancellationToken cancellationToken)
    {
        var resultaat = await _service.StelWoordenVoorAsync(woordwebId, Aanmelder(), cancellationToken);

        return resultaat.IsGeslaagd
            ? Ok(resultaat)
            : UnprocessableEntity(new ProblemDetails
            {
                Status = StatusCodes.Status422UnprocessableEntity,
                Title = "Invalid AI response",
                Detail = resultaat.Fout,
            });
    }

    // A [RechtOp] route has already matched the caller to a gebruiker (the matrix handler refuses a principal without one),
    // so a missing id here is a wiring fault, not a teacher's case.
    private Guid Aanmelder() =>
        Aanmelding.GebruikerId(User) ?? throw new InvalidOperationException("A woordweb route ran without a gebruiker id.");
}
