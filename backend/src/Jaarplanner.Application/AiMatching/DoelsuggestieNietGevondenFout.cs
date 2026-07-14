namespace Jaarplanner.Application.AiMatching;

/// <summary>
/// Thrown when a status change (E2-05) targets a doelsuggestie that does not exist on the given
/// thema (a bad suggestion id). Like <see cref="ThemaNietGevondenFout"/> this is a caller error;
/// the Api maps it to a 404.
/// </summary>
public sealed class DoelsuggestieNietGevondenFout : Exception
{
    public DoelsuggestieNietGevondenFout(string message)
        : base(message)
    {
    }
}
