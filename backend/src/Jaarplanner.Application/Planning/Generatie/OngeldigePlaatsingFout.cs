namespace Jaarplanner.Application.Planning.Generatie;

/// <summary>
/// Thrown when a teacher's <b>hand-placement</b> of a thema cannot be honoured (E4-03, FR-7.2): the chosen period is
/// not the start of any currently derived planningsblok, or that thema already sits in that period. The (thin) Api maps
/// this to a 400 via <c>PlanningExceptionHandler</c>, alongside <see cref="OngeldigeVerplaatsingFout"/> and
/// <see cref="OngeldigePlaatsingsstatusFout"/>.
/// <para>
/// <b>Why not <see cref="OngeldigeVerplaatsingFout"/>, which already refuses the same two conditions.</b> That type
/// documents itself as a failed <i>move</i>, and its reasoning is written around one: a placement that already exists
/// somewhere and is being relocated. Reusing it for an add would make its own summary false, and a comment that
/// quietly stops describing its subject is the single defect class this project has retracted most often. The 400 they
/// both map to is the same; what they mean to a reader is not.
/// </para>
/// <para>
/// <b>One factory per case</b>, following the <c>OngeldigeImportFout</c> precedent from E1-15: a refusal whose message
/// is composed at the throw site ends up existing twice the moment a second caller needs it, and the two copies then
/// drift. Every sentence a teacher can read for this fault is in this file.
/// </para>
/// <para>
/// <b>The messages deliberately name no date.</b> The move path's equivalent interpolates
/// <c>JaarplanGeneratieResponseParser.DatumFormaat</c>, which is an ISO date no Dutch teacher reads, and it gets away
/// with it only because the frontend never renders that <c>detail</c> (it shows its own <c>nl.json</c> copy instead).
/// Rather than add a second instance of a string that is safe purely by not being displayed, these say what the
/// teacher should do next and name nothing that needs formatting. Dutch because both conditions are teacher-actionable,
/// which is the Dutch side of the ratified Art. II.3 split.
/// </para>
/// </summary>
public sealed class OngeldigePlaatsingFout : Exception
{
    private OngeldigePlaatsingFout(string message)
        : base(message)
    {
    }

    /// <summary>
    /// The requested period starts no block of the current grid. Refused rather than snapped to the nearest period,
    /// which is the silent relocation ADR-0020 and the directie ruling of 2026-07-28 forbid, and the same answer
    /// generation and the move path give. The realistic cause is a grid that changed after the page loaded (a school
    /// editing its vakantiedata reshapes it), so the instruction is to reload rather than to pick differently.
    /// </summary>
    public static OngeldigePlaatsingFout GeenPeriodebegin() =>
        new("Die periode bestaat niet meer in dit schooljaar. Herlaad het jaarplan en kies opnieuw een periode.");

    /// <summary>
    /// That thema is already placed in that period. A block may hold several thema's (Art. IX.3), so only the exact
    /// duplicate is refused: same thema, same period, same tier.
    /// </summary>
    public static OngeldigePlaatsingFout ThemaStaatErAl() =>
        new("Dit thema staat al in deze periode. Kies een ander thema of een andere periode.");
}
