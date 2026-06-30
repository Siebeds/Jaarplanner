using Jaarplanner.Application.Curriculum.Import;

namespace Jaarplanner.Infrastructure.OpstapImport;

/// <summary>
/// The single sanctioned writer of official Op.stap reference data (Art. III.1): it persists the
/// parsed leerplandoelen of one discipline into the database and guarantees a <b>non-destructive</b>
/// re-import (Art. III.4 / IV.2 / FR-2.5).
/// <para>
/// Normal application code never mutates a <c>Leerplandoel</c> (private setters, no mutators). This
/// service is the one boundary that may refresh official content, and it does so only from a parsed
/// Op.stap file. Re-import is <b>idempotent</b> on identity (<c>code</c>): first import inserts,
/// re-import updates only the rows whose content changed, and:
/// </para>
/// <list type="bullet">
/// <item>existing jaarplannen and teacher <c>DoelKoppeling</c> statuses are never overwritten;</item>
/// <item>a goal that disappeared from Op.stap but is still referenced is <b>flagged</b>, never deleted
/// (the FK is <c>Restrict</c>);</item>
/// <item>every change is reported in a reviewable <see cref="OpstapHerimportDiff"/>.</item>
/// </list>
/// </summary>
public interface IOpstapImportService
{
    /// <summary>
    /// Computes the re-import diff and (optionally) applies it for the parse result's discipline.
    /// </summary>
    /// <param name="parseResultaat">The parsed Op.stap goal Excel for one discipline (E1-03).</param>
    /// <param name="toepassen">
    /// When <c>true</c>, the changes are committed (upsert + flagging). When <c>false</c>, nothing is
    /// written — the caller gets the diff as a preview (FR-2.5 "signal what must be reviewed").
    /// </param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>The reviewable diff and whether it was applied.</returns>
    Task<OpstapImportResultaat> ImporteerAsync(
        OpstapParseResult parseResultaat,
        bool toepassen,
        CancellationToken cancellationToken = default);
}
