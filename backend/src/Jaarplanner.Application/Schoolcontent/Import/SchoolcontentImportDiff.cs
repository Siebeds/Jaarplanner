namespace Jaarplanner.Application.Schoolcontent.Import;

/// <summary>
/// The structured, reviewable diff of one school-content (thema/subthema/activiteit) (re-)import —
/// the "preview" a teacher reviews before committing (FR-1.3/1.4). It mirrors the Op.stap re-import's
/// <c>OpstapHerimportDiff</c>: it describes what <b>would</b> happen per level (added / updated /
/// unchanged) for the chosen <see cref="SchoolcontentImportModus"/>, computed by the <b>same code</b>
/// that the commit uses, so the committed result is guaranteed to match the preview for the same input.
/// <para>
/// <b>Headline (Art. IV.2).</b> <see cref="BedreigdeBeslissingen"/> lists every teacher-set
/// <c>DoelKoppeling</c> (<c>aanvaard</c>/<c>geweigerd</c>/<c>manueel</c>) that an overwrite would discard
/// because the re-imported file no longer carries it. By default these are <b>preserved</b> (kept on the
/// content) and this list is purely a warning; they are only actually dropped when the caller explicitly
/// confirms (<see cref="SchoolcontentImportOpties.MenselijkeBeslissingenVerwijderen"/> = true). A re-import
/// therefore never silently destroys a human decision.
/// </para>
/// </summary>
public sealed class SchoolcontentImportDiff
{
    /// <summary>Constructs a school-content re-import diff.</summary>
    public SchoolcontentImportDiff(
        SchoolcontentImportModus modus,
        IReadOnlyList<ThemaWijziging> themas,
        IReadOnlyList<SubthemaWijziging> subthemas,
        IReadOnlyList<ActiviteitWijziging> activiteiten,
        IReadOnlyList<BedreigdeBeslissing> bedreigdeBeslissingen,
        bool overgeslagen = false,
        IReadOnlyList<string>? opmerkingen = null)
    {
        Modus = modus;
        Themas = themas;
        Subthemas = subthemas;
        Activiteiten = activiteiten;
        BedreigdeBeslissingen = bedreigdeBeslissingen;
        Overgeslagen = overgeslagen;
        Opmerkingen = opmerkingen ?? [];
    }

    /// <summary>The re-import mode this diff was computed for (add vs update/overwrite).</summary>
    public SchoolcontentImportModus Modus { get; }

    /// <summary>Per-thema classification (added / updated / unchanged).</summary>
    public IReadOnlyList<ThemaWijziging> Themas { get; }

    /// <summary>Per-subthema classification (added / updated / unchanged).</summary>
    public IReadOnlyList<SubthemaWijziging> Subthemas { get; }

    /// <summary>Per-activiteit classification (added / updated / unchanged).</summary>
    public IReadOnlyList<ActiviteitWijziging> Activiteiten { get; }

    /// <summary>
    /// The teacher-set goal links an overwrite would discard (the file no longer carries them). The
    /// headline of the non-destructive guarantee (Art. IV.2): by default these are kept and this is a
    /// warning; discarding requires explicit confirmation.
    /// </summary>
    public IReadOnlyList<BedreigdeBeslissing> BedreigdeBeslissingen { get; }

    /// <summary>True when the import was deliberately skipped (e.g. an empty/invalid parse result).</summary>
    public bool Overgeslagen { get; }

    /// <summary>Human-readable Dutch notices (e.g. why a file did nothing, or which klas was missing).</summary>
    public IReadOnlyList<string> Opmerkingen { get; }

    /// <summary>True when the re-import changes nothing.</summary>
    public bool IsLeeg =>
        Themas.All(t => t.Soort == WijzigingSoort.Ongewijzigd) &&
        Subthemas.All(s => s.Soort == WijzigingSoort.Ongewijzigd) &&
        Activiteiten.All(a => a.Soort == WijzigingSoort.Ongewijzigd);

    /// <summary>
    /// True when something needs human review: a skip, an actual change, or — crucially — a teacher
    /// decision that an overwrite would discard.
    /// </summary>
    public bool VereistReview =>
        Overgeslagen ||
        BedreigdeBeslissingen.Count > 0 ||
        !IsLeeg;
}

/// <summary>Whether a piece of content is newly added, updated in place, or left unchanged.</summary>
public enum WijzigingSoort
{
    /// <summary>toegevoegd — not present before; will be inserted.</summary>
    Toegevoegd = 0,

    /// <summary>bijgewerkt — matched existing content; its attributes will be overwritten (Bijwerken mode).</summary>
    Bijgewerkt = 1,

    /// <summary>ongewijzigd — matched existing content left untouched (Toevoegen mode, or no field changed).</summary>
    Ongewijzigd = 2,
}

/// <summary>One thema's classification in the diff, keyed by its match key (naam, school-wide).</summary>
/// <param name="Naam">The thema naam (the match key).</param>
/// <param name="Soort">Added / updated / unchanged.</param>
public sealed record ThemaWijziging(string Naam, WijzigingSoort Soort);

/// <summary>One subthema's classification, keyed by (thema naam, subthema naam, klas, leeftijd).</summary>
/// <param name="ThemaNaam">The owning thema naam.</param>
/// <param name="Naam">The subthema naam.</param>
/// <param name="Klas">The class the subthema is scoped to.</param>
/// <param name="Leeftijd">The age the subthema is scoped to.</param>
/// <param name="Soort">Added / updated / unchanged.</param>
public sealed record SubthemaWijziging(
    string ThemaNaam,
    string Naam,
    string Klas,
    string Leeftijd,
    WijzigingSoort Soort);

/// <summary>One activiteit's classification, keyed by (subthema match key, activiteit naam).</summary>
/// <param name="ThemaNaam">The grandparent thema naam.</param>
/// <param name="SubthemaNaam">The parent subthema naam.</param>
/// <param name="Naam">The activiteit naam.</param>
/// <param name="Soort">Added / updated / unchanged.</param>
public sealed record ActiviteitWijziging(
    string ThemaNaam,
    string SubthemaNaam,
    string Naam,
    WijzigingSoort Soort);

/// <summary>
/// A teacher-set <c>DoelKoppeling</c> (a human decision) that an overwrite would discard because the
/// re-imported file no longer carries that leerplandoel link on this content (Art. IV.2). Surfaced so
/// the teacher can decide; by default it is <b>kept</b> (never silently lost).
/// </summary>
/// <param name="Niveau">Where the link lives: themadoel, subdoel, or activiteit.</param>
/// <param name="ContentNaam">The thema/subthema/activiteit naam carrying the link (for the review notice).</param>
/// <param name="LeerplandoelCode">The leerplandoel code of the threatened link.</param>
/// <param name="Status">The teacher-set status that would be lost (aanvaard/geweigerd/manueel).</param>
public sealed record BedreigdeBeslissing(
    KoppelingNiveau Niveau,
    string ContentNaam,
    string LeerplandoelCode,
    Domain.Schoolcontent.KoppelingStatus Status);

/// <summary>The kind of content a goal link belongs to.</summary>
public enum KoppelingNiveau
{
    /// <summary>A school-wide themadoel link.</summary>
    Themadoel = 0,

    /// <summary>A class/age-scoped subdoel link.</summary>
    Subdoel = 1,

    /// <summary>A class/age-scoped activiteit link.</summary>
    Activiteit = 2,
}
