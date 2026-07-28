namespace Jaarplanner.Infrastructure.SchoolcontentImport;

/// <summary>
/// A single per-row validation problem from the school-content (thema/subthema/activiteit) import.
/// Mirrors the Op.stap parser's <c>OpstapRijProbleem</c>: the validator <b>reports</b> malformed
/// rows rather than silently dropping them (ADR-0006 §4: clear per-row diagnostics, Art. V.6), so
/// the upload UI (E1-08) can show the teacher precisely which row is wrong and why before committing.
/// </summary>
/// <param name="RijNummer">The 1-based Excel row number the problem occurred on.</param>
/// <param name="Melding">
/// A clear, <b>Dutch</b>, user-facing message identifying the problem (FR-1.2). User-facing because
/// non-technical teachers read it directly; if surfaced via the SPA it must travel through
/// <c>frontend/src/i18n/nl.json</c> (Art. II), but at this parser/service layer the Dutch message
/// is produced here.
/// </param>
/// <param name="Kolom">The column the problem relates to, if a single column is at fault (helps locate it).</param>
public sealed record SchoolcontentRijProbleem(int RijNummer, string Melding, SchoolcontentKolom? Kolom = null);
