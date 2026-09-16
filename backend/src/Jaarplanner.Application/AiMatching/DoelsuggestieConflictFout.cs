namespace Jaarplanner.Application.AiMatching;

/// <summary>
/// Thrown when storing a thema's doelsuggesties collides with a change someone else made at the same moment (FB-053): a
/// person linked the same minimumdoel by hand while a proposal of it was accepted, or two runs proposed it together. The
/// unique indexes on (thema, minimumdoel) refuse the second write; the Api maps this to a 409 with a Dutch sentence.
/// </summary>
public sealed class DoelsuggestieConflictFout : Exception
{
    public DoelsuggestieConflictFout(string message, Exception? innerException = null)
        : base(message, innerException)
    {
    }
}
