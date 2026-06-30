namespace Jaarplanner.Domain.Schoolcontent;

/// <summary>
/// A concrete, age-differentiated goal at the <c>(<see cref="SubthemaId"/> × <see cref="Leeftijd"/>)</c>
/// level (Art. IX.2) — <b>class/age-scoped</b> (it inherits the class scope from its owning
/// <see cref="Subthema"/> and pins its own <see cref="Leeftijd"/>). It builds up toward the
/// thema's overarching themadoelen and links to a read-only leerplandoel through its owned
/// <see cref="Koppeling"/>. Themes are interdisciplinary, so subdoelen routinely span multiple
/// disciplines. Mutable autonomous school content (Art. III).
/// </summary>
public sealed class Subdoel
{
    // EF Core materialisation only.
    private Subdoel()
    {
        Leeftijd = null!;
        Koppeling = null!;
    }

    internal Subdoel(Guid subthemaId, string leeftijd, DoelKoppeling koppeling)
    {
        SubthemaId = subthemaId;
        Leeftijd = Require(leeftijd, nameof(leeftijd));
        Koppeling = koppeling ?? throw new ArgumentNullException(nameof(koppeling));
    }

    /// <summary>Surrogate identity.</summary>
    public Guid Id { get; private set; } = Guid.NewGuid();

    /// <summary>The owning (class/age-scoped) subthema.</summary>
    public Guid SubthemaId { get; private set; }

    /// <summary>The age this subdoel is differentiated for — part of the (subthema × leeftijd) identity (Art. IX.2).</summary>
    public string Leeftijd { get; private set; }

    /// <summary>The link to the read-only leerplandoel, with status + AI motivation (Art. IV.2).</summary>
    public DoelKoppeling Koppeling { get; private set; }

    private static string Require(string value, string paramName)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new ArgumentException($"'{paramName}' is required.", paramName);
        }

        return value.Trim();
    }
}
