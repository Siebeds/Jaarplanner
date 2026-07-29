namespace Jaarplanner.Application.Planning.Generatie.Response;

/// <summary>
/// The explicit outcome of parsing + validating a raw plan-generation completion (Art. IV.5), the planning
/// sibling of <c>DoelMatchParseResultaat</c> and deliberately the same shape: a <b>result type, not an
/// exception</b>, because malformed model output is a routine case the caller must handle rather than something
/// thrown up the stack.
/// <para>
/// This is the enforcement point of Art. IV.5's "validated before use": a caller either gets
/// <see cref="IsGeldig"/> = <c>true</c> with a fully validated <see cref="Plaatsingen"/> list, or
/// <see cref="IsGeldig"/> = <c>false</c> with a diagnostic <see cref="Fout"/> and an <b>empty</b> list. There is
/// no third, half-parsed state — so an invalid response can never produce a <i>partially</i> applied plan, which
/// on a year plan would be worse than none: a teacher cannot see which half the model got wrong.
/// </para>
/// </summary>
public sealed record JaarplanParseResultaat
{
    private static readonly IReadOnlyList<ThemaplaatsingSuggestie> Leeg = [];

    private JaarplanParseResultaat(bool isGeldig, IReadOnlyList<ThemaplaatsingSuggestie> plaatsingen, string? fout)
    {
        IsGeldig = isGeldig;
        Plaatsingen = plaatsingen;
        Fout = fout;
    }

    /// <summary><c>true</c> when the completion was valid and produced (possibly zero) placements.</summary>
    public bool IsGeldig { get; }

    /// <summary>
    /// The validated placement suggestions. Always empty on failure. An empty list on success is legitimate: the
    /// model proposed nothing.
    /// </summary>
    public IReadOnlyList<ThemaplaatsingSuggestie> Plaatsingen { get; }

    /// <summary>A short, English diagnostic describing why validation failed; <c>null</c> on success.</summary>
    public string? Fout { get; }

    /// <summary>Builds a success result carrying the validated placements.</summary>
    public static JaarplanParseResultaat Geldig(IReadOnlyList<ThemaplaatsingSuggestie> plaatsingen) =>
        new(isGeldig: true, plaatsingen ?? Leeg, fout: null);

    /// <summary>Builds a failure result carrying a diagnostic reason and no placements.</summary>
    public static JaarplanParseResultaat Ongeldig(string fout) =>
        new(isGeldig: false, Leeg, fout);
}
