namespace Jaarplanner.Infrastructure.SchoolcontentImport;

/// <summary>
/// Generates the downloadable school-content (thema/subthema/activiteit) import template .xlsx
/// (FR-1.5, Gap A.4, backlog E1-09). The template's header row and one worked example row are emitted
/// from the <b>same single-source</b> column mapping the parser reads
/// (<see cref="SchoolcontentKolom"/> / <see cref="SchoolcontentKolommen"/>, Art. III.3) so the
/// template and <see cref="ISchoolcontentParser"/> can never drift: a column move is a one-line change
/// in the enum and both the parser and this template follow automatically. ClosedXML/MIT only
/// (Art. VIII — no EPPlus). The layout is provisional (Art. XIV — "Thema/activiteit Excel structure").
/// </summary>
public interface ISchoolcontentTemplateGenerator
{
    /// <summary>
    /// Builds the import template workbook as a seekable <see cref="MemoryStream"/> positioned at 0.
    /// The caller owns the stream (dispose it / let the framework stream it to the client).
    /// </summary>
    MemoryStream GenereerTemplate();
}
