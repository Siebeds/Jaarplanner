using Jaarplanner.Api.Infrastructure;
using Jaarplanner.Application.Curriculum.Import;
using Jaarplanner.Domain.Curriculum;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace Jaarplanner.Api.Controllers;

/// <summary>
/// Triggers the import of the Op.stap leerplandoelen from KOV's API (E1-21, ADR-0032): a preview that writes nothing and
/// an apply, the two steps FR-2.5 asks of every curriculum import. One endpoint per import source (ADR-0022), behind the
/// same <see cref="CurriculumbeheerAutorisatie.Beleid"/> policy as the two import sources beside it.
/// <para>
/// <b>The version is the only thing a caller chooses.</b> The preview takes an optional <c>versie</c> and, without one,
/// reads the newest numbered snapshot and names it in its answer. The apply <b>requires</b> it, so it commits exactly the
/// snapshot the reviewer saw even if KOV publishes a newer one in between (ADR-0032 decision 6). A version is digits and
/// dots only. The host is fixed by configuration (<c>Opstap:Api</c>), as for the minimumdoelen, and neither typed client
/// follows a redirect (<see cref="Jaarplanner.Infrastructure.OpstapImport.OpstapApiRegistratie"/>), so a response cannot
/// move the read to another host either. The body is streamed and not size-capped.
/// </para>
/// <para>
/// <b>Errors.</b> A source that cannot be read answers <b>502</b> with the Dutch sentence of <see cref="OpstapBronFout"/>
/// and logs the English cause (Art. II.3 as amended 2026-07-30). A discipline that cannot land (a concordance to a
/// minimumdoel that is not loaded yet, a code under another discipline) answers <b>409</b> through
/// <c>OpstapImportExceptionHandler</c>, on the preview as on the apply, and an apply then writes nothing at all.
/// </para>
/// </summary>
[ApiController]
[Authorize(Policy = CurriculumbeheerAutorisatie.Beleid)]
[Route("api/opstap-import/leerplandoelen")]
public sealed class OpstapLeerplandoelenImportController : ControllerBase
{
    private readonly ILeerplandoelImportService _importService;
    private readonly ILogger<OpstapLeerplandoelenImportController> _logger;

    public OpstapLeerplandoelenImportController(
        ILeerplandoelImportService importService,
        ILogger<OpstapLeerplandoelenImportController> logger)
    {
        _importService = importService;
        _logger = logger;
    }

    /// <summary>The request body: which numbered snapshot to read.</summary>
    /// <param name="Versie">For example <c>1.2</c>. Optional for the preview, required for the apply.</param>
    public sealed record LeerplandoelImportVerzoek(string? Versie);

    /// <summary>The answer to a preview or an apply.</summary>
    /// <param name="IsVolledigVerwerkt">
    /// True when every G goal was usable and no discipline was skipped. Skipped goal <i>sets</i> do not count against
    /// it: leaving them out is the ruled scope (only G, owner 2026-09-11), not something that went wrong.
    /// </param>
    /// <param name="Versie">The numbered snapshot that was read; an apply must send this back.</param>
    /// <param name="Hash">KOV's hash for that snapshot.</param>
    /// <param name="SnapshotTijdstip">When KOV published it.</param>
    /// <param name="VorigeVersie">The version the last applied import read, or null.</param>
    /// <param name="Wijzigingslog">KOV's own changelog for this version as plain text, or null.</param>
    /// <param name="OvergeslagenDoelsets">Goals of the goal sets that are not imported, counted per set.</param>
    /// <param name="Problemen">G goals that were not imported, and why (operator diagnostics, English).</param>
    /// <param name="Disciplines">One review report per discipline (FR-2.5).</param>
    /// <param name="Toegepast">False for a preview; true when the apply committed.</param>
    /// <param name="SchrijftIets">True when applying this report writes anything (E1-22); a screen offers an apply only then.</param>
    /// <param name="AantalRedenenGewijzigd">How many minimumdoelen get a different reason for having no leerplandoel.</param>
    public sealed record LeerplandoelImportAntwoord(
        bool IsVolledigVerwerkt,
        string Versie,
        string Hash,
        DateTimeOffset? SnapshotTijdstip,
        OpstapversieWeergave? VorigeVersie,
        string? Wijzigingslog,
        IReadOnlyList<DoelsetTelling> OvergeslagenDoelsets,
        IReadOnlyList<LeerplandoelBronProbleem> Problemen,
        IReadOnlyList<LeerplandoelDisciplineResultaat> Disciplines,
        bool Toegepast,
        bool SchrijftIets,
        int AantalRedenenGewijzigd);

