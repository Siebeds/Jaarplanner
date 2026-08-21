namespace Jaarplanner.Domain.Schoolcontent;

/// <summary>
/// One driving question of a kennisrijk subthema (Art. IX.2). A subthema can carry <b>multiple</b>
/// onderzoeksvragen, each with its own required <see cref="Vraag"/> text and an optional
/// <see cref="Probleemstelling"/>. Mutable autonomous school content (Art. III).
/// </summary>
public sealed class Onderzoeksvraag
{
    // EF Core materialisation only.
    private Onderzoeksvraag()
    {
        Vraag = null!;
    }

    internal Onderzoeksvraag(Guid subthemaId, string vraag, string? probleemstelling)
    {
        SubthemaId = subthemaId;
        Vraag = Require(vraag, nameof(vraag));
        Probleemstelling = Optional(probleemstelling);
    }

    /// <summary>Surrogate identity.</summary>
    public Guid Id { get; private set; } = Guid.NewGuid();

    /// <summary>The owning (class/age-scoped) subthema.</summary>
    public Guid SubthemaId { get; private set; }

    /// <summary>The driving research question text. Required.</summary>
    public string Vraag { get; private set; }

    /// <summary>The optional problem statement that contextualises the question.</summary>
    public string? Probleemstelling { get; private set; }

    /// <summary>Updates the question text and problem statement in place.</summary>
    public void Wijzig(string vraag, string? probleemstelling)
    {
        Vraag = Require(vraag, nameof(vraag));
        Probleemstelling = Optional(probleemstelling);
    }

    private static string Require(string value, string paramName)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new ArgumentException($"'{paramName}' is required.", paramName);
        }

        return value.Trim();
    }

    private static string? Optional(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
