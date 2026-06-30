namespace Jaarplanner.Application.Schoolcontent.Import;

/// <summary>
/// The options for one school-content (re-)import: the chosen <see cref="Modus"/> and the explicit,
/// safe-by-default switch that governs whether teacher-set goal links may be discarded on overwrite.
/// </summary>
/// <param name="Modus">
/// add (<see cref="SchoolcontentImportModus.Toevoegen"/>) vs update/overwrite
/// (<see cref="SchoolcontentImportModus.Bijwerken"/>) — FR-1.3/1.4.
/// </param>
/// <param name="MenselijkeBeslissingenVerwijderen">
/// <b>The Art. IV.2 safety switch.</b> When overwriting, a goal link with a teacher-set status
/// (<c>aanvaard</c>/<c>geweigerd</c>/<c>manueel</c>) that the new file no longer carries is, by default
/// (<c>false</c>), <b>kept</b> — never silently destroyed — and the preview warns that it would be lost.
/// Only an explicit caller opt-in (<c>true</c>, i.e. the user confirmed the warning) discards those human
/// decisions. AI-only <c>voorgesteld</c> links are not human decisions and may always be replaced.
/// </param>
public readonly record struct SchoolcontentImportOpties(
    SchoolcontentImportModus Modus,
    bool MenselijkeBeslissingenVerwijderen = false)
{
    /// <summary>The default: add-mode, never discarding human decisions.</summary>
    public static SchoolcontentImportOpties Toevoegen => new(SchoolcontentImportModus.Toevoegen);

    /// <summary>Update/overwrite mode, preserving teacher decisions (the safe default for overwrite).</summary>
    public static SchoolcontentImportOpties Bijwerken => new(SchoolcontentImportModus.Bijwerken);
}
