namespace Jaarplanner.Application.Planning.Generatie.Response;

/// <summary>
/// One validated placement suggestion from the plan-generation response: "put this thema in the block that
/// starts on this date, for this reason". A value of this type <b>cannot exist invalid</b> — the constructor
/// re-validates what the parser checked (Art. IV.5).
/// <para>
/// <b>The block is identified by its start date, never by an ordinal.</b> Asking the model for "periode 3" and
/// storing that would produce a placement that silently relocates the moment the school edits a vakantie
/// (ADR-0020 §3). So the contract the prompt demands, and the only thing this type carries, is a date.
/// </para>
/// <para>
/// The thema is carried as its <b>name</b>, deliberately opaque here: whether that name resolves to a thema the
/// school actually owns is the service's concern (an unknown name is skipped, never fabricated — Art. IV.4),
/// exactly as <c>DoelMatchSuggestie</c> treats a leerplandoel code.
/// </para>
/// </summary>
public sealed record ThemaplaatsingSuggestie
{
    /// <summary>Creates a validated suggestion; re-validates its inputs.</summary>
    /// <param name="themaNaam">The proposed thema's name, as it appeared in the grounded prompt.</param>
    /// <param name="blokStart">The start date of the planningsblok the thema is proposed for.</param>
    /// <param name="motivatie">The model's one-line "waarom hier?" motivation (Art. IV.3).</param>
    public ThemaplaatsingSuggestie(string themaNaam, DateOnly blokStart, string motivatie)
    {
        ThemaNaam = Require(themaNaam, nameof(themaNaam));
        BlokStart = blokStart;
        Motivatie = Require(motivatie, nameof(motivatie));
    }

    /// <summary>The proposed thema's name (opaque here; resolved against the school's thema's by the service).</summary>
    public string ThemaNaam { get; }

    /// <summary>The start date of the proposed planningsblok — the stable block key (ADR-0020 §3).</summary>
    public DateOnly BlokStart { get; }

    /// <summary>The model's short motivation, surfaced to the teacher (Art. IV.3).</summary>
    public string Motivatie { get; }

    private static string Require(string value, string paramName)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new ArgumentException($"'{paramName}' is required.", paramName);
        }

        return value.Trim();
    }
}
