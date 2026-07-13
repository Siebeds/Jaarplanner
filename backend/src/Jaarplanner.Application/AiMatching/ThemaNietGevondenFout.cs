namespace Jaarplanner.Application.AiMatching;

/// <summary>
/// Thrown when a match run is requested for a thema that does not exist (E2-04). This is a caller
/// error (a bad id), distinct from the routine "invalid AI response" case which is a
/// <see cref="DoelMatchResultaat"/> failure, not an exception. The Api maps this to a 404.
/// </summary>
public sealed class ThemaNietGevondenFout : Exception
{
    public ThemaNietGevondenFout(string message)
        : base(message)
    {
    }
}
