namespace Jaarplanner.Application.Schoolcontent.Import;

/// <summary>
/// The outcome of a school-content import/re-import attempt: the reviewable <see cref="Diff"/> (the
/// preview) plus whether it was actually committed (<see cref="Toegepast"/>). Mirrors the Op.stap
/// re-import's <c>OpstapImportResultaat</c> and supports the same two-step "preview then apply"
/// (FR-1.3): a teacher first inspects the diff (<c>toepassen: false</c>) — including which teacher
/// decisions an overwrite would threaten — and only then commits.
/// </summary>
public sealed class SchoolcontentImportResultaat
{
    /// <summary>Constructs an import result.</summary>
    /// <param name="diff">The reviewable preview/diff.</param>
    /// <param name="toegepast">True when committed; false for a preview.</param>
    public SchoolcontentImportResultaat(SchoolcontentImportDiff diff, bool toegepast)
    {
        Diff = diff;
        Toegepast = toegepast;
    }

    /// <summary>The structured, reviewable diff — the preview the teacher reviews (FR-1.3).</summary>
    public SchoolcontentImportDiff Diff { get; }

    /// <summary>True when committed to the database; false when it was a non-mutating preview.</summary>
    public bool Toegepast { get; }
}
