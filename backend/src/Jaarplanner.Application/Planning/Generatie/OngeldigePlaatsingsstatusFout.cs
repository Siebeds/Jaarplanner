namespace Jaarplanner.Application.Planning.Generatie;

/// <summary>
/// Thrown when a caller asks for a <c>Themaplaatsing</c> status that is not a teacher decision — in practice
/// setting it back to <c>voorgesteld</c>, which only the AI produces (Art. IV.1/IV.2). The (thin) Api maps this to
/// a 400 via <c>PlanningExceptionHandler</c>. The planning sibling of <c>OngeldigeSuggestieStatusFout</c>.
/// <para>
/// Not-found faults deliberately reuse <c>SchoolcontentNietGevondenFout</c> (→ 404), the shared CRUD fault
/// vocabulary <c>KlasBeheerService</c> already throws for planning entities; only this fault has no existing
/// equivalent.
/// </para>
/// </summary>
public sealed class OngeldigePlaatsingsstatusFout : Exception
{
    public OngeldigePlaatsingsstatusFout(string message)
        : base(message)
    {
    }
}
