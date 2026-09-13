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

    /// <summary>
    /// Import-managed review marker (E1-21, ADR-0032 consequences): <c>true</c> when the last applied minimumdoelen
    /// import no longer found this ref anywhere in the source, neither as a usable row nor as a refused one. The row is
    /// <b>kept</b>, because leerplandoelen concord to it through a Restrict FK and a vanished eindterm is for a human to
    /// review (Art. III.4). It is not decreed content: the only writer is the import, and a later import that finds the
    /// ref again clears it. Mirrors <see cref="Leerplandoel.NietMeerInOpstap"/>.
    /// </summary>
    public bool NietMeerInOpstap { get; private set; }

    /// <summary>
    /// Import-managed (E1-22): why no loaded leerplandoel concords this minimumdoel, as the last applied leerplandoelen
    /// import derived it from its snapshot. Null when a stored leerplandoel points at it (flagged or not), when the snapshot
    /// holds an importable goal that does, when the minimumdoel itself is no longer in Op.stap, or when nothing is known.
    /// "No longer in Op.stap" means flagged <see cref="NietMeerInOpstap"/> (the minimumdoelen import clears the reason in
    /// the apply that sets the flag) or absent from the minimumdoelen list the leerplandoelen import itself read.
    /// Recomputed on every applied leerplandoelen import, so it describes the version that is loaded. Not decreed
    /// content (Art. III.1): like <see cref="NietMeerInOpstap"/>, only the imports write it.
    /// </summary>
    public ZonderLeerplandoelReden? ZonderLeerplandoelReden { get; private set; }

    /// <summary>
    /// With <see cref="Curriculum.ZonderLeerplandoelReden.AlleenOvergeslagenDoelsets"/>: KOV's marks of those goal sets,
    /// comma-separated and sorted (<c>Z</c>, <c>V,Z</c>). Null otherwise.
    /// </summary>
    public string? ZonderLeerplandoelDoelsets { get; private set; }

    private static string Require(string value, string paramName)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new ArgumentException($"'{paramName}' is required.", paramName);
        }

        return value.Trim();
    }
}
