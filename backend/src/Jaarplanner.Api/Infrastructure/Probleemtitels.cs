namespace Jaarplanner.Api.Infrastructure;

/// <summary>
/// The RFC 7807 <c>ProblemDetails.Title</c> values, in one place.
/// <para>
/// <b>Why this exists (E1-15 audit).</b> These titles are **user-facing Dutch** (Art. II.3), and by
/// 2026-07-31 the same literal <c>"Ongeldige aanvraag"</c> was defined independently in five files: three
/// exception handlers and two import controllers. Four of those predated E1-15 and <b>the fifth was
/// E1-15's own</b>, which is the honest way to put it: this story did not inherit a bad situation, it
/// joined one. Five definitions of one sentence is precisely the drift Art. II.3 exists to stop, because
/// the day one of them is reworded the API answers two different Dutch titles for the same class of
/// fault. So they are shared from here instead.
/// </para>
/// <para>
/// Keep this list short. It is for titles that classify a fault, not for per-fault detail: the
/// <c>Detail</c> text is written where the fault is raised, because only there is the row number, the
/// discipline or the offending code known.
/// </para>
/// </summary>
public static class Probleemtitels
{
    /// <summary>The request itself is wrong (400): missing input, wrong file type, unreadable upload.</summary>
    public const string OngeldigeAanvraag = "Ongeldige aanvraag";

    /// <summary>The addressed resource does not exist (404).</summary>
    public const string NietGevonden = "Niet gevonden";

    /// <summary>
    /// A curriculum (re-)import was refused as a whole (409, E1-15): the file may be well-formed while the
    /// data it needs is not there, or it belongs to another discipline. Nothing was changed.
    /// </summary>
    public const string ImportNietDoorgevoerd = "Import niet doorgevoerd";

    /// <summary>
    /// The jaarplan generation is switched off (409, ADR-0049): the request is fine, the feature is unavailable until its
    /// rework for plans with dates lands. Nothing was changed.
    /// </summary>
    public const string GeneratieUitgeschakeld = "Genereren staat uit";

    /// <summary>
    /// KOV's Op.stap data could not be fetched (502, E1-12): the API was unreachable or too slow, or it answered something
    /// the import does not recognise. Worded to hold for all of those; "niet bereikbaar" would be false for a source that
    /// answered. Nothing was changed, and the request itself was fine.
    /// </summary>
    public const string OpstapNietOpgehaald = "Op.stap niet opgehaald";

    /// <summary>
    /// The request carries no session (401, E6-01). The frontend answers it by sending the browser to the sign-in, so a
    /// teacher rarely reads it; it is Dutch because a teacher is who it would be for.
    /// </summary>
    public const string NietAangemeld = "Niet aangemeld";

    /// <summary>The session is valid but the action is not allowed for this person (403). E6-02 is what produces it.</summary>
    public const string GeenToegang = "Geen toegang";

    /// <summary>
    /// A gebruikerbeheer change was refused by the current state (409, E6-04): the sign-in name exists already, or the
    /// change would leave the school without a directie. The request was fine and nothing was changed.
    /// </summary>
    public const string NietDoorgevoerd = "Niet doorgevoerd";
}
