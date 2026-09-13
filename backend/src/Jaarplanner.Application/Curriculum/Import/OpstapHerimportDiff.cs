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
        IReadOnlyList<VerdwenenGekoppeldDoel> verdwenenMaarGekoppeld,
        bool overgeslagen = false,
        IReadOnlyList<string>? opmerkingen = null,
        IReadOnlyList<string>? nietIngelezen = null,
        IReadOnlyList<string>? buitenBereik = null,
        IReadOnlyList<HernummerdDoel>? hernummerd = null,
        IReadOnlyList<string>? gemeenschappelijkBuitenBereik = null)
    {
        DisciplineNummer = disciplineNummer;
        Toegevoegd = toegevoegd;
        Gewijzigd = gewijzigd;
        Ongewijzigd = ongewijzigd;
        Verdwenen = verdwenen;
        VerdwenenMaarGekoppeld = verdwenenMaarGekoppeld;
        Overgeslagen = overgeslagen;
        Opmerkingen = opmerkingen ?? [];
        NietIngelezen = nietIngelezen ?? [];
        BuitenBereik = buitenBereik ?? [];
        Hernummerd = hernummerd ?? [];
        GemeenschappelijkBuitenBereik = gemeenschappelijkBuitenBereik ?? [];
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
    /// <b>not referenced</b> by any teacher content. Whether the import removes them is policy (see the
    /// import service) — the <b>conservative default is flag-and-keep</b> (mark
    /// <c>NietMeerInOpstap = true</c>, never delete); an actual purge is an explicit directie opt-in.
    /// </summary>
    public IReadOnlyList<string> Verdwenen { get; }

    /// <summary>
    /// Codes absent from the new file but <b>still referenced</b> by teacher content (a
    /// <c>DoelKoppeling</c>). These are <b>never</b> deleted (FK Restrict, Art. IV.2); instead they
    /// are flagged for review (<c>NietMeerInOpstap = true</c>). This list is the headline of the
    /// non-destructive guarantee.
    /// </summary>
    public IReadOnlyList<VerdwenenGekoppeldDoel> VerdwenenMaarGekoppeld { get; }

    /// <summary>
    /// True when the (re-)import was deliberately <b>skipped</b> as a safety measure — e.g. the parse
    /// result carried <b>no valid rows</b> for the discipline (an empty/partial/wrong file). In that
    /// case the existing rows are <b>not</b> treated as disappeared: nothing is flagged or deleted,
    /// and <see cref="Opmerkingen"/> explains why (Art. III.4 — absence of input is not a curriculum
    /// change). A skipped diff is always empty in its add/change/remove buckets.
    /// </summary>
    public bool Overgeslagen { get; }

    /// <summary>
    /// Human-readable notices about this (re-)import (Dutch — surfaced to the teacher/directie). Used
    /// for the empty/implausible-file guard ("geen geldige rijen ingelezen — niets toegepast") so the
    /// reason a file did nothing is never silent.
    /// </summary>
    public IReadOnlyList<string> Opmerkingen { get; }

    /// <summary>
    /// Codes in the database (for this discipline) that the source <b>still names</b>, but whose goal was not imported
    /// this time because it could not be read: a malformed Excel row, or an Op.stap goal the mapping refused (E1-21). The
    /// stored row is <b>left exactly as it was</b>, flag included. Kept apart from <see cref="Verdwenen"/> because telling a
    /// reviewer that Op.stap dropped a goal it still contains would be false (Art. III.4), the defect E1-12 fixed for
    /// minimumdoelen.
    /// </summary>
    public IReadOnlyList<string> NietIngelezen { get; }

    /// <summary>
    /// Codes in the database (for this discipline) that the source still names under a goal set this import does
    /// <b>not</b> take (E1-21: only goal set G is imported, owner ruling 2026-09-11). Typically P, S, + or A goals loaded
    /// earlier from the Excel route. Left untouched and <b>not</b> a review item: they are outside the ruled scope, not
    /// missing from Op.stap. A stored <b>gemeenschappelijk</b> goal found there is not in this list but in
    /// <see cref="GemeenschappelijkBuitenBereik"/>.
    /// </summary>
    public IReadOnlyList<string> BuitenBereik { get; }

    /// <summary>
    /// Codes stored here as a <b>gemeenschappelijk</b> (G) goal that the source lists under a goal set this import does
    /// not take (E1-21, antagonist round 1 MINOR 4). Left untouched, like <see cref="BuitenBereik"/>, but a review item:
    /// the one goal set the import does take no longer holds the goal, and a reviewer should know. What changed at KOV,
    /// and why, the import cannot tell.
    /// </summary>
    public IReadOnlyList<string> GemeenschappelijkBuitenBereik { get; }

    /// <summary>
    /// Goals the source renumbered: a stored code is absent, and a new code carries the same Op.stap <c>key</c> (E1-21,
    /// ADR-0032 decision 7). Applying inserts the new code and flags the old one <c>NietMeerInOpstap</c>, exactly as for
    /// an addition plus a disappearance, because the code is the identity (Art. III.5) and teacher links stay on the code
    /// they were made to. The pair is reported here <b>instead of</b> in <see cref="Toegevoegd"/> and
    /// <see cref="Verdwenen"/>/<see cref="VerdwenenMaarGekoppeld"/>, so every code sits in exactly one bucket.
    /// </summary>
    public IReadOnlyList<HernummerdDoel> Hernummerd { get; }

    /// <summary>
    /// True when the re-import changes nothing and left no stored goal unread. Codes <see cref="BuitenBereik"/> do not
    /// count: the import was never meant to read them.
    /// </summary>
    public bool IsLeeg =>
        Toegevoegd.Count == 0 &&
        Gewijzigd.Count == 0 &&
        Verdwenen.Count == 0 &&
        VerdwenenMaarGekoppeld.Count == 0 &&
        NietIngelezen.Count == 0 &&
        Hernummerd.Count == 0 &&
        GemeenschappelijkBuitenBereik.Count == 0;

    /// <summary>
    /// True when something needs human review: a skip notice, a change, a disappearance, a renumbering, or a stored goal
    /// whose new version could not be read.
    /// </summary>
    public bool VereistReview =>
        Overgeslagen ||
        Gewijzigd.Count > 0 ||
        Verdwenen.Count > 0 ||
        VerdwenenMaarGekoppeld.Count > 0 ||
        NietIngelezen.Count > 0 ||
        Hernummerd.Count > 0 ||
        GemeenschappelijkBuitenBereik.Count > 0;
}

/// <summary>
/// A goal the source renumbered (E1-21): the old code is gone, the new code carries the same Op.stap <c>key</c>.
/// </summary>
/// <param name="OudeCode">The stored code, which is kept and flagged <c>NietMeerInOpstap</c>.</param>
/// <param name="NieuweCode">The code the source uses now, which is inserted.</param>
/// <param name="AantalKoppelingen">
/// How many teacher links still reference the old code. They are <b>not</b> moved: the code is the identity, and moving
/// a link is a decision for a teacher, not for an import.
/// </param>
public readonly record struct HernummerdDoel(string OudeCode, string NieuweCode, int AantalKoppelingen);

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
