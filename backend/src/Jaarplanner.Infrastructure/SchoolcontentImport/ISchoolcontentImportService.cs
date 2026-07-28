using Jaarplanner.Application.Schoolcontent.Import;

namespace Jaarplanner.Infrastructure.SchoolcontentImport;

/// <summary>
/// Persists a parsed school-content (thema/subthema/activiteit) Excel into the autonomous themalaag
/// (Art. IX.2) and guarantees a <b>non-destructive</b> re-import (FR-1.3/1.4, Art. IV.2 — the analogue
/// of the Op.stap <c>IOpstapImportService</c> for school content).
/// <para>
/// It supports a two-step "preview then commit": with <c>toepassen: false</c> nothing is written and the
/// caller gets a <see cref="SchoolcontentImportDiff"/> describing exactly what would change; with
/// <c>toepassen: true</c> the same computation is applied. Because preview and commit run the <b>same</b>
/// diff logic, the committed result matches the preview for the same input + options.
/// </para>
/// <para>
/// On re-import the caller chooses <see cref="SchoolcontentImportModus.Toevoegen"/> (add new only, never
/// touch existing) or <see cref="SchoolcontentImportModus.Bijwerken"/> (update matching content). In
/// update mode, teacher-set <c>DoelKoppeling</c> statuses (<c>aanvaard</c>/<c>geweigerd</c>/<c>manueel</c>)
/// are <b>preserved</b> by default; the only way to discard one is the explicit
/// <see cref="SchoolcontentImportOpties.MenselijkeBeslissingenVerwijderen"/> opt-in, and even then only
/// links the file no longer carries. A re-import never silently destroys a human decision (Art. IV.2).
/// </para>
/// </summary>
public interface ISchoolcontentImportService
{
    /// <summary>
    /// Computes the re-import diff and (optionally) commits it for the parsed school content.
    /// </summary>
    /// <param name="parseResultaat">The validated school-content rows (E1-07).</param>
    /// <param name="opties">The re-import mode + the Art. IV.2 discard switch.</param>
    /// <param name="toepassen">
    /// When <c>true</c> the changes are committed; when <c>false</c> nothing is written and the caller
    /// gets the diff as a preview (FR-1.3 "show a preview before commit").
    /// </param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>The reviewable diff and whether it was applied.</returns>
    Task<SchoolcontentImportResultaat> ImporteerAsync(
        SchoolcontentParseResult parseResultaat,
        SchoolcontentImportOpties opties,
        bool toepassen,
        CancellationToken cancellationToken = default);
}
