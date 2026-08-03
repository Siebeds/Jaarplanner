namespace Jaarplanner.Infrastructure.SchoolcontentImport;

/// <summary>
/// A single per-row validation problem from the school-content (thema/subthema/activiteit) import.
/// Mirrors the Op.stap parser's <c>OpstapRijProbleem</c>: the validator <b>reports</b> malformed
/// rows rather than silently dropping them (ADR-0006 §4: clear per-row diagnostics, Art. V.6), so
/// the upload UI (E1-13) can show the teacher precisely which row is wrong and why before committing.
/// </summary>
/// <param name="RijNummer">
/// The 1-based Excel row number the problem occurred on, or <b>0</b> for a problem that belongs to the
/// file rather than to a row (no worksheet, no header row). A renderer must not print "rij 0".
/// </param>
/// <param name="Melding">
/// A clear, <b>Dutch</b>, user-facing message identifying the problem (FR-1.2). Dutch because the file
/// was written by a teacher and only a teacher can fix it, which is exactly the actionable side of the
/// Art. II.3 split as amended 2026-07-30 — so the SPA renders this string verbatim. (An earlier revision
/// of this comment said it "must travel through <c>nl.json</c>"; that reading was superseded by the
/// amendment, which scopes the catalogue rule to copy the frontend authors itself. A diagnostic naming a
/// row number and a column cannot be assembled from a static catalogue.)
/// </param>
/// <param name="Kolom">The column the problem relates to, if a single column is at fault (helps locate it).</param>
public sealed record SchoolcontentRijProbleem(int RijNummer, string Melding, SchoolcontentKolom? Kolom = null)
{
    /// <summary>
    /// The Dutch header label of <see cref="Kolom"/> as it appears in row 1 of the sheet, or null when the
    /// problem is not tied to one column.
    /// <para>
    /// It is <b>derived</b>, from the same single source the parser and the template generator read
    /// (Art. III.3). The alternative was for the frontend to hold its own enum-name to column-label table so
    /// it could name the offending column on screen (FR-1.2), which would have put a second copy of the
    /// layout outside this assembly — precisely what Art. III.3 exists to prevent. Serialised as
    /// <c>kolomLabel</c>; no construction site changes.
    /// </para>
    /// </summary>
    public string? KolomLabel => Kolom is null ? null : SchoolcontentKolommen.Label(Kolom.Value);
}
