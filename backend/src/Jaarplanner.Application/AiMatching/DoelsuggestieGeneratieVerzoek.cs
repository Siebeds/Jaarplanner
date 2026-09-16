namespace Jaarplanner.Application.AiMatching;

/// <summary>
/// What the person asks for when they request doelsuggesties for a thema (FB-053, FR-4.1): optionally, for which
/// leeftijden. The minimumdoelen searched are those of the mijlpalen these leeftijden meet (ADR-0050 O3).
/// <para>
/// Without leeftijden the leeftijden of the thema's subthema's apply; a thema without subthema's is then refused, so the
/// person picks them first (TB-007). The screen offers the choice, pre-set to the subthema's leeftijden.
/// </para>
/// </summary>
public sealed record DoelsuggestieGeneratieVerzoek
{
    /// <summary>The jaar/fase codes (JK, K2, K3, L1–L6) the run is for; null or empty means the subthema's leeftijden.</summary>
    public IReadOnlyCollection<string>? JaarFasen { get; init; }
}
