namespace Jaarplanner.Application.AiMatching;

/// <summary>
/// Thrown when a teacher status change (E2-05) asks for a status the teacher may not set on a
/// doelsuggestie. The teacher decision is one of <c>aanvaard</c> / <c>geweigerd</c> / <c>manueel</c>
/// (Art. IV.1/IV.2); <c>voorgesteld</c> is AI-only and can never be assigned by hand — nothing is
/// "re-proposed" by the teacher. The Api maps this to a 400.
/// </summary>
public sealed class OngeldigeSuggestieStatusFout : Exception
{
    public OngeldigeSuggestieStatusFout(string message)
        : base(message)
    {
    }
}
