namespace Jaarplanner.Application.Planning.Generatie;

/// <summary>
/// The read half of the jaarplan: one class's plan projected onto the currently derived block grid.
/// <para>
/// <b>Extracted for E5-01, and the reason is a correctness one rather than a testability one.</b> Coverage has to
/// agree with the calendar about <i>which placement is stale</i>, because the same screen shows a non-dismissible
/// "these placements need attention" notice (E3-07/E3-09) and a dekking figure. If dekking re-derived staleness
/// itself — deriving the grid again and comparing start dates again — the two could disagree per placement, and the
/// visible symptom would be a card flagged as broken that coverage silently counted, or the reverse. Consuming the
/// <b>same projection the teacher sees</b> removes that class of drift: one grid derivation, one
/// <c>IsVervallen</c> flag, per request.
/// </para>
/// <para>
/// <b>What that does NOT buy, stated because an earlier revision of this comment claimed it did.</b> It said the
/// disagreement was "impossible to write". That was false as written: coverage and the kalender <i>do</i> differ in
/// the <b>aggregate</b>, deliberately. The kalender's notice counts every stale placement; dekking's
/// <c>AantalOnopgelosteVervallenPlaatsingen</c> counts only the unresolved ones, excluding rejected placements,
/// because a rejected placement can never change the figure. So a plan can carry the notice while reporting
/// trustworthy dekking. That is a chosen divergence between two different questions, not agreement — and E5-02 owns
/// the copy that keeps it from reading as a contradiction. What this seam guarantees is the per-placement flag, not
/// the totals derived from it.
/// </para>
/// <para>
/// It is deliberately narrow: only the read, and nothing about generation moves behind it. <b>That isolation is
/// type-level rather than structural</b>, and the distinction is worth being exact about:
/// <see cref="JaarplanGeneratieService"/> implements this interface, so the resolved instance is that service and
/// the object graph transitively holds an <c>IAiClient</c> and the mutating <see cref="IJaarplanOpslag"/>. A caller
/// holding this interface cannot reach either, which is what matters for reasoning about the coverage path; but it
/// is not an architectural guarantee, and would only become one if the projection moved into its own reader class
/// that generation also consumed. Recorded rather than overstated.
/// </para>
/// <para>
/// It also keeps the coverage unit tests free of the generation service's own seams (Art. V.6 asks for the coverage
/// logic to be covered well, and a test that has to construct a faked <c>IAiClient</c> to assert a percentage is a
/// test nobody extends).
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
