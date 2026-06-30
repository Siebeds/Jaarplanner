namespace Jaarplanner.Application.Curriculum.Import;

/// <summary>
/// The structured, reviewable diff of one Op.stap (re-)import for a single discipline: what the
/// new file <b>adds</b>, <b>changes</b>, leaves <b>unchanged</b>, or no longer contains compared
/// to the leerplandoelen already in the database (FR-2.5, Art. III.4).
/// <para>
/// The diff is the "notice the teacher reviews" — it never deletes anything by itself. The
/// distinction between <see cref="Verdwenen"/> (gone from Op.stap, safe to remove because nothing
/// references it) and <see cref="VerdwenenMaarGekoppeld"/> (gone from Op.stap but still referenced
/// by teacher content, so it must <b>not</b> be removed — Art. IV.2) is the heart of the
/// non-destructive guarantee. The import path acts only on these classifications; it never
/// cascades into jaarplannen or teacher links.
/// </para>
/// </summary>
public sealed class OpstapHerimportDiff
{
    /// <summary>Constructs a re-import diff for a discipline.</summary>
    public OpstapHerimportDiff(
        string disciplineNummer,
        IReadOnlyList<string> toegevoegd,
        IReadOnlyList<LeerplandoelWijziging> gewijzigd,
        IReadOnlyList<string> ongewijzigd,
        IReadOnlyList<string> verdwenen,
        IReadOnlyList<VerdwenenGekoppeldDoel> verdwenenMaarGekoppeld)
    {
        DisciplineNummer = disciplineNummer;
        Toegevoegd = toegevoegd;
        Gewijzigd = gewijzigd;
        Ongewijzigd = ongewijzigd;
        Verdwenen = verdwenen;
        VerdwenenMaarGekoppeld = verdwenenMaarGekoppeld;
    }

    /// <summary>The discipline this re-import covers.</summary>
    public string DisciplineNummer { get; }

    /// <summary>Codes present in the new file but not yet in the database — these are inserted.</summary>
    public IReadOnlyList<string> Toegevoegd { get; }

    /// <summary>Codes present in both, whose official content differs — these are updated (with field detail).</summary>
    public IReadOnlyList<LeerplandoelWijziging> Gewijzigd { get; }

    /// <summary>Codes present in both and identical — left untouched.</summary>
    public IReadOnlyList<string> Ongewijzigd { get; }

    /// <summary>
    /// Codes in the database (for this discipline) that are <b>absent</b> from the new file and are
    /// <b>not referenced</b> by any teacher content. These can be removed safely; whether the import
    /// actually removes them is policy (see the import service) — by default they are removed.
    /// </summary>
    public IReadOnlyList<string> Verdwenen { get; }

    /// <summary>
    /// Codes absent from the new file but <b>still referenced</b> by teacher content (a
    /// <c>DoelKoppeling</c>). These are <b>never</b> deleted (FK Restrict, Art. IV.2); instead they
    /// are flagged for review (<c>NietMeerInOpstap = true</c>). This list is the headline of the
    /// non-destructive guarantee.
    /// </summary>
    public IReadOnlyList<VerdwenenGekoppeldDoel> VerdwenenMaarGekoppeld { get; }

    /// <summary>True when the re-import changes nothing (no adds, changes, or disappearances).</summary>
    public bool IsLeeg =>
        Toegevoegd.Count == 0 &&
        Gewijzigd.Count == 0 &&
        Verdwenen.Count == 0 &&
        VerdwenenMaarGekoppeld.Count == 0;

    /// <summary>True when something needs human review: a change, or a goal that disappeared.</summary>
    public bool VereistReview =>
        Gewijzigd.Count > 0 ||
        Verdwenen.Count > 0 ||
        VerdwenenMaarGekoppeld.Count > 0;
}

/// <summary>
/// A single field-level change to a leerplandoel's official content during re-import: the field
/// name, the old persisted value, and the new value from the file. Surfaced so a teacher can see
/// exactly what shifted (e.g. a reworded <c>tekst</c> or a re-concorded <c>minimumdoelRef</c>).
/// </summary>
/// <param name="Code">The leerplandoel code that changed.</param>
/// <param name="Velden">The per-field changes.</param>
public sealed record LeerplandoelWijziging(string Code, IReadOnlyList<VeldWijziging> Velden);

/// <summary>One changed field of a leerplandoel.</summary>
/// <param name="Veld">The (model) field name that changed.</param>
/// <param name="OudeWaarde">The previously persisted value (null when it was empty).</param>
/// <param name="NieuweWaarde">The new value from the re-imported file (null when now empty).</param>
public readonly record struct VeldWijziging(string Veld, string? OudeWaarde, string? NieuweWaarde);

/// <summary>
/// A leerplandoel that disappeared from Op.stap but is still linked by teacher content, so it is
/// flagged rather than deleted (Art. III.4 / IV.2).
/// </summary>
/// <param name="Code">The leerplandoel code that is gone from the file but still in use.</param>
/// <param name="AantalKoppelingen">How many teacher links still reference it (for the review notice).</param>
public readonly record struct VerdwenenGekoppeldDoel(string Code, int AantalKoppelingen);
