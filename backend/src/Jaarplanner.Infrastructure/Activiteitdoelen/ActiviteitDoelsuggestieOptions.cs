namespace Jaarplanner.Infrastructure.Activiteitdoelen;

/// <summary>
/// The AI's goal proposals for an activiteit (FB-026, ADR-0054), bound from the <c>ActiviteitDoelsuggesties</c> section.
/// One value for the whole app (owner, 2026-09-17), so it changes without a code change.
/// </summary>
public sealed class ActiviteitDoelsuggestieOptions
{
    /// <summary>Configuration section name: <c>ActiviteitDoelsuggesties</c>.</summary>
    public const string SectionName = "ActiviteitDoelsuggesties";

    /// <summary>The largest value accepted at startup.</summary>
    public const int Bovengrens = 20;

    /// <summary>The most proposals one run keeps (owner, 2026-09-15: 5).</summary>
    public int MaxVoorstellen { get; init; } = 5;
}
