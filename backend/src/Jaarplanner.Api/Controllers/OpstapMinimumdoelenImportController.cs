using Jaarplanner.Api.Infrastructure;
using Jaarplanner.Application.Curriculum.Import;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Jaarplanner.Api.Controllers;

/// <summary>
/// Triggers the import of the decreed minimumdoelen from KOV's Op.stap API (E1-12, ADR-0032): a preview that writes
/// nothing and an apply, the two steps FR-2.5 asks of every curriculum import. One endpoint per import source
/// (ADR-0022), behind the same <see cref="CurriculumbeheerAutorisatie.Beleid"/> policy as the Excel import beside it.
/// <para>
/// <b>No request body, on purpose.</b> The source is fixed by configuration (<c>Opstap:Api</c>) and never chosen by the
/// caller, and the source refuses a paging link that leaves that host, so neither a caller nor a response can point the
/// import somewhere else.
/// </para>
/// <para>
/// <b>A source that cannot be read answers 502</b> with the Dutch sentence from <see cref="OpstapBronFout"/>, which says
/// only what holds for every cause: nothing was fetched and nothing changed. The technical cause goes to the log in
/// English (Art. II.3 as amended 2026-07-30).
/// </para>
/// <para>
/// <b>Preview and apply each read the source.</b> This endpoint has no version to pin, so what an apply commits is its
/// own report, which a screen must show rather than the preview's (E1-22).
/// </para>
/// <para>
/// <b>Layering (Art. VIII).</b> This controller consumes Application types only: the import port lives in
/// <c>Jaarplanner.Application</c>, which is where E7-13 wants the Excel import's ports to move as well.
/// </para>
/// </summary>
[ApiController]
[Authorize(Policy = CurriculumbeheerAutorisatie.Beleid)]
[Route("api/opstap-import/minimumdoelen")]
public sealed class OpstapMinimumdoelenImportController : ControllerBase
{
    private readonly IMinimumdoelImportService _importService;
    private readonly ILogger<OpstapMinimumdoelenImportController> _logger;

    public OpstapMinimumdoelenImportController(
        IMinimumdoelImportService importService,
        ILogger<OpstapMinimumdoelenImportController> logger)
    {
        _importService = importService;
        _logger = logger;
    }

    /// <summary>The answer to a preview or an apply.</summary>
    /// <param name="IsVolledigVerwerkt">
    /// True when every source row was usable and nothing was skipped. A report can be clean and still carry a notice
    /// (a minimumdoel that left the source), which is why this is not derived from <c>Opmerkingen</c>.
    /// </param>
    /// <param name="Problemen">Source rows that were not imported; operator diagnostics, in English.</param>
    /// <param name="Diff">The review report (FR-2.5). Its <c>vereistReview</c> is the flag a review screen keys on.</param>
    /// <param name="Toegepast">False for a preview or a skip; true when changes were committed.</param>
    public sealed record MinimumdoelImportAntwoord(
        bool IsVolledigVerwerkt,
        IReadOnlyList<MinimumdoelBronProbleem> Problemen,
        MinimumdoelImportDiff Diff,
        bool Toegepast);

    /// <summary>Reads the source and reports what an import would change, <b>without writing anything</b>.</summary>
    [HttpPost("voorbeeld")]
    public Task<ActionResult<MinimumdoelImportAntwoord>> Voorbeeld(CancellationToken cancellationToken) =>
        VerwerkAsync(toepassen: false, cancellationToken);

    /// <summary>
    /// Reads the source and applies the difference: the first import and every later one go through here. Idempotent on
    /// the minimumdoel ref, and it never deletes (Art. III.4).
    /// </summary>
    [HttpPost]
    public Task<ActionResult<MinimumdoelImportAntwoord>> Importeer(CancellationToken cancellationToken) =>
        VerwerkAsync(toepassen: true, cancellationToken);

    private async Task<ActionResult<MinimumdoelImportAntwoord>> VerwerkAsync(
        bool toepassen,
        CancellationToken cancellationToken)
    {
        MinimumdoelImportResultaat resultaat;
        try
        {
            resultaat = await _importService.ImporteerAsync(toepassen, cancellationToken);
        }
        catch (OpstapBronFout fout)
        {
            _logger.LogWarning(fout, "The Op.stap minimumdoelen source could not be read: {Oorzaak}", fout.TechnischeOorzaak);

            return StatusCode(StatusCodes.Status502BadGateway, new ProblemDetails
            {
                Status = StatusCodes.Status502BadGateway,
                Title = Probleemtitels.OpstapNietOpgehaald,
                Detail = fout.Message,
            });
        }

        return Ok(new MinimumdoelImportAntwoord(
            IsVolledigVerwerkt: !resultaat.Diff.Overgeslagen && resultaat.Problemen.Count == 0,
            resultaat.Problemen,
            resultaat.Diff,
            resultaat.Toegepast));
    }
}
