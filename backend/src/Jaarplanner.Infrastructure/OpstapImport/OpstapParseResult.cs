using Jaarplanner.Application.Curriculum.Import;
using Jaarplanner.Domain.Curriculum;

namespace Jaarplanner.Infrastructure.OpstapImport;

/// <summary>
/// The outcome of reading one discipline's Op.stap goals, from a per-discipline Excel (E1-03) or from KOV's API (E1-21):
/// the well-formed <see cref="Leerplandoel"/> rows plus what the source named without delivering. This is a pure read
/// result — it carries no persistence, diffing, or concordance-graph concerns (those are E1-04/E1-05).
/// <para>
/// <see cref="MinimumdoelRefs"/> exposes the distinct concordance keys (Excel column D)
/// referenced by the parsed leerplandoelen, so E1-04 can build the minimumdoel↔leerplandoel
/// concordance on top of this parser without re-reading the file. Per Art. III, the goal
/// Excel does not carry the decreed minimumdoel <i>omschrijving</i>, so this parser yields
/// the <i>references</i>, not full <see cref="Minimumdoel"/> entities.
/// </para>
/// <para>
/// <b>Named but not delivered (E1-21).</b> A re-import must tell a goal that left Op.stap from one that is still there
/// but was not read this time, or it flags a goal <c>NietMeerInOpstap</c> that Op.stap still contains (the defect E1-12's
/// audits found for minimumdoelen). <see cref="NietIngelezenCodes"/> and <see cref="BuitenBereikCodes"/> carry those codes
/// to the import service.
/// </para>
/// </summary>
public sealed class OpstapParseResult
{
    /// <summary>Constructs a parse result for the given discipline.</summary>
    /// <param name="disciplineNummer">The discipline number the rows belong to.</param>
    /// <param name="leerplandoelen">The well-formed leerplandoelen.</param>
    /// <param name="problemen">The per-row problems for Excel rows that could not be mapped.</param>
    /// <param name="herkomst">Where the rows came from; decides the wording of the import's notices.</param>
    /// <param name="nietIngelezenCodes">Codes the source names whose goal could not be read (see the property).</param>
    /// <param name="buitenBereikCodes">Codes the source names under a goal set the import does not take.</param>
    public OpstapParseResult(
        string disciplineNummer,
        IReadOnlyList<Leerplandoel> leerplandoelen,
        IReadOnlyList<OpstapRijProbleem> problemen,
        OpstapHerkomst herkomst = OpstapHerkomst.Bestand,
        IReadOnlyCollection<string>? nietIngelezenCodes = null,
        IReadOnlyCollection<string>? buitenBereikCodes = null)
    {
        DisciplineNummer = disciplineNummer;
        Leerplandoelen = leerplandoelen;
        Problemen = problemen;
        Herkomst = herkomst;
        NietIngelezenCodes = nietIngelezenCodes ?? [];
        BuitenBereikCodes = buitenBereikCodes ?? [];
    }

    /// <summary>The discipline number these rows belong to.</summary>
    public string DisciplineNummer { get; }

    /// <summary>The well-formed leerplandoelen (read-only reference data).</summary>
    public IReadOnlyList<Leerplandoel> Leerplandoelen { get; }

    /// <summary>The per-row problems encountered; empty when every row mapped cleanly.</summary>
    public IReadOnlyList<OpstapRijProbleem> Problemen { get; }

    /// <summary>Where the rows came from.</summary>
    public OpstapHerkomst Herkomst { get; }

    /// <summary>
    /// Codes the source names whose goal could not be read (an Op.stap goal the mapping refused). The import leaves a
    /// stored row with such a code untouched and reports it apart. On the Excel path the codes of <see cref="Problemen"/>
    /// are treated the same way.
    /// </summary>
    public IReadOnlyCollection<string> NietIngelezenCodes { get; }

    /// <summary>
    /// Codes the source names under a goal set this import does not take (only G is imported, owner ruling 2026-09-11).
    /// The import leaves a stored row with such a code untouched and does not call it disappeared.
    /// </summary>
    public IReadOnlyCollection<string> BuitenBereikCodes { get; }

    /// <summary>True when no row-level problems were encountered.</summary>
    public bool IsSchoon => Problemen.Count == 0;

    /// <summary>
    /// The distinct, non-null concordance keys (Excel column D)
    /// referenced by the parsed leerplandoelen, in first-seen order. The building block E1-04 uses to wire up the
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
