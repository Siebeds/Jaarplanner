namespace Jaarplanner.Infrastructure.SchoolcontentImport;

/// <summary>
/// Parses and validates one school-content (thema/subthema/activiteit) import Excel into a
/// <see cref="SchoolcontentParseResult"/>. This is a <b>pure parser/validator</b> (FR-1.1/1.2):
/// it reads a workbook stream, validates required columns/fields, and produces validated rows plus
/// clear per-row problems. It does <b>not</b> persist, build the hierarchy, resolve goal links, or
/// preview/commit (those are E1-08+). Columns are read exclusively through the single-source
/// <see cref="SchoolcontentKolom"/> mapping (Art. III.3).
/// </summary>
public interface ISchoolcontentParser
{
    /// <summary>Parses and validates the school-content Excel.</summary>
    /// <param name="excelStroom">A readable stream over the .xlsx workbook.</param>
    /// <returns>The validated rows plus any per-row/file-level problems.</returns>
    SchoolcontentParseResult Parse(Stream excelStroom);
}
