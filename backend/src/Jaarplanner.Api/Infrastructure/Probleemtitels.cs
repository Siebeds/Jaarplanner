namespace Jaarplanner.Api.Infrastructure;

/// <summary>
/// The RFC 7807 <c>ProblemDetails.Title</c> values, in one place.
/// <para>
/// <b>Why this exists (E1-15 audit).</b> These titles are **user-facing Dutch** (Art. II.3), and by
/// 2026-07-31 the same literal <c>"Ongeldige aanvraag"</c> was defined independently in five files: three
/// exception handlers and two import controllers. Five definitions of one sentence is precisely the drift
/// Art. II.3 exists to stop: the day one of them is reworded, the API answers two different Dutch titles
/// for the same class of fault. Adding a sixth was not defensible, so they are shared from here instead.
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
}
