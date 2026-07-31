using Jaarplanner.Api.Infrastructure;
using Jaarplanner.Application.Curriculum.Import;
using Jaarplanner.Infrastructure.OpstapImport;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.Api.Controllers;

/// <summary>
/// Thin REST controller (Art. VIII) that <b>triggers</b> the Op.stap curriculum import: an initial
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
/// linked by teacher content, and only then calls <c>POST</c> to commit. Both paths run the same
/// logic, so the commit matches the preview for the same file and discipline.
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
/// (Art. VI.1, ADR-0011 §2), which today authorises everyone because the API has no authenticated user
/// at all. See that class for what E6-02 changes.
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

        OpstapImportResultaat resultaat;
        try
        {
            resultaat = await _importService.ImporteerAsync(parseResultaat, toepassen, cancellationToken);
        }
        catch (DbUpdateException ex) when (OntbrekendeMinimumdoelen(ex))
        {
            // The E1-12 gap, reached honestly rather than as a 500. `Leerplandoel.MinimumdoelRef` is a
            // Restrict FK on `minimumdoelen.Ref` and NOTHING in the codebase can insert a Minimumdoel yet
            // (the per-discipline goal Excel carries no decreed `omschrijving` — Art. VII.1), so a real
            // Op.stap file's MD-concorded rows cannot commit. Pinned since E1-04 by
            // `ReferentiedataIntegriteitTests.Leerplandoel_met_concordantie_zonder_minimumdoel_wordt_geweigerd`;
            // this maps it to an answer the caller can act on. Not "fixed" here: the fix is E1-12's decreed
            // import, and inventing minimumdoel rows from the goal file would fabricate decreed content
            // (Art. III.1). The whole import is one SaveChanges, so the failure leaves the curriculum
            // exactly as it was.
            return Conflict(new ProblemDetails
            {
                Status = StatusCodes.Status409Conflict,
                Title = "Import niet doorgevoerd",
                Detail =
                    "Deze leerplandoelen verwijzen naar minimumdoelen die nog niet ingeladen zijn, dus ze " +
                    "kunnen nog niet bewaard worden. Laad eerst de decretale minimumdoelen in. " +
                    "Er is niets gewijzigd aan de doelen die al in de toepassing staan.",
            });
        }
        catch (DbUpdateException ex) when (OnbekendeDiscipline(ex))
        {
            // A discipline number that is not in the official Op.stap list (Art. VII.0), answered by the
            // database's own seeded taxonomy rather than by a list compiled in here.
            return BadRequest(Probleem(
                $"'{invoer.DisciplineNummer}' is geen Op.stap-discipline. " +
                "Gebruik het officiële disciplinenummer, bijvoorbeeld 1 voor Nederlands en communicatie " +
                "of 9.2 voor Leren leren."));
        }
        catch (DbUpdateException ex) when (CodeBestaatAlElders(ex))
        {
            // Found by running this trigger by hand, which is the only way it could be found: the import
            // scopes its diff to ONE discipline, so a code already loaded under a DIFFERENT discipline is
            // invisible to the diff and reaches the database as an insert on an existing primary key. The
            // realistic cause is a file uploaded under the wrong discipline number, and the realistic fix
            // is for the uploader to correct that, so it is answered rather than left as a 500. The
            // curriculum is unchanged: the import is a single SaveChanges.
            return Conflict(new ProblemDetails
            {
                Status = StatusCodes.Status409Conflict,
                Title = "Import niet doorgevoerd",
                Detail =
                    "Een of meer codes uit dit bestand bestaan al onder een andere discipline. " +
                    $"Controleer of dit bestand bij discipline {invoer.DisciplineNummer} hoort. " +
                    "Er is niets gewijzigd aan de doelen die al in de toepassing staan.",
            });
        }

        return Ok(new OpstapImportAntwoord(
            IsBestandGeldig: parseResultaat.IsSchoon,
            IsVolledigVerwerkt: parseResultaat.IsSchoon && resultaat.Diff.Opmerkingen.Count == 0,
            parseResultaat.Problemen,
            resultaat.Diff,
            resultaat.Toegepast));
    }

    /// <summary>
    /// True when the write failed on the concordance FK (<c>leerplandoelen.MinimumdoelRef</c> →
    /// <c>minimumdoelen.Ref</c>), i.e. the E1-12 gap. Matched on the FK constraint name so a different
    /// integrity failure is <b>not</b> disguised as this one: anything unrecognised keeps bubbling up as
    /// a 500, because a curriculum write that fails for an unknown reason must stay loud.
    /// </summary>
    private static bool OntbrekendeMinimumdoelen(DbUpdateException ex) =>
        IsForeignKeyBreuk(ex, "minimumdoel");

    /// <summary>True when the write failed on the discipline FK (an unknown discipline number).</summary>
    private static bool OnbekendeDiscipline(DbUpdateException ex) =>
        IsForeignKeyBreuk(ex, "discipline");

    /// <summary>
    /// True when the write failed on the leerplandoel primary key (SQLSTATE 23505 on
    /// <c>PK_leerplandoelen</c>): the file carries a code that is already loaded under another discipline.
    /// </summary>
    private static bool CodeBestaatAlElders(DbUpdateException ex) =>
        ex.InnerException is Npgsql.PostgresException { SqlState: "23505" } fout &&
        fout.ConstraintName?.Contains("leerplandoelen", StringComparison.OrdinalIgnoreCase) == true;

    /// <summary>
    /// True when the inner fault is a PostgreSQL foreign-key violation (SQLSTATE 23503) whose constraint
    /// name mentions <paramref name="tabelFragment"/>. Provider-specific by necessity: the constraint
    /// name is the only thing that says <i>which</i> reference was missing, and the two cases need
    /// different answers. The same SQLSTATE-plus-constraint reading is already used in
    /// <c>KlasBeheerService</c> / <c>SchooljaarBeheerService</c> (for 23505).
    /// </summary>
    private static bool IsForeignKeyBreuk(DbUpdateException ex, string tabelFragment) =>
        ex.InnerException is Npgsql.PostgresException { SqlState: "23503" } fout &&
        fout.ConstraintName?.Contains(tabelFragment, StringComparison.OrdinalIgnoreCase) == true;

    private static ProblemDetails Probleem(string detail) =>
        new()
        {
            Status = StatusCodes.Status400BadRequest,
            Title = "Ongeldige aanvraag",
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
