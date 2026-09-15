namespace Jaarplanner.Application.Ai;

/// <summary>
/// Thrown when an AI run would otherwise search the whole Op.stap catalogue (TB-007): no jaar/fase was chosen and there is
/// none to take from the thema or subthema. Nothing was read and the model was not called. The message is a Dutch sentence
/// asking for the choice (Art. II.3), so the Api maps this to a 400 with the message as its detail.
/// </summary>
public sealed class JaarfaseKeuzeNodigFout : Exception
{
    public JaarfaseKeuzeNodigFout(string message)
        : base(message)
    {
    }
}
