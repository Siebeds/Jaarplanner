namespace Jaarplanner.Application.Kat.Detectoren;

/// <summary>
/// Where a signal sends the teacher, as a path the frontend router actually has (FB-069). Not copy, so Art. II.3 does
/// not apply: it is a route, and the one thing a route has to be is real.
/// <para>
/// <b>The klas is not in the path.</b> These screens read the klas from the klasfilter, not from the URL, so a signal
/// carries its <c>KlasId</c> beside the path and whatever shows it (FB-071) selects the klas before following it.
/// </para>
/// </summary>
internal static class Agendaverwijzing
{
    /// <summary>The dekkingsoverzicht: where a goal that is about to go uncovered is looked at.</summary>
    public const string Dekking = "/dekking";

    /// <summary>The periods of the plan: where a subthema is placed.</summary>
    public const string Periodes = "/agenda/periodes";
}
