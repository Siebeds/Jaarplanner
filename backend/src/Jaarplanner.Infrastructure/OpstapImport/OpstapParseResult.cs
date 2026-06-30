using Jaarplanner.Domain.Curriculum;

namespace Jaarplanner.Infrastructure.OpstapImport;

/// <summary>
/// The outcome of parsing one Op.stap per-discipline goal Excel: the well-formed
/// <see cref="Leerplandoel"/> rows plus any per-row problems. This is a pure parse result —
/// it carries no persistence, diffing, or concordance-graph concerns (those are E1-04/E1-05).
/// <para>
/// <see cref="MinimumdoelRefs"/> exposes the distinct concordance keys (Excel column D)
/// referenced by the parsed leerplandoelen, so E1-04 can build the minimumdoel↔leerplandoel
/// concordance on top of this parser without re-reading the file. Per Art. III, the goal
/// Excel does not carry the decreed minimumdoel <i>omschrijving</i>, so this parser yields
/// the <i>references</i>, not full <see cref="Minimumdoel"/> entities.
/// </para>
/// </summary>
public sealed class OpstapParseResult
{
    /// <summary>Constructs a parse result for the given discipline.</summary>
    /// <param name="disciplineNummer">The discipline number the file was parsed for (Excel-external context).</param>
    /// <param name="leerplandoelen">The well-formed leerplandoelen parsed from the file.</param>
    /// <param name="problemen">The per-row problems for rows that could not be mapped.</param>
    public OpstapParseResult(
        string disciplineNummer,
        IReadOnlyList<Leerplandoel> leerplandoelen,
        IReadOnlyList<OpstapRijProbleem> problemen)
    {
        DisciplineNummer = disciplineNummer;
        Leerplandoelen = leerplandoelen;
        Problemen = problemen;
    }

    /// <summary>The discipline number these rows belong to.</summary>
    public string DisciplineNummer { get; }

    /// <summary>The well-formed leerplandoelen parsed from the file (read-only reference data).</summary>
    public IReadOnlyList<Leerplandoel> Leerplandoelen { get; }

    /// <summary>The per-row problems encountered; empty when every row mapped cleanly.</summary>
    public IReadOnlyList<OpstapRijProbleem> Problemen { get; }

    /// <summary>True when no row-level problems were encountered.</summary>
    public bool IsSchoon => Problemen.Count == 0;

    /// <summary>
    /// The distinct, non-null concordance keys (Excel column D) referenced by the parsed
    /// leerplandoelen, in first-seen order. The building block E1-04 uses to wire up the
    /// minimumdoel↔leerplandoel concordance.
    /// </summary>
    public IReadOnlyList<string> MinimumdoelRefs =>
        Leerplandoelen
            .Select(l => l.MinimumdoelRef)
            .Where(r => r is not null)
            .Select(r => r!)
            .Distinct(StringComparer.Ordinal)
            .ToList();
}
