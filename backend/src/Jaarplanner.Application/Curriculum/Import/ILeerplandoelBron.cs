using Jaarplanner.Domain.Curriculum;

namespace Jaarplanner.Application.Curriculum.Import;

/// <summary>
/// Where the Op.stap leerplandoelen come from (E1-21, ADR-0032). A port, so the import logic runs in tests without a
/// network and the source can change without touching it. The one implementation reads KOV's <c>krcItems</c>.
/// </summary>
public interface ILeerplandoelBron
{
    /// <summary>
    /// Reads one <b>numbered</b> snapshot of the curriculum, mapped per discipline to <see cref="Leerplandoel"/>, keeping
    /// goal set G only (owner ruling 2026-09-11) and counting what it skipped.
    /// </summary>
    /// <param name="versie">
    /// The snapshot to read, e.g. <c>1.2</c>. Null asks for the newest numbered version KOV publishes: the source finds
    /// out which number that is and then reads that number, never <c>latest</c> itself, so the answer always names a
    /// version a later apply can pin (ADR-0032 decision 6).
    /// </param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <exception cref="OpstapBronFout">
    /// The read was refused as a whole: the source could not be reached or read, answered a different version than asked
    /// for, or its answer cannot be trusted as a whole (a goal with no code or no place in the tree, a code that occurs
    /// twice, a minimumdoel row that cannot be identified). Nothing has been written.
    /// </exception>
    Task<LeerplandoelBronResultaat> HaalOpAsync(string? versie, CancellationToken cancellationToken = default);
}

/// <summary>What one read of the curriculum source produced.</summary>
public sealed class LeerplandoelBronResultaat
{
    /// <summary>Constructs a source result.</summary>
    public LeerplandoelBronResultaat(
        string versie,
        string hash,
        DateTimeOffset? snapshotTijdstip,
        string? wijzigingslog,
        IReadOnlyList<LeerplandoelBronDiscipline> disciplines,
        IReadOnlyList<MinimumdoelVerwijzing>? verwijzingen = null,
        IReadOnlySet<string>? gepubliceerdeMinimumdoelen = null)
    {
        Versie = versie;
        Hash = hash;
        SnapshotTijdstip = snapshotTijdstip;
        Wijzigingslog = wijzigingslog;
        Disciplines = disciplines;
        Verwijzingen = verwijzingen ?? [];
        GepubliceerdeMinimumdoelen = gepubliceerdeMinimumdoelen;
    }

    /// <summary>
    /// The refs (<c>uniqueCode</c>) of the minimumdoelen KOV published at the moment of this read: the index the source
    /// resolves goals' concordance against (E1-22 fix round 3). A stored minimumdoel not in it is no longer in Op.stap as
    /// far as this read can tell, whether or not the minimumdoelen import has flagged it yet. Null when the source does not
    /// say (a test double), and then nothing is concluded from it.
    /// </summary>
    public IReadOnlySet<string>? GepubliceerdeMinimumdoelen { get; }

    /// <summary>
    /// The goals of the snapshot that point at a minimumdoel and are <b>not</b> among the mapped leerplandoelen: goals of a
    /// goal set that is not imported, and G goals the mapping refused (E1-22). With the mapped goals'
    /// <see cref="Leerplandoel.MinimumdoelRef"/> this is what <see cref="ZonderLeerplandoelBepaling"/> needs to say why a
    /// minimumdoel has no loaded leerplandoel. A reference that does not resolve to a published minimumdoel is left out.
    /// </summary>
    public IReadOnlyList<MinimumdoelVerwijzing> Verwijzingen { get; }

    /// <summary>The numbered snapshot that was read, e.g. <c>1.2</c>.</summary>
    public string Versie { get; }

    /// <summary>The hash KOV publishes for that snapshot's <c>krcItems</c>.</summary>
    public string Hash { get; }

    /// <summary>When KOV published the snapshot, when it says so.</summary>
    public DateTimeOffset? SnapshotTijdstip { get; }

    /// <summary>
    /// KOV's own changelog for this version, as plain text (Dutch, KOV's words), or null when KOV gives none or it
    /// carries markup the conversion cannot keep.
    /// </summary>
    public string? Wijzigingslog { get; }

    /// <summary>One entry per discipline in the snapshot, in the snapshot's order.</summary>
    public IReadOnlyList<LeerplandoelBronDiscipline> Disciplines { get; }