    /// <summary>Reads a snapshot and reports what an import would change, <b>without writing anything</b>.</summary>
    [HttpPost("voorbeeld")]
    public Task<ActionResult<LeerplandoelImportAntwoord>> Voorbeeld(
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] LeerplandoelImportVerzoek? verzoek,
        CancellationToken cancellationToken)
    {
        var versie = verzoek?.Versie;
        if (versie is not null && !Opstapversie.IsGeldigeVersie(versie))
        {
            return Task.FromResult<ActionResult<LeerplandoelImportAntwoord>>(BadRequest(OngeldigeVersie(versie)));
        }

        return VerwerkAsync(versie, toepassen: false, cancellationToken);
    }

    /// <summary>
    /// Reads the named snapshot and applies it: the first import and every later one go through here. Idempotent on the
    /// leerplandoel code, and it never deletes (Art. III.4).
    /// </summary>
    [HttpPost]
    public Task<ActionResult<LeerplandoelImportAntwoord>> Importeer(
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] LeerplandoelImportVerzoek? verzoek,
        CancellationToken cancellationToken)
    {
        var versie = verzoek?.Versie;
        if (string.IsNullOrWhiteSpace(versie))
        {
            return Task.FromResult<ActionResult<LeerplandoelImportAntwoord>>(BadRequest(Probleem(
                "Geef de Op.stap-versie mee die in het voorbeeld getoond werd, bijvoorbeeld 1.2. " +
                "Zo wordt precies doorgevoerd wat nagekeken is.")));
        }

        if (!Opstapversie.IsGeldigeVersie(versie))
        {
            return Task.FromResult<ActionResult<LeerplandoelImportAntwoord>>(BadRequest(OngeldigeVersie(versie)));
        }

        return VerwerkAsync(versie, toepassen: true, cancellationToken);
    }

    private async Task<ActionResult<LeerplandoelImportAntwoord>> VerwerkAsync(
        string? versie,
        bool toepassen,
        CancellationToken cancellationToken)
    {
        LeerplandoelImportResultaat resultaat;
        try
        {
            resultaat = await _importService.ImporteerAsync(versie, toepassen, cancellationToken);
        }
        catch (OpstapBronFout fout)
        {
            _logger.LogWarning(fout, "The Op.stap curriculum source could not be read: {Oorzaak}", fout.TechnischeOorzaak);

            return StatusCode(StatusCodes.Status502BadGateway, new ProblemDetails
            {
                Status = StatusCodes.Status502BadGateway,
                Title = Probleemtitels.OpstapNietOpgehaald,
                Detail = fout.Message,
            });
        }

        return Ok(new LeerplandoelImportAntwoord(
            IsVolledigVerwerkt: resultaat.Problemen.Count == 0 && resultaat.Disciplines.All(d => !d.Diff.Overgeslagen),
            resultaat.Versie,
            resultaat.Hash,
            resultaat.SnapshotTijdstip,
            resultaat.VorigeVersie,
            resultaat.Wijzigingslog,
            resultaat.OvergeslagenDoelsets,
            resultaat.Problemen,
            resultaat.Disciplines,
            resultaat.Toegepast,
            resultaat.SchrijftIets,
            resultaat.AantalRedenenGewijzigd));
    }

    private static ProblemDetails OngeldigeVersie(string versie) =>
        Probleem($"'{versie}' is geen Op.stap-versie. Een versie is een nummer zoals 1.2.");

    private static ProblemDetails Probleem(string detail) =>
        new()
        {
            Status = StatusCodes.Status400BadRequest,
            Title = Probleemtitels.OngeldigeAanvraag,
            Detail = detail,
        };
}
