namespace Jaarplanner.Application.Schoolcontent.Import;

/// <summary>
/// The re-import behaviour the caller chooses for school content (thema/subthema/activiteit) —
/// FR-1.3/1.4. On a first import the two modes behave identically (everything is new); they only
/// differ when content already exists for a matching key.
/// </summary>
public enum SchoolcontentImportModus
{
    /// <summary>
    /// <b>toevoegen</b> — add new content only. Content whose match key already exists is left
    /// completely untouched (its attributes <i>and</i> its <see cref="Domain.Schoolcontent.DoelKoppeling"/>
    /// statuses), so an "add" re-import can never clobber existing data.
    /// </summary>
    Toevoegen = 0,

    /// <summary>
    /// <b>bijwerken/overschrijven</b> — update existing matching content with the file's attributes
    /// (and add anything new). Teacher-set <see cref="Domain.Schoolcontent.DoelKoppeling"/> statuses
    /// (<c>aanvaard</c>/<c>geweigerd</c>/<c>manueel</c>) are <b>preserved</b> by default; a koppeling the
    /// file no longer carries is only discarded when <see cref="SchoolcontentImportOpties.MenselijkeBeslissingenVerwijderen"/>
    /// is explicitly set — otherwise the preview warns and the link survives (Art. IV.2).
    /// </summary>
    Bijwerken = 1,
}
