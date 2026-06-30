namespace Jaarplanner.Application.Curriculum.Import;

/// <summary>
/// The <b>discipline-selection seam</b> (Art. XIV open decision "Disciplines first"): it answers the
/// single question "is this Op.stap discipline in scope for import?" without the answer being
/// compiled into any logic.
/// <para>
/// <b>Why this is a seam, not a decision.</b> Whether the school imports <i>all</i> Op.stap
/// disciplines or only a <i>starter selection</i> is an explicit Art. XIV open decision reserved for
/// the directie. This abstraction lets the import path (E1-05) ask which disciplines it may process
/// while the actual answer is supplied at runtime by configuration/data — so "all" and "a subset"
/// are two <b>configured outcomes of the same code</b>, switchable without a recompile. No
/// implementation may hard-code a discipline list to drive behaviour (the violation this seam
/// exists to prevent).
/// </para>
/// <para>
/// <b>Cluster-presence neutrality (Art. VII.0).</b> The seam decides scope by discipline
/// <see cref="Discipline.Nummer"/> only. It makes <b>no</b> assumption about whether a given
/// discipline's goal Excel carries a <c>cluster</c> column — <c>cluster</c> is nullable regardless,
/// and per-discipline cluster rules are never baked in here.
/// </para>
/// </summary>
public interface IDisciplineSelectie
{
    /// <summary>
    /// True when the discipline with the given Op.stap number (e.g. <c>"1"</c>, <c>"9.2"</c>) is in
    /// scope for import per the runtime configuration/data. The implementation must derive this from
    /// an external, overridable source — never from a list compiled into logic.
    /// </summary>
    /// <param name="disciplineNummer">The Op.stap discipline number (Art. VII.0 / IX.1).</param>
    bool IsInScope(string disciplineNummer);

    /// <summary>
    /// A human-readable (Dutch) description of the active selection, for diagnostics and review
    /// notices (e.g. "alle disciplines" or "selectie: 1, 2, 6"). Carries no behaviour.
    /// </summary>
    string Omschrijving { get; }
}
