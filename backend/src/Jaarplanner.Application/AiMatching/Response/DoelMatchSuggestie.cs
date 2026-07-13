namespace Jaarplanner.Application.AiMatching.Response;

/// <summary>
/// One validated goal-match suggestion parsed from the model's structured-JSON response
/// (Art. IV.5): a single Op.stap leerplandoel <see cref="Code"/> plus the AI's short, one-line
/// <see cref="Motivatie"/> ("waarom past dit doel hier?", Art. IV.3).
/// <para>
/// This is the shape E2-04 persists — each instance becomes a <c>DoelKoppeling</c> with status
/// <c>voorgesteld</c> and this <see cref="Motivatie"/> as its <c>aiMotivatie</c> (Art. IV.1/IV.2).
/// The invariants are structural: the validating constructor rejects an empty code or motivation,
/// so a <see cref="DoelMatchSuggestie"/> can <b>never</b> exist in an invalid state. That is the
/// type-level half of the Art. IV.5 guarantee — invalid AI output cannot become a suggestion object.
/// </para>
/// <para>
/// The <see cref="Code"/> is treated as an <b>opaque</b> string at this layer: we validate its
/// shape (present, non-blank), not its existence — resolving it against the loaded
/// <c>Leerplandoel</c> data is a downstream concern (E2-04).
/// </para>
/// </summary>
public sealed record DoelMatchSuggestie
{
    /// <summary>Constructs a validated suggestion; throws on a blank code or motivation.</summary>
    /// <param name="code">The suggested leerplandoel code (opaque here — not looked up).</param>
    /// <param name="motivatie">The AI's short, one-line motivation for the match.</param>
    public DoelMatchSuggestie(string code, string motivatie)
    {
        Code = Require(code, nameof(code));
        Motivatie = NormaliseerRegel(Require(motivatie, nameof(motivatie)));
    }

    /// <summary>The suggested leerplandoel code — stable identity used downstream (Art. III.5).</summary>
    public string Code { get; }

    /// <summary>The AI's short, single-line motivation (Art. IV.3), surfaced in the UI (E2-05).</summary>
    public string Motivatie { get; }

    private static string Require(string value, string paramName)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new ArgumentException($"'{paramName}' is required.", paramName);
        }

        return value.Trim();
    }

    // Conservative repair only: collapse any internal line breaks / runs of whitespace into a single
    // space so the motivation stays the "one-line" text the contract promises. Never fabricates text.
    private static string NormaliseerRegel(string value)
    {
        var chars = value.ToCharArray();
        var builder = new System.Text.StringBuilder(chars.Length);
        var previousWasSpace = false;

        foreach (var c in chars)
        {
            if (char.IsWhiteSpace(c))
            {
                if (!previousWasSpace)
                {
                    builder.Append(' ');
                }

                previousWasSpace = true;
            }
            else
            {
                builder.Append(c);
                previousWasSpace = false;
            }
        }

        return builder.ToString().Trim();
    }
}
