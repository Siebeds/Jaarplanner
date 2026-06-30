namespace Jaarplanner.Infrastructure.SchoolcontentImport;

/// <summary>
/// The outcome of validating one school-content (thema/subthema/activiteit) import Excel: the
/// well-formed <see cref="SchoolcontentRij"/> rows plus any per-row problems. Mirrors the Op.stap
/// parser's <c>OpstapParseResult</c>. This is a pure parse/validation result — it carries no
/// persistence, hierarchy building, or goal-link resolution (those are E1-08).
/// <para>
/// <b>Report, don't drop (ADR-0006 §4).</b> A malformed row is reported in <see cref="Problemen"/>
/// and excluded from <see cref="Rijen"/>; good rows still parse. A header-only or missing required
/// header column is a file-level problem and is also reported here.
/// </para>
/// </summary>
public sealed class SchoolcontentParseResult
{
    /// <summary>Constructs a parse/validation result.</summary>
    /// <param name="rijen">The well-formed, validated rows.</param>
    /// <param name="problemen">The per-row (and file-level) problems found.</param>
    public SchoolcontentParseResult(
        IReadOnlyList<SchoolcontentRij> rijen,
        IReadOnlyList<SchoolcontentRijProbleem> problemen)
    {
        Rijen = rijen;
        Problemen = problemen;
    }

    /// <summary>The well-formed, validated school-content rows ready for E1-08 to commit.</summary>
    public IReadOnlyList<SchoolcontentRij> Rijen { get; }

    /// <summary>The per-row and file-level problems; empty when every row validated cleanly.</summary>
    public IReadOnlyList<SchoolcontentRijProbleem> Problemen { get; }

    /// <summary>True when no problems were found — a clean file the upload can proceed with (FR-1.1).</summary>
    public bool IsGeldig => Problemen.Count == 0;
}
