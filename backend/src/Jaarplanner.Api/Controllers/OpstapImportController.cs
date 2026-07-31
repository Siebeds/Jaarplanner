using Jaarplanner.Api.Infrastructure;
using Jaarplanner.Application.Curriculum.Import;
using Jaarplanner.Infrastructure.OpstapImport;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Jaarplanner.Api.Controllers;

/// <summary>
/// REST controller that <b>triggers</b> the Op.stap curriculum import: an initial
/// import and a re-import per discipline, returning the reviewable <see cref="OpstapHerimportDiff"/>
/// (E1-15 — FR-2.1, FR-2.5).
/// <para>
/// <b>Why this exists.</b> The parser (E1-03), the non-destructive re-import with its review diff
/// (E1-05) and the discipline-selection seam (E1-06) were all built, tested and (partly) DI-registered,
/// but <see cref="IOpstapImportService"/> was referenced by <b>no controller</b> and
/// <see cref="IOpstapParser"/> was not even registered, so no running application could load a single
/// leerplandoel. FR-2.1 (<i>"de leerplandoelen worden ingeladen"</i>) and FR-2.5 (<i>"de doelen kunnen
/// opnieuw ingeladen worden"</i>) failed on the trigger, not the logic. This is that trigger. It is the
/// same defect E2-08 fixed for the AI matching service, in the other importer.
/// </para>
/// <para>
/// <b>The two-step flow (FR-2.5).</b> <c>POST voorbeeld</c> parses and diffs and writes <b>nothing</b>;
/// the reviewer reads what would be added, changed, or has disappeared from Op.stap while still being
/// linked by teacher content, and only then calls <c>POST</c> to commit. Both paths run the same logic,
/// so the commit matches the preview for the same file and discipline — <b>including the refusals</b>: the
/// three curriculum-integrity checks run before any write, so a preview never green-lights an import that
/// the commit would reject. That property was missing in the first round of this story (the refusals fired
/// on <c>SaveChanges</c>, which a preview never reaches) and it made the review step actively misleading.
/// </para>
/// <para>
/// <b>What this controller must never do (Art. III.1/III.4).</b> It only parses and delegates. The
/// curriculum stays read-only reference data: nothing here edits official content, and the
/// non-destructive guarantee (a disappeared-but-linked goal is flagged, never deleted; jaarplannen and
/// teacher <c>DoelKoppeling</c> statuses are untouched) lives in
/// <see cref="OpstapImportService"/> and is deliberately not re-implemented, re-tuned or bypassed here.
/// </para>
/// <para>
/// <b>Authorisation.</b> Behind the single <see cref="CurriculumbeheerAutorisatie.Beleid"/> policy
/// (Art. VI.1, ADR-0011 §2, ADR-0022), which today authorises everyone because the API has no
/// authenticated user at all. See that class for what E6-02 changes.
/// </para>
/// <para>
/// <b>Layering, stated honestly (Art. VIII).</b> This controller only binds, delegates and returns, and
/// it names no EF Core or Npgsql type. It is <b>not</b> fully Art. VIII-clean, and the reason is filed:
/// <c>IOpstapParser</c>, <c>IOpstapImportService</c> and <c>OpstapRijProbleem</c> are Application-shaped
/// ports and DTOs that physically live in <c>Jaarplanner.Infrastructure</c>, so an Api controller
/// consuming them takes a dependency the layering forbids. That is <b>E7-13</b>, which owns moving the
/// import ports to <c>Application</c>; this story deliberately did not do it (it would drag the
/// school-content parser along and doubles the size of a story already at its boundary) and instead
/// recorded its blast radius there. Do not "fix" the layering here without reading E7-13 first.
/// </para>
/// </summary>
[ApiController]
[Authorize(Policy = CurriculumbeheerAutorisatie.Beleid)]
[Route("api/opstap-import")]
public sealed class OpstapImportController : ControllerBase
{
    /// <summary>
    /// Upload cap. One discipline's Op.stap goal Excel is a few thousand rows over 13 columns, several
    /// of them long prose (toelichting, voorbeelden), so this is generous rather than tight.
    /// </summary>
    private const long MaxBestandsgrootteBytes = 20 * 1024 * 1024;

    private readonly IOpstapParser _parser;
    private readonly IOpstapImportService _importService;

    public OpstapImportController(IOpstapParser parser, IOpstapImportService importService)
    {
        _parser = parser;
        _importService = importService;
    }

    /// <summary>
    /// The answer to a preview or a commit: the per-row parse problems plus the reviewable diff.
    /// <para>
    /// <b>Two separate notions of "clean", deliberately</b> — the same split E1-07's audit forced on the
    /// school-content importer, for the same reason. A file can parse without a single problem and still
    /// have changed nothing, because the discipline is out of the configured import selection (E1-06) or
    /// the file yielded no valid rows at all; the import path reports those as
    /// <see cref="OpstapHerimportDiff.Opmerkingen"/> with <see cref="OpstapHerimportDiff.Overgeslagen"/>
    /// set, not as parse problems. <see cref="IsBestandGeldig"/> is about <i>parsing</i>;
    /// <see cref="IsVolledigVerwerkt"/> is about <i>nothing having been skipped or dropped</i>. A caller
    /// that shows only one of them will tell the reviewer a skipped import succeeded.
    /// </para>
    /// </summary>
    /// <param name="IsBestandGeldig">True when every row of the file mapped cleanly.</param>
    /// <param name="IsVolledigVerwerkt">
    /// True when the file additionally ran to completion: no parse problems <b>and</b> no skip notices.
    /// </param>
    /// <param name="Problemen">
    /// Per-row parse problems. Their <c>reden</c> is deliberately <b>English</b> (see
    /// <see cref="OpstapRijProbleem"/>): a malformed row in the official Op.stap file is not something a
    /// teacher or directie can fix, so it is an operator diagnostic (Art. II.3 as amended 2026-07-30).
    /// </param>
    /// <param name="Diff">
    /// The review report (FR-2.5): what was added, changed, left unchanged, and what disappeared from
    /// Op.stap — including <see cref="OpstapHerimportDiff.VerdwenenMaarGekoppeld"/>, the goals kept and
    /// flagged because teacher content still links them (Art. III.4). Its <c>vereistReview</c> is the
    /// one flag a review screen should key on.
    /// </param>
    /// <param name="Toegepast">False for a preview; true when the changes were committed.</param>
    public sealed record OpstapImportAntwoord(
        bool IsBestandGeldig,
        bool IsVolledigVerwerkt,
        IReadOnlyList<OpstapRijProbleem> Problemen,
        OpstapHerimportDiff Diff,
        bool Toegepast);

