namespace Jaarplanner.Application.AiMatching;

/// <summary>
/// Thrown when the FR-4.3 <i>"aanpassen"</i> substitution (E2-08) cannot be applied to a doelsuggestie:
/// the replacement code is blank, is not a code the loaded read-only Op.stap set carries (Art. III.5 —
/// a link must never point at a fabricated goal), is the suggestion's own current code (nothing would
/// change), or is already linked to this thema (which would give the thema two links to one doel and
/// double-count it in dekking, Art. V). The Api maps this to a 400 — the teacher can act on it.
/// </summary>
public sealed class OngeldigeDoelsubstitutieFout : Exception
{
    public OngeldigeDoelsubstitutieFout(string message)
        : base(message)
    {
    }
}
