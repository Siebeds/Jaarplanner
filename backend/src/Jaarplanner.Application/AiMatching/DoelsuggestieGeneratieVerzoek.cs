using Jaarplanner.Application.AiAuthoring;

namespace Jaarplanner.Application.AiMatching;

/// <summary>
/// What the teacher asks for when they trigger a match run for a thema (E2-08, FR-4.1): optionally,
/// <b>which</b> Op.stap leerplandoelen the AI may choose from.
/// <para>
/// <b>The jaar/fasen bound the run</b> (TB-007). The ones in <see cref="Selectie"/> when it names any; otherwise the
/// leeftijden of the thema's subthema's. A thema without subthema's and a selection without jaar/fasen is refused, so a
/// run never sends the whole catalogue. The screen offers the choice, pre-set to the subthema's leeftijden.
/// </para>
/// <para>
/// <b>The discipline dimension stays the caller's.</b> "Which disciplines does the school start with?" is still an open
/// Art. XIV decision, so neither the controller nor the service picks one.
/// </para>
/// </summary>
public sealed record DoelsuggestieGeneratieVerzoek
{
    /// <summary>The bounding selection for the candidate leerplandoelen; without jaar/fasen the thema's own leeftijden apply.</summary>
    public LeerdoelSelectie? Selectie { get; init; }
}
