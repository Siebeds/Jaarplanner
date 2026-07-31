namespace Jaarplanner.Application.Curriculum.Import;

/// <summary>
/// Why an Op.stap (re-)import cannot be carried out. Each case is a <b>precondition of the curriculum
/// data</b> rather than a parse problem, so it is not an <c>OpstapRijProbleem</c>: the file may be
/// perfectly well-formed and still be unimportable.
/// </summary>
public enum OpstapImportFoutSoort
{
    /// <summary>
    /// The stated discipline is not one of the official Op.stap disciplines (Art. VII.0). The caller
    /// supplies the discipline as import context (the goal Excel has no discipline column), so a typo
    /// lands here.
    /// </summary>
    OnbekendeDiscipline = 0,

    /// <summary>
    /// The file's rows concord to minimumdoelen that are not loaded. Blocked until the decreed
    /// minimumdoelen have a source (E1-12); the concordance is a <c>Restrict</c> FK, so such rows cannot
    /// be persisted and, because the import commits in one transaction, neither can the rest of the file.
    /// </summary>
    OntbrekendeMinimumdoelen = 1,

    /// <summary>
    /// The file carries a leerplandoel <c>code</c> that is already loaded under a <b>different</b>
    /// discipline. The realistic cause is a file uploaded under the wrong discipline number. Refusing and
    /// informing the uploader is <b>ratified policy</b> (owner, 2026-07-31): identity is the code
    /// (Art. III.5) and moving one between disciplines is a curriculum change a human must confirm, not
    /// something an upload decides silently.
    /// </summary>
    CodeInAndereDiscipline = 2,
}

/// <summary>A leerplandoel code and the discipline it is currently loaded under, for a refusal notice.</summary>
/// <param name="Code">The leerplandoel code the incoming file also claims.</param>
/// <param name="DisciplineNummer">The discipline the persisted row belongs to today.</param>
public readonly record struct DoelInAndereDiscipline(string Code, string DisciplineNummer);

/// <summary>
/// The Op.stap (re-)import cannot be carried out: a typed fault raised by the import path so the (thin)
/// Api maps a status code without knowing anything about EF Core or PostgreSQL (Art. VIII). Its
/// <see cref="Exception.Message"/> is Dutch and addressed to whoever runs the import, which for
/// reference-data administration is directie (Art. II.3 as amended 2026-07-30, Art. VI.1); the
/// <see cref="Soort"/> is what the handler switches on.
/// <para>
/// <b>It is raised on the preview path too, deliberately.</b> All three cases are decided <i>before</i>
/// anything is written, so a preview refuses exactly what a commit would refuse (FR-2.5). A review step
/// that green-lights an import which cannot land is worse than no review step.
/// </para>
/// <para>
/// <b>The Dutch wording lives here, one source per case (Art. II.3 clause 3).</b> Use the static factory
/// for the case you are raising; do not compose the sentence at the call site. Each case has <b>two</b>
/// call sites — the up-front preflight, which knows exactly which refs or codes offended, and the
/// <c>SaveChanges</c> translator, which only knows the constraint that broke — and the first version of
/// this type let each site write its own sentence. The result was three pairs of near-identical Dutch
/// strings where the second of each pair is unreachable without a concurrent writer, so <b>no test could
/// pin it</b>: rewording the reachable copy would silently leave the race path answering the old text.
/// The factories therefore take the detail as a parameter and degrade gracefully when it is absent, which
/// is the only difference the two call sites are allowed to produce.
/// </para>
/// </summary>
public sealed class OpstapImportFout : Exception
{
    /// <summary>
    /// How many offending values a refusal names before it says "en nog meer". Exposed so a caller can
    /// bound its query (fetching one more than this is enough to know the list was truncated) without
    /// duplicating the number.
    /// </summary>
    public const int MaxGenoemdeVoorbeelden = 5;

    /// <summary>Constructs the fault. Prefer the static factories, which own the Dutch wording.</summary>
    /// <param name="soort">Which precondition failed.</param>
    /// <param name="melding">The Dutch explanation for the person running the import.</param>
    /// <param name="innerException">
    /// The underlying fault when there is one (the <c>DbUpdateException</c> from the
    /// <c>SaveChanges</c> path). Kept so the SQLSTATE, constraint name and table survive into the log:
    /// that path is only reachable through a genuine concurrency anomaly, which is exactly when the
    /// original exception is the only useful artefact (Art. II.3, the operator half).
    /// </param>
    public OpstapImportFout(OpstapImportFoutSoort soort, string melding, Exception? innerException = null)
        : base(melding, innerException) =>
        Soort = soort;

