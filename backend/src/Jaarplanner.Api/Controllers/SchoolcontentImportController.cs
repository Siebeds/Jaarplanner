using Jaarplanner.Api.Infrastructure;
using Jaarplanner.Application.Schoolcontent.Import;
using Jaarplanner.Infrastructure.SchoolcontentImport;
using Microsoft.AspNetCore.Mvc;

namespace Jaarplanner.Api.Controllers;

/// <summary>
/// Thin REST controller (Art. VIII) for the school-content (thema/subthema/activiteit) Excel import
/// (E1-07/E1-08/E1-09 — FR-1.1…1.5).
/// <para>
/// <b>Why this exists.</b> The parser, import service and template generator were all built, tested and
/// DI-registered, but <b>no HTTP entry point invoked them</b> — so nothing could actually be uploaded and
/// the whole FR-1 flow was unreachable in a deployed app. This is that entry point.
/// </para>
/// <para>
/// <b>The two-step flow (FR-1.3).</b> <c>POST voorbeeld</c> parses and diffs without writing anything;
/// the teacher reviews the per-row problems and the diff (including any
/// <see cref="SchoolcontentImportDiff.BedreigdeBeslissingen"/> — teacher decisions an overwrite would
/// lose, Art. IV.2) and only then calls <c>POST</c> to commit. Both run the same logic, so the commit
/// matches the preview for the same file and options.
/// </para>
/// <para>
/// <b>Partial files.</b> Malformed rows are reported and excluded, never silently dropped
/// (ADR-0006 §4); the well-formed rows still import. That is why the preview step exists — the teacher
/// sees exactly which rows were rejected before committing. A file whose <i>header</i> is wrong yields no
/// rows at all and is skipped wholesale, because a shifted layout cannot be read safely.
/// </para>
/// </summary>
[ApiController]
[Route("api/schoolcontent-import")]
public sealed class SchoolcontentImportController : ControllerBase
{
    /// <summary>Upload cap. A school-content sheet is a few thousand rows at most; this is generous.</summary>
    private const long MaxBestandsgrootteBytes = 10 * 1024 * 1024;

    private readonly ISchoolcontentParser _parser;
    private readonly ISchoolcontentImportService _importService;
    private readonly ISchoolcontentTemplateGenerator _templateGenerator;

    public SchoolcontentImportController(
        ISchoolcontentParser parser,
        ISchoolcontentImportService importService,
        ISchoolcontentTemplateGenerator templateGenerator)
    {
        _parser = parser;
        _importService = importService;
        _templateGenerator = templateGenerator;
    }

    /// <summary>
    /// The response for a preview or a commit: the row problems plus the diff.
    /// <para>
    /// <b>Two separate notions of "clean", deliberately.</b> A file can parse perfectly and still lose
    /// content during the import — an unknown leerplandoel code, a 4th themadoel, a subthema naming a klas
    /// that does not exist. Those are reported in <see cref="SchoolcontentImportDiff.Opmerkingen"/>, not in
    /// <see cref="Problemen"/>. Collapsing both into one flag meant an upload that silently discarded a
    /// typo'd goal code still answered "geldig", so a UI trusting that flag would tell the teacher the file
    /// was fine. <see cref="IsBestandGeldig"/> is about <i>parsing</i>; <see cref="IsVolledigVerwerkt"/> is
    /// about <i>nothing having been dropped</i>. Show a warning unless both are true.
    /// </para>
    /// </summary>
    /// <param name="IsBestandGeldig">True when the file parsed with no per-row or file-level problems.</param>
    /// <param name="IsVolledigVerwerkt">
    /// True when the import additionally discarded nothing — no problems <b>and</b> no opmerkingen.
    /// </param>
    /// <param name="Problemen">Per-row and file-level parse problems, in Dutch (FR-1.2).</param>
    /// <param name="Diff">What changed (or would change) per thema/subthema/activiteit, incl. opmerkingen.</param>
    /// <param name="Toegepast">False for a preview; true when the changes were committed.</param>
    public sealed record ImportAntwoord(
        bool IsBestandGeldig,
        bool IsVolledigVerwerkt,
        IReadOnlyList<SchoolcontentRijProbleem> Problemen,
        SchoolcontentImportDiff Diff,
        bool Toegepast);

