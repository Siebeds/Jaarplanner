namespace Jaarplanner.Application.Curriculum.Import;

/// <summary>
/// The outcome of an Op.stap import/re-import attempt: the reviewable <see cref="Diff"/> plus
/// whether the changes were actually persisted (<see cref="Toegepast"/>).
/// <para>
/// The flow supports a two-step "preview then apply" (FR-2.5): a teacher can first ask for the
/// diff (<c>toepassen: false</c>) to see what would change — added/changed/removed and, crucially,
/// which goals disappeared from Op.stap while still in use — and only then apply it. When applied,
/// reference data is upserted and the non-destructive policy is enforced (referenced goals are
/// flagged, never deleted). Existing jaarplannen and teacher <c>DoelKoppeling</c> statuses are
/// untouched either way.
/// </para>
/// </summary>
public sealed class OpstapImportResultaat
{
    /// <summary>Constructs an import result.</summary>
    /// <param name="diff">The reviewable diff of the (re-)import.</param>
    /// <param name="toegepast">True when the changes were committed; false for a preview.</param>
    public OpstapImportResultaat(OpstapHerimportDiff diff, bool toegepast)
    {
        Diff = diff;
        Toegepast = toegepast;
    }

    /// <summary>The structured, reviewable diff — the notice the teacher reviews (FR-2.5).</summary>
    public OpstapHerimportDiff Diff { get; }

    /// <summary>
    /// True when the import was committed to the database; false when it was a non-mutating
    /// preview. A preview never touches reference data, links, or plans.
    /// </summary>
    public bool Toegepast { get; }
}
