namespace Jaarplanner.Application.Planning.Generatie.Response;

/// <summary>
/// One validated placement suggestion from the plan-generation response: "start this thema in the lesweek of this
/// Monday, for this reason" (ADR-0055). A value of this type <b>cannot exist invalid</b>: the constructor re-validates
/// what the parser checked (Art. IV.5).
/// <para>
/// The model names a week, not days. Which day the thema starts on and where it ends is the service's to work out from
/// the school's calendar and the plan, so a model that miscounts cannot put a thema on a closed day or over another one.
/// </para>
/// <para>
/// The thema is carried as its <b>name</b>, deliberately opaque here: whether that name resolves to a thema the school
/// actually owns is the service's concern (an unknown name is skipped, never fabricated, Art. IV.4).
/// </para>
/// </summary>
public sealed record ThemaplaatsingSuggestie
{
    /// <summary>Creates a validated suggestion; re-validates its inputs.</summary>
    /// <param name="themaNaam">The proposed thema's name, as it appeared in the grounded prompt.</param>
    /// <param name="startweek">The Monday of the lesweek the thema is proposed to start in.</param>
    /// <param name="motivatie">The model's one-line "waarom hier?" motivation (Art. IV.3).</param>
    public ThemaplaatsingSuggestie(string themaNaam, DateOnly startweek, string motivatie)
    {
        ThemaNaam = Require(themaNaam, nameof(themaNaam));
        Startweek = startweek;
        Motivatie = Require(motivatie, nameof(motivatie));
    }

    /// <summary>The proposed thema's name (opaque here; resolved against the school's thema's by the service).</summary>
    public string ThemaNaam { get; }

    /// <summary>The Monday of the proposed start week, as the model gave it.</summary>
    public DateOnly Startweek { get; }

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
