namespace Jaarplanner.Application.AiMatching.Response;

/// <summary>
/// The explicit outcome of parsing + validating a raw AI completion against the structured-JSON
/// match contract (Art. IV.5). It is deliberately a <b>result type, not an exception</b>: malformed
/// model output is an expected, routine case (models drift), so the caller must handle it rather
/// than have it thrown up the stack.
/// <para>
/// This type is the enforcement point of the Art. IV.5 guarantee: a caller either gets
/// <see cref="IsGeldig"/> = <c>true</c> with a fully validated <see cref="Suggesties"/> list, or
/// <see cref="IsGeldig"/> = <c>false</c> with a diagnostic <see cref="Fout"/> and an <b>empty</b>
/// suggestion list. There is no third, half-parsed state — invalid AI output never yields a
/// <see cref="DoelMatchSuggestie"/>.
/// </para>
/// </summary>
public sealed record DoelMatchParseResultaat
{
    private static readonly IReadOnlyList<DoelMatchSuggestie> Leeg = Array.Empty<DoelMatchSuggestie>();

    private DoelMatchParseResultaat(bool isGeldig, IReadOnlyList<DoelMatchSuggestie> suggesties, string? fout)
    {
        IsGeldig = isGeldig;
        Suggesties = suggesties;
        Fout = fout;
    }

    /// <summary><c>true</c> when the completion was valid and produced (possibly zero) suggestions.</summary>
    public bool IsGeldig { get; }

    /// <summary>
    /// The validated suggestions. Non-empty only when <see cref="IsGeldig"/> is <c>true</c>; always
    /// empty on failure. An empty list on success is legitimate: the model found no matches.
    /// </summary>
    public IReadOnlyList<DoelMatchSuggestie> Suggesties { get; }

    /// <summary>A short, English diagnostic describing why parsing failed; <c>null</c> on success.</summary>
    public string? Fout { get; }

    /// <summary>Builds a success result carrying the validated suggestions.</summary>
    public static DoelMatchParseResultaat Geldig(IReadOnlyList<DoelMatchSuggestie> suggesties) =>
        new(isGeldig: true, suggesties ?? Leeg, fout: null);

    /// <summary>Builds a failure result carrying a diagnostic reason and no suggestions.</summary>
    public static DoelMatchParseResultaat Ongeldig(string fout) =>
        new(isGeldig: false, Leeg, fout);
}