    /// <summary>Which precondition failed.</summary>
    public OpstapImportFoutSoort Soort { get; }

    /// <summary>The stated discipline is not an official Op.stap discipline (Art. VII.0).</summary>
    /// <param name="disciplineNummer">The number the caller supplied.</param>
    /// <param name="innerException">The underlying database fault, when this came from a failed write.</param>
    public static OpstapImportFout OnbekendeDiscipline(
        string disciplineNummer,
        Exception? innerException = null) =>
        new(
            OpstapImportFoutSoort.OnbekendeDiscipline,
            $"'{disciplineNummer}' is geen Op.stap-discipline. Gebruik het officiële disciplinenummer, " +
            "bijvoorbeeld 1 voor Nederlands en communicatie of 9.2 voor Leren leren.",
            innerException);

    /// <summary>
    /// The file concords to minimumdoelen that are not loaded (E1-12).
    /// </summary>
    /// <param name="ontbrekendeRefs">
    /// The concordance keys that resolved to nothing, when they are known. Empty when the caller only
    /// knows that the concordance FK broke, in which case the sentence simply omits the list.
    /// </param>
    /// <param name="innerException">The underlying database fault, when this came from a failed write.</param>
    public static OpstapImportFout OntbrekendeMinimumdoelen(
        IEnumerable<string> ontbrekendeRefs,
        Exception? innerException = null) =>
        new(
            OpstapImportFoutSoort.OntbrekendeMinimumdoelen,
            "Deze leerplandoelen verwijzen naar minimumdoelen die nog niet ingeladen zijn" +
            Toelichting(ontbrekendeRefs) +
            ". Laad eerst de decretale minimumdoelen in. Er is niets gewijzigd aan de doelen die al in " +
            "de toepassing staan.",
            innerException);

    /// <summary>
    /// The file claims a code that is already loaded under another discipline (ratified refusal, owner
    /// 2026-07-31).
    /// </summary>
    /// <param name="disciplineNummer">The discipline the file was uploaded as.</param>
    /// <param name="doelen">
    /// The offending codes with the discipline they belong to today, when they are known. Empty when the
    /// caller only knows that the primary key broke, in which case the sentence names no code.
    /// </param>
    /// <param name="innerException">The underlying database fault, when this came from a failed write.</param>
    public static OpstapImportFout CodeInAndereDiscipline(
        string disciplineNummer,
        IEnumerable<DoelInAndereDiscipline> doelen,
        Exception? innerException = null)
    {
        var genoemd = doelen.Select(d => $"{d.Code} (discipline {d.DisciplineNummer})").ToList();
        var opening = genoemd.Count > 0
            ? $"Deze codes staan al bij een andere discipline: {Opsomming(genoemd)}."
            : "Een of meer codes uit dit bestand staan al bij een andere discipline.";

        return new(
            OpstapImportFoutSoort.CodeInAndereDiscipline,
            $"{opening} Controleer of dit bestand bij discipline {disciplineNummer} hoort. " +
            "Er is niets gewijzigd. Verhuist een doel echt naar een andere discipline, dan moet iemand " +
            "dat eerst bevestigen.",
            innerException);
    }

    /// <summary>Renders ": a, b, c" when values are known, and nothing when they are not.</summary>
    private static string Toelichting(IEnumerable<string> waarden)
    {
        var lijst = waarden.ToList();

        return lijst.Count == 0 ? string.Empty : $": {Opsomming(lijst)}";
    }

    /// <summary>
    /// Formats up to <see cref="MaxGenoemdeVoorbeelden"/> values as a readable Dutch list; a longer list
    /// is truncated rather than dumping thousands of codes into one message.
    /// </summary>
    private static string Opsomming(IReadOnlyList<string> waarden) =>
        waarden.Count > MaxGenoemdeVoorbeelden
            ? string.Join(", ", waarden.Take(MaxGenoemdeVoorbeelden)) + " en nog meer"
            : string.Join(", ", waarden);
}