    /// <summary>The G goals that were not imported, and why, over every discipline (operator diagnostics, English).</summary>
    public IReadOnlyList<LeerplandoelBronProbleem> Problemen => Disciplines.SelectMany(d => d.Problemen).ToList();

    /// <summary>The skipped goal sets over the whole snapshot, per set (never silently dropped).</summary>
    public IReadOnlyList<DoelsetTelling> OvergeslagenDoelsets =>
        Disciplines
            .SelectMany(d => d.OvergeslagenDoelsets)
            .GroupBy(t => t.Doelset, StringComparer.Ordinal)
            .Select(g => new DoelsetTelling(g.Key, g.Sum(t => t.Aantal)))
            .OrderBy(t => t.Doelset, StringComparer.Ordinal)
            .ToList();
}

/// <summary>What the source holds for one discipline.</summary>
public sealed class LeerplandoelBronDiscipline
{
    /// <summary>Constructs one discipline's part of a source result.</summary>
    public LeerplandoelBronDiscipline(
        string disciplineNummer,
        string disciplineNaam,
        IReadOnlyList<Leerplandoel> leerplandoelen,
        IReadOnlyList<LeerplandoelBronProbleem> problemen,
        IReadOnlyList<string> buitenBereikCodes,
        IReadOnlyList<DoelsetTelling> overgeslagenDoelsets)
    {
        DisciplineNummer = disciplineNummer;
        DisciplineNaam = disciplineNaam;
        Leerplandoelen = leerplandoelen;
        Problemen = problemen;
        BuitenBereikCodes = buitenBereikCodes;
        OvergeslagenDoelsets = overgeslagenDoelsets;
    }

    /// <summary>This repo's discipline number (<c>9.1</c>, never KOV's <c>9-1</c>).</summary>
    public string DisciplineNummer { get; }

    /// <summary>The discipline's title as KOV writes it, for a notice about a discipline this application does not know.</summary>
    public string DisciplineNaam { get; }

    /// <summary>The G goals that mapped cleanly.</summary>
    public IReadOnlyList<Leerplandoel> Leerplandoelen { get; }

    /// <summary>This discipline's G goals that the mapping refused, and why.</summary>
    public IReadOnlyList<LeerplandoelBronProbleem> Problemen { get; }

    /// <summary>The codes of <see cref="Problemen"/>: named by the source, not imported this time.</summary>
    public IReadOnlyList<string> NietIngelezenCodes => Problemen.Select(p => p.Code).ToList();

    /// <summary>Codes of the goals in skipped goal sets (P, S, +, A, Z, V): named by the source, deliberately not read.</summary>
    public IReadOnlyList<string> BuitenBereikCodes { get; }

    /// <summary>How many goals of this discipline each skipped goal set holds.</summary>
    public IReadOnlyList<DoelsetTelling> OvergeslagenDoelsets { get; }
}

/// <summary>A goal of the snapshot that points at a minimumdoel without being imported (E1-22).</summary>
/// <param name="MinimumdoelRef">The <c>uniqueCode</c> of the minimumdoel it points at.</param>
/// <param name="Doelset">KOV's goal-set mark of the goal (<c>Z</c>, <c>V</c>, …, or <c>G</c> for a refused one).</param>
/// <param name="Geweigerd">
/// True for a goal of the imported set that the mapping refused; false for a goal of a set that is not imported at all.
/// </param>
public readonly record struct MinimumdoelVerwijzing(string MinimumdoelRef, string Doelset, bool Geweigerd);

/// <summary>How many goals one goal set holds, for the skipped-sets count in the report.</summary>
/// <param name="Doelset">KOV's goal-set identifier: <c>P</c>, <c>S</c>, <c>+</c>, <c>A</c>, <c>Z</c> or <c>V</c>.</param>
/// <param name="Aantal">The number of goals under it.</param>
public readonly record struct DoelsetTelling(string Doelset, int Aantal);

/// <summary>
/// A G goal that was not imported. Its <see cref="Reden"/> is <b>English</b>: a goal KOV's data cannot deliver faithfully
/// is nothing a teacher or directie can fix, so it is an operator diagnostic (Art. II.3 as amended 2026-07-30).
/// </summary>
/// <param name="Code">
/// The goal's code, always present: a goal without one makes the whole read fail with <see cref="OpstapBronFout"/>, so the
/// import can tell a goal that was not read from one that vanished.
/// </param>
/// <param name="Reden">Why the goal was left out.</param>
public readonly record struct LeerplandoelBronProbleem(string Code, string Reden);
