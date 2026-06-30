namespace Jaarplanner.Infrastructure.OpstapImport;

/// <summary>
/// The two ways the imported discipline set can be scoped (Art. XIV "Disciplines first"). Both are
/// <b>configured outcomes of the same code</b> — neither is the compiled-in answer.
/// </summary>
public enum DisciplineSelectieModus
{
    /// <summary>Import every discipline the parser hands the import path (no restriction).</summary>
    Alle = 0,

    /// <summary>Import only the explicitly listed discipline numbers (a starter selection).</summary>
    Selectie = 1,
}

/// <summary>
/// Options that make the imported discipline set <b>data-driven</b> (Art. XIV / VIII): bound from the
/// configuration section <c>Opstap:DisciplineSelectie</c> (appsettings, environment, user-secrets,
/// Key Vault — any standard .NET config source), so the directie can change which disciplines are in
/// scope <b>without a code change</b>.
/// <para>
/// <b>Default is an overridable placeholder, not a baked-in decision.</b> When the section is absent,
/// <see cref="Modus"/> defaults to <see cref="DisciplineSelectieModus.Alle"/>. This default lives in
/// configuration space (it is what an unconfigured deployment resolves to), is overridable by simply
/// adding the section, and is explicitly a <b>placeholder pending the Art. XIV directie decision</b>
/// on which disciplines to import first — it is not the project's answer to that question. The logic
/// itself contains no discipline list.
/// </para>
/// <para>
/// <b>Cluster-presence neutral (Art. VII.0).</b> These options scope by discipline number only and
/// say nothing about whether a discipline's Excel carries a <c>cluster</c> column.
/// </para>
/// </summary>
public sealed class DisciplineSelectieOptions
{
    /// <summary>Configuration section name: <c>Opstap:DisciplineSelectie</c>.</summary>
    public const string SectionName = "Opstap:DisciplineSelectie";

    /// <summary>
    /// How the imported set is scoped. Defaults to <see cref="DisciplineSelectieModus.Alle"/> — an
    /// overridable placeholder pending the Art. XIV directie decision, <b>not</b> a compiled-in
    /// "import everything" rule (set <see cref="DisciplineSelectieModus.Selectie"/> + populate
    /// <see cref="Disciplines"/> to scope down, with no code change).
    /// </summary>
    public DisciplineSelectieModus Modus { get; init; } = DisciplineSelectieModus.Alle;

    /// <summary>
    /// The in-scope discipline numbers (e.g. <c>["1", "2", "6"]</c>) when
    /// <see cref="Modus"/> is <see cref="DisciplineSelectieModus.Selectie"/>. Supplied purely from
    /// configuration/data — never hard-coded. Ignored when <see cref="Modus"/> is
    /// <see cref="DisciplineSelectieModus.Alle"/>.
    /// </summary>
    public IReadOnlyList<string> Disciplines { get; init; } = [];
}
