namespace Jaarplanner.Application.AiAuthoring;

/// <summary>
/// The outcome of one goal-first authoring assist run (E2-07, step 2 or step 6). Like the matching
/// result types it is a <b>result type, not an exception</b>: a malformed AI response is a routine,
/// expected case (models drift, Art. IV.5) the wizard must handle — on failure the
/// <see cref="Suggesties"/> list is empty and <see cref="Fout"/> explains why.
/// <para>
/// On success it carries the advisory <see cref="Suggesties"/> (all transient — nothing is
/// persisted or auto-applied, Art. IV.1/IV.2) plus <see cref="OvergeslagenOnbekend"/>: codes the
/// model returned that are not in the loaded leerplandoel set and were therefore skipped, never
/// fabricated (Art. III.5/IV.4).
/// </para>
/// </summary>
public sealed record ThemaOpbouwAdviesResultaat
{
    private static readonly IReadOnlyList<ThemaOpbouwAdvies> LeegSuggesties = [];
    private static readonly IReadOnlyList<string> LeegCodes = [];

    private ThemaOpbouwAdviesResultaat(
        bool isGeslaagd,
        string? fout,
        IReadOnlyList<ThemaOpbouwAdvies> suggesties,
        IReadOnlyList<string> overgeslagenOnbekend)
    {
        IsGeslaagd = isGeslaagd;
        Fout = fout;
        Suggesties = suggesties;
        OvergeslagenOnbekend = overgeslagenOnbekend;
    }

    /// <summary><c>true</c> when the AI response was valid and produced (zero or more) advisory suggestions.</summary>
    public bool IsGeslaagd { get; }

    /// <summary>A short, English diagnostic when the AI response was invalid; <c>null</c> on success.</summary>
    public string? Fout { get; }

    /// <summary>The advisory suggestions (transient, never auto-applied — Art. IV.1/IV.2). Empty on failure.</summary>
    public IReadOnlyList<ThemaOpbouwAdvies> Suggesties { get; }

    /// <summary>Codes the model returned that are not in the loaded set — skipped, not fabricated (Art. III.5).</summary>
    public IReadOnlyList<string> OvergeslagenOnbekend { get; }

    /// <summary>Builds a success result carrying the advisory suggestions.</summary>
    public static ThemaOpbouwAdviesResultaat Geslaagd(
        IReadOnlyList<ThemaOpbouwAdvies> suggesties,
        IReadOnlyList<string> overgeslagenOnbekend) =>
        new(isGeslaagd: true, fout: null,
            suggesties ?? LeegSuggesties,
            overgeslagenOnbekend ?? LeegCodes);

    /// <summary>Builds a failure result — no suggestions (Art. IV.5).</summary>
    public static ThemaOpbouwAdviesResultaat Mislukt(string fout) =>
        new(isGeslaagd: false, fout, LeegSuggesties, LeegCodes);
}