    /// <summary>
    /// Parses and diffs one discipline's Op.stap goal Excel <b>without writing anything</b> — the FR-2.5
    /// review step before a re-import is committed.
    /// </summary>
    [HttpPost("voorbeeld")]
    [RequestSizeLimit(MaxBestandsgrootteBytes)]
    public Task<ActionResult<OpstapImportAntwoord>> Voorbeeld(
        [FromForm] OpstapImportInvoer invoer,
        CancellationToken cancellationToken) =>
        VerwerkAsync(invoer, toepassen: false, cancellationToken);

    /// <summary>
    /// Commits one discipline's Op.stap goal Excel: the initial import (FR-2.1) and every re-import
    /// (FR-2.5) go through here. Re-import is idempotent on the leerplandoel <c>code</c>, so running the
    /// same file twice changes nothing.
    /// </summary>
    [HttpPost]
    [RequestSizeLimit(MaxBestandsgrootteBytes)]
    public Task<ActionResult<OpstapImportAntwoord>> Importeer(
        [FromForm] OpstapImportInvoer invoer,
        CancellationToken cancellationToken) =>
        VerwerkAsync(invoer, toepassen: true, cancellationToken);

    private async Task<ActionResult<OpstapImportAntwoord>> VerwerkAsync(
        OpstapImportInvoer invoer,
        bool toepassen,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(invoer.DisciplineNummer))
        {
            return BadRequest(Probleem(
                "Geef het disciplinenummer mee waar dit Op.stap-bestand bij hoort, bijvoorbeeld 1 of 9.2. " +
                "Er is één bestand per discipline."));
        }

        if (invoer.Bestand is null || invoer.Bestand.Length == 0)
        {
            return BadRequest(Probleem("Er is geen bestand meegestuurd."));
        }

        // Extension check only — a real .xlsx that is corrupt is caught by the parser below and reported
        // with a friendlier message than an unhandled exception.
        if (!Path.GetExtension(invoer.Bestand.FileName).Equals(".xlsx", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(Probleem(
                "Alleen .xlsx-bestanden worden ondersteund. Laad het Op.stap-doelenbestand van deze discipline op."));
        }

        OpstapParseResult parseResultaat;
        await using (var stroom = invoer.Bestand.OpenReadStream())
        {
            try
            {
                parseResultaat = _parser.Parse(stroom, invoer.DisciplineNummer);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                // An unreadable workbook is the uploader's problem to fix, not a server fault.
                return BadRequest(Probleem(
                    "Het bestand kon niet gelezen worden als Excel-werkmap (.xlsx). " +
                    "Controleer of het bestand niet beschadigd is."));
            }
        }

        // Curriculum-integrity refusals (unknown discipline, missing minimumdoelen, a code that belongs to
        // another discipline) surface as an `OpstapImportFout` from the import path and are mapped to
        // 400/409 by OpstapImportExceptionHandler (Program.cs) — the same idiom as the three handlers that
        // preceded it. Nothing here reads an EF Core or Npgsql type: the SQLSTATE lives with the DbContext
        // (Art. VIII). Those refusals fire on BOTH paths, before anything is written, so a preview refuses
        // exactly what a commit refuses.
        var resultaat = await _importService.ImporteerAsync(parseResultaat, toepassen, cancellationToken);

        return Ok(new OpstapImportAntwoord(
            IsBestandGeldig: parseResultaat.IsSchoon,
            IsVolledigVerwerkt: parseResultaat.IsSchoon && resultaat.Diff.Opmerkingen.Count == 0,
            parseResultaat.Problemen,
            resultaat.Diff,
            resultaat.Toegepast));
    }

    private static ProblemDetails Probleem(string detail) =>
        new()
        {
            Status = StatusCodes.Status400BadRequest,
            Title = Probleemtitels.OngeldigeAanvraag,
            Detail = detail,
        };

    /// <summary>The multipart form for one discipline's Op.stap goal Excel.</summary>
    public sealed class OpstapImportInvoer
    {
        /// <summary>The .xlsx workbook: one Op.stap goal file, for one discipline (Art. VII.0/VII.1).</summary>
        public IFormFile? Bestand { get; init; }

        /// <summary>
        /// The Op.stap discipline number these rows belong to (e.g. <c>"1"</c>, <c>"9.2"</c>). It is
        /// <b>import context, not a column</b>: the goal Excel has no discipline column (Art. VII.1), so
        /// the caller must state which file it is uploading. Whether the discipline is actually imported
        /// is then decided by the configured selection seam (<c>Opstap:DisciplineSelectie</c>, E1-06), not
        /// by this controller.
        /// </summary>
        public string? DisciplineNummer { get; init; }
    }
}
