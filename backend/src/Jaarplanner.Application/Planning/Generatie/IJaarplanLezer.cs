namespace Jaarplanner.Application.Planning.Generatie;

/// <summary>
/// The read half of the jaarplan: one class's plan as the plan screen shows it.
/// <para>
/// <b>Extracted for E5-01, and the reason is a correctness one.</b> Coverage has to agree with the plan screen about
/// <i>which placement is vervallen</i>, because the same screen shows a lasting notice on such a placement and a
/// dekking figure. Consuming the <b>same projection the teacher sees</b> keeps the per-placement flag identical: one
/// <c>Themakalender</c>, one <c>IsVervallen</c>, per request.
/// </para>
/// <para>
/// <b>What that does NOT buy.</b> Coverage and the plan screen differ in the <b>aggregate</b>, deliberately: dekking's
/// <c>AantalOnopgelosteVervallenPlaatsingen</c> counts only the placements that can still change the figure. What this
/// seam guarantees is the per-placement flag, not the totals derived from it.
/// </para>
/// <para>
/// It also keeps the coverage unit tests free of the planning service's own seams (Art. V.6).
/// </para>
/// </summary>
public interface IJaarplanLezer
{
    /// <summary>
    /// The class's current plan. A class with no plan yet yields an empty plan rather than a not-found (Art. IX.3: a
    /// klas <i>has</i> a jaarplan).
    /// </summary>
    /// <exception cref="Jaarplanner.Application.Schoolcontent.Beheer.SchoolcontentNietGevondenFout">
    /// The class does not exist.
    /// </exception>
    Task<JaarplanWeergave> HaalJaarplanAsync(Guid klasId, CancellationToken cancellationToken = default);
}
