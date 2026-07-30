namespace Jaarplanner.Application.Planning.Generatie;

/// <summary>
/// Thrown when a teacher's move of a <c>Themaplaatsing</c> cannot be honoured (E3-07, FR-6.2): the target date is
/// not the start of any currently derived planningsblok, or that thema already sits in the target period. The (thin)
/// Api maps this to a 400 via <c>PlanningExceptionHandler</c>, alongside
/// <see cref="OngeldigePlaatsingsstatusFout"/>.
/// <para>
/// <b>Why a refusal rather than a correction.</b> The nearest-block temptation is exactly what ADR-0020 and the
/// directie ruling of 2026-07-28 forbid: snapping a placement to a period nobody chose is the silent relocation the
/// stale-placement rules exist to prevent. Generation already refuses an unresolvable date the same way (it reports
/// the placement as skipped rather than moving it), so a teacher's move refuses on the same terms.
/// </para>
/// <para>
/// The message is Dutch because it describes a condition the teacher can act on: pick another period. That is the
/// unratified option (c) in the open Art. II.3 decision, matching the two exception handlers rather than the
/// jaarplan 422's English operator diagnostic. Logged in <c>backlog/README.md</c> under that entry.
/// </para>
/// </summary>
public sealed class OngeldigeVerplaatsingFout : Exception
{
    public OngeldigeVerplaatsingFout(string message)
        : base(message)
    {
    }
}
