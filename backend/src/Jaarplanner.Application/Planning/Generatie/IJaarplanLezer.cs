namespace Jaarplanner.Application.Planning.Generatie;

/// <summary>
/// The read half of the jaarplan: one class's plan projected onto the currently derived block grid.
/// <para>
/// <b>Extracted for E5-01, and the reason is a correctness one rather than a testability one.</b> Coverage has to
/// agree with the calendar about which placements are stale, because the same screen shows a non-dismissible
/// "these placements need attention" notice (E3-07/E3-09) and a dekking figure. If dekking re-derived staleness
/// itself — deriving the grid again and comparing start dates again — the two could drift, and the visible
/// symptom would be a plan that reports a trustworthy percentage while flagging placements as broken, or the
/// reverse. Consuming the <b>same projection the teacher sees</b> makes that disagreement impossible to write
/// rather than merely unlikely.
/// </para>
/// <para>
/// It is deliberately narrow: only the read. <see cref="JaarplanGeneratieService"/> implements it, and nothing
/// about generation moves behind this interface, so the coverage computation cannot reach a mutation or the AI
/// client. That also keeps the coverage unit tests free of the generation service's own seams (Art. V.6 asks for
/// the coverage logic to be covered well, and a test that has to construct a faked <c>IAiClient</c> to assert a
/// percentage is a test nobody extends).
/// </para>
/// </summary>
public interface IJaarplanLezer
{
    /// <summary>
    /// The class's current plan, with each placement's period resolved against the grid derived <b>now</b>. A class
    /// with no plan yet yields an empty plan rather than a not-found (Art. IX.3: a klas <i>has</i> a jaarplan).
    /// </summary>
    /// <exception cref="Jaarplanner.Application.Schoolcontent.Beheer.SchoolcontentNietGevondenFout">
    /// The class does not exist.
    /// </exception>
    Task<JaarplanWeergave> HaalJaarplanAsync(Guid klasId, CancellationToken cancellationToken = default);
}
