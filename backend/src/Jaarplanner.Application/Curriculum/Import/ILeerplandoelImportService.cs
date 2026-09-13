namespace Jaarplanner.Application.Curriculum.Import;

/// <summary>
/// Imports the Op.stap leerplandoelen from KOV's API (E1-21, ADR-0032): reads one numbered snapshot through
/// <see cref="ILeerplandoelBron"/> and feeds it, one discipline at a time, to the same non-destructive re-import the Excel
/// route uses, so the <c>NietMeerInOpstap</c> flag, the review diff and the integrity preflight are shared rather than
/// rewritten.
/// <para>
/// <b>All or nothing on apply.</b> The disciplines are written inside one transaction, together with the record of the
/// version that was applied, so a refusal in the tenth discipline leaves the first nine as they were.
/// </para>
/// </summary>
public interface ILeerplandoelImportService
{
    /// <summary>Reads the snapshot, computes the review report and, when <paramref name="toepassen"/> is true, applies it.</summary>
    /// <param name="versie">
    /// The numbered snapshot to read. For a preview it may be null, which reads the newest numbered version and names it
    /// in the answer. <b>An apply must name it</b>: it is the version the reviewer saw, so what is written is exactly what
    /// was reviewed even if KOV publishes a newer one in between.
    /// </param>
    /// <param name="toepassen">False for the preview (FR-2.5): nothing is written. True to commit.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <exception cref="ArgumentException">An apply without a version.</exception>
    /// <exception cref="OpstapBronFout">The source was refused as a whole. Nothing has been written.</exception>
    /// <exception cref="OpstapImportFout">
    /// A discipline cannot be imported (a concordance to a minimumdoel that is not loaded, a code stored under another
    /// discipline). Raised on the preview too; on an apply nothing has been written.
    /// </exception>
    Task<LeerplandoelImportResultaat> ImporteerAsync(
        string? versie,
        bool toepassen,
        CancellationToken cancellationToken = default);
}

/// <summary>The answer to one leerplandoelen import or preview.</summary>
/// <param name="Versie">The numbered snapshot that was read.</param>
/// <param name="Hash">The hash KOV publishes for it.</param>
/// <param name="SnapshotTijdstip">When KOV published it, when it says so.</param>
/// <param name="VorigeVersie">The version the last applied import read, or null when none was ever applied.</param>
/// <param name="Wijzigingslog">KOV's changelog for this version as plain text, or null.</param>
/// <param name="Disciplines">One report per discipline in the snapshot.</param>
/// <param name="OvergeslagenDoelsets">Goals of the skipped goal sets, counted per set over the whole snapshot.</param>
/// <param name="Problemen">G goals that were not imported, and why (operator diagnostics, English).</param>
/// <param name="Toegepast">False for a preview; true when the apply committed.</param>
public sealed record LeerplandoelImportResultaat(
    string Versie,
    string Hash,
    DateTimeOffset? SnapshotTijdstip,
    OpstapversieWeergave? VorigeVersie,
    string? Wijzigingslog,
    IReadOnlyList<LeerplandoelDisciplineResultaat> Disciplines,
    IReadOnlyList<DoelsetTelling> OvergeslagenDoelsets,
    IReadOnlyList<LeerplandoelBronProbleem> Problemen,
    bool Toegepast);

/// <summary>One discipline's part of the report.</summary>
/// <param name="DisciplineNummer">This repo's discipline number (<c>9.1</c>).</param>
/// <param name="DisciplineNaam">The discipline's title as KOV writes it.</param>
/// <param name="Diff">
/// The review report of the shared re-import (FR-2.5). <c>Overgeslagen</c> with a notice when the discipline is outside
/// the configured selection, unknown to this application, or has no usable goal.
/// </param>
/// <param name="OvergeslagenDoelsets">This discipline's goals in skipped goal sets, per set.</param>
/// <param name="Problemen">This discipline's G goals that were not imported, and why.</param>
public sealed record LeerplandoelDisciplineResultaat(
    string DisciplineNummer,
    string DisciplineNaam,
    OpstapHerimportDiff Diff,
    IReadOnlyList<DoelsetTelling> OvergeslagenDoelsets,
    IReadOnlyList<LeerplandoelBronProbleem> Problemen);

/// <summary>An applied import, as the report names it.</summary>
/// <param name="Versie">The numbered snapshot it read.</param>
/// <param name="Hash">KOV's hash for it.</param>
/// <param name="ToegepastOp">When it was applied.</param>
public sealed record OpstapversieWeergave(string Versie, string Hash, DateTimeOffset ToegepastOp);
