namespace Jaarplanner.Domain.Curriculum;

/// <summary>
/// A government-decreed eindterm (attainment target), embedded in Op.stap and concorded
/// to leerplandoelen via <see cref="Ref"/>. Read-only reference data (Art. III.1): the
/// decreed content is never mutated by the application. The minimumdoel level is what the
/// onderwijsinspectie tests, so it anchors coverage (Art. V.2).
/// <para>
/// <see cref="Ref"/> is the concordance key (Excel column D = LfMD + nrMD, Art. VII.1) and
/// the stable identity. Immutability is structural (private setters, single validating
/// constructor, no mutators); the private parameterless constructor is for EF Core only.
/// </para>
/// </summary>
public sealed class Minimumdoel
{
    // EF Core materialisation only — not an application construction path.
    private Minimumdoel()
    {
        Ref = null!;
        Leeftijd = null!;
        Nr = null!;
        Omschrijving = null!;
    }

    /// <summary>Constructs a minimumdoel.</summary>
    /// <param name="minimumdoelRef">The concordance key (Excel D = leeftijd + nr). Identity.</param>
    /// <param name="leeftijd">The minimumdoel leeftijd code (K- = einde 3e kleuter, 4- = 4e lj, 6- = 6e lj).</param>
    /// <param name="nr">The decreed minimumdoel number (Excel C).</param>
    /// <param name="omschrijving">The decreed description of the eindterm.</param>
    public Minimumdoel(string minimumdoelRef, string leeftijd, string nr, string omschrijving)
    {
        Ref = Require(minimumdoelRef, nameof(minimumdoelRef));
        Leeftijd = Require(leeftijd, nameof(leeftijd));
        Nr = Require(nr, nameof(nr));
        Omschrijving = Require(omschrijving, nameof(omschrijving));
    }

    /// <summary>The concordance key (Excel D) — stable identity.</summary>
    public string Ref { get; private set; }

    /// <summary>The minimumdoel leeftijd code: "K-", "4-", or "6-".</summary>
    public string Leeftijd { get; private set; }

    /// <summary>The decreed minimumdoel number.</summary>
    public string Nr { get; private set; }

    /// <summary>The decreed description of the eindterm.</summary>
    public string Omschrijving { get; private set; }

    private static string Require(string value, string paramName)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new ArgumentException($"'{paramName}' is required.", paramName);
        }

        return value.Trim();
    }
}
