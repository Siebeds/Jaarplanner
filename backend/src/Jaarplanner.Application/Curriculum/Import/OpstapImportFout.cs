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
/// </summary>
public sealed class OpstapImportFout : Exception
{
    /// <summary>Constructs the fault.</summary>
    /// <param name="soort">Which precondition failed.</param>
    /// <param name="melding">The Dutch explanation for the person running the import.</param>
    public OpstapImportFout(OpstapImportFoutSoort soort, string melding)
        : base(melding) =>
        Soort = soort;

    /// <summary>Which precondition failed.</summary>
    public OpstapImportFoutSoort Soort { get; }
}