    /// <summary>
    /// Downloads the import template (FR-1.5, E1-09) — header + one worked example row, generated from
    /// the same single-source column mapping the parser reads, so the two can never drift (Art. III.3).
    /// </summary>
    [HttpGet("sjabloon")]
    public IActionResult Sjabloon()
    {
        var stream = _templateGenerator.GenereerTemplate();

        return File(
            stream,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "jaarplanner-schoolcontent-sjabloon.xlsx");
    }

    /// <summary>Parses and diffs the upload without writing anything (FR-1.3 preview).</summary>
    [HttpPost("voorbeeld")]
    [RequestSizeLimit(MaxBestandsgrootteBytes)]
    public Task<ActionResult<ImportAntwoord>> Voorbeeld(
        [FromForm] SchoolcontentImportInvoer invoer,
        CancellationToken cancellationToken) =>
        VerwerkAsync(invoer, toepassen: false, cancellationToken);

    /// <summary>Parses and commits the upload (FR-1.4).</summary>
    [HttpPost]
    [RequestSizeLimit(MaxBestandsgrootteBytes)]
    public Task<ActionResult<ImportAntwoord>> Importeer(
        [FromForm] SchoolcontentImportInvoer invoer,
        CancellationToken cancellationToken) =>
        VerwerkAsync(invoer, toepassen: true, cancellationToken);

    private async Task<ActionResult<ImportAntwoord>> VerwerkAsync(
        SchoolcontentImportInvoer invoer,
        bool toepassen,
        CancellationToken cancellationToken)
    {
        if (invoer.Bestand is null || invoer.Bestand.Length == 0)
        {
            return BadRequest(Probleem("Er is geen bestand meegestuurd."));
        }

        // Extension check only — a real xlsx that is corrupt is caught by the parser below and reported
        // as a file-level problem, which is the friendlier place for it.
        if (!Path.GetExtension(invoer.Bestand.FileName).Equals(".xlsx", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(Probleem(
                "Alleen .xlsx-bestanden worden ondersteund. Download de importsjabloon en vul die in."));
        }

        SchoolcontentParseResult parseResultaat;
        await using (var stroom = invoer.Bestand.OpenReadStream())
        {
            try
            {
                parseResultaat = _parser.Parse(stroom);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                // An unreadable/corrupt workbook is the teacher's problem to fix, not a server fault —
                // surface it as a 400 with a Dutch message instead of a 500 (ADR-0006 §4).
                return BadRequest(Probleem(
                    "Het bestand kon niet gelezen worden als Excel-werkmap (.xlsx). " +
                    "Controleer of het bestand niet beschadigd is."));
            }
        }

        var opties = new SchoolcontentImportOpties(
            invoer.Modus ?? SchoolcontentImportModus.Toevoegen,
            invoer.MenselijkeBeslissingenVerwijderen);

        var resultaat = await _importService.ImporteerAsync(parseResultaat, opties, toepassen, cancellationToken);

        return Ok(new ImportAntwoord(
            IsBestandGeldig: parseResultaat.IsGeldig,
            IsVolledigVerwerkt: parseResultaat.IsGeldig && resultaat.Diff.Opmerkingen.Count == 0,
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

    /// <summary>The multipart form for an import upload.</summary>
    public sealed class SchoolcontentImportInvoer
    {
        /// <summary>The .xlsx workbook.</summary>
        public IFormFile? Bestand { get; init; }

        /// <summary>Add-only (default) or update/overwrite matching content (FR-1.3/1.4).</summary>
        public SchoolcontentImportModus? Modus { get; init; }

        /// <summary>
        /// The Art. IV.2 opt-in: discard teacher-set goal links the new file no longer carries. Defaults
        /// to false, so a re-import never destroys a human decision unless the teacher confirmed it.
        /// </summary>
        public bool MenselijkeBeslissingenVerwijderen { get; init; }
    }
}
