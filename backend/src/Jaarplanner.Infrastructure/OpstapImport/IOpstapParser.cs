namespace Jaarplanner.Infrastructure.OpstapImport;

/// <summary>
/// Parses one Op.stap per-discipline goal Excel into <see cref="OpstapParseResult"/>.
/// This is a <b>pure parser/mapper</b>: it reads a workbook stream and maps rows to
/// read-only curriculum entities. It does not persist, diff, or re-import — those are
/// E1-04/E1-05. The implementation reads columns exclusively through the single-source
/// <see cref="OpstapKolom"/> mapping (Art. III.3, VII.1).
/// </summary>
public interface IOpstapParser
{
    /// <summary>
    /// Parses the goal Excel for one discipline. The caller supplies the discipline number
    /// (the file is per-discipline; the discipline is import context, not a sheet column).
    /// </summary>
    /// <param name="excelStroom">A readable stream over the .xlsx workbook.</param>
    /// <param name="disciplineNummer">The discipline number these rows belong to (e.g. "1", "9.2").</param>
    /// <returns>The parsed leerplandoelen plus any per-row problems.</returns>
    OpstapParseResult Parse(Stream excelStroom, string disciplineNummer);
}
