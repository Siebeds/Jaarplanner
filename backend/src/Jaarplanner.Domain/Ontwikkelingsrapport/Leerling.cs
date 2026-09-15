using Jaarplanner.Domain.Toegang;

namespace Jaarplanner.Domain.Ontwikkelingsrapport;

/// <summary>
/// A child in a K3 klas, as the ontwikkelingsrapport knows it (FB-001, FR-13.1, Art. IX.4, ADR-0035 §3.1). <b>Pupil
/// data</b>, and the one place a child enters the model (Art. VI.2, VI.7).
/// <para>
/// <b>Voornaam, achternaam and the klas, and nothing else</b> (Art. VI.7, ADR-0035 R14, R15). No date of birth, address,
/// parent or identifier from another system: a field added here is an amendment of Art. VI.7, not a migration.
/// <c>LeerlingTests</c> pins the property set so that one cannot slip in unnoticed.
/// </para>
/// <para>
/// <b>No name ever goes into an exception message.</b> A fault can reach a log (ADR-0035 §3.8), so validation names the
/// field that is wrong and never its value.
/// </para>
/// <para>
/// <b>It belongs to one klas, and through it to one schooljaar</b> (ADR-0035 §3.1). A child who changes klas is deleted
/// in the one and added in the other (default D10), so <see cref="KlasId"/> never changes.
/// </para>
/// </summary>
public sealed class Leerling
{
    /// <summary>The longest voornaam or achternaam accepted, each.</summary>
    public const int MaxNaamLengte = 100;

    // EF Core materialisation only.
    private Leerling()
    {
        Voornaam = null!;
        Achternaam = null!;
    }

    /// <summary>Adds a child to a klas.</summary>
    /// <param name="klasId">The klas the child is in. Required. That it grants K3 is the service's check (D9).</param>
    /// <param name="voornaam">Typed by hand (R15). Required, trimmed, at most <see cref="MaxNaamLengte"/> characters.</param>
    /// <param name="achternaam">Typed by hand (R15). Required, trimmed, at most <see cref="MaxNaamLengte"/> characters.</param>
    public Leerling(Guid klasId, string voornaam, string achternaam)
    {
        KlasId = klasId == Guid.Empty ? throw new ArgumentException("'klasId' is required.", nameof(klasId)) : klasId;
        Voornaam = Keur(voornaam, nameof(voornaam));
        Achternaam = Keur(achternaam, nameof(achternaam));
    }

    /// <summary>Surrogate identity.</summary>
    public Guid Id { get; private set; } = Guid.NewGuid();

    /// <summary>The klas the child is in. Immutable (D10).</summary>
    public Guid KlasId { get; private set; }

    /// <summary>The child's first name.</summary>
    public string Voornaam { get; private set; }

    /// <summary>The child's family name.</summary>
    public string Achternaam { get; private set; }

    /// <summary>
    /// Whether a klas with this stated jaarfase can have leerlingen: only one that grants K3 (default D9, Art. VI.7).
    /// <para>
    /// <b>Asked of <see cref="Leeftijdsrechten.VoorKlas"/>, the one place that maps a klas to its leeftijden</b> (Art.
    /// VI.1, R22), and not of the jaarfase string directly. So directie's graadklas decision (Art. XIV), which changes
    /// that place, changes this with it, and a klas without a stated jaarfase fails closed. The create, the rights (the
    /// <c>Rapportklas</c> relations) and the klas edit all ask here.
    /// </para>
    /// </summary>
    /// <param name="gesteldeJaarfase">The klas's <c>Jaarfase</c>, exactly as stored.</param>
    public static bool KlasKanLeerlingenHebben(string? gesteldeJaarfase) =>
        Leeftijdsrechten.VoorKlas(gesteldeJaarfase).Contains("K3", StringComparer.Ordinal);

    /// <summary>Corrects the child's name. Both are checked before either changes, so a refusal changes nothing.</summary>
    public void Wijzig(string voornaam, string achternaam)
    {
        var nieuweVoornaam = Keur(voornaam, nameof(voornaam));
        var nieuweAchternaam = Keur(achternaam, nameof(achternaam));

        Voornaam = nieuweVoornaam;
        Achternaam = nieuweAchternaam;
    }

    /// <summary>The trimmed name, or a refusal that names the parameter and never the value (ADR-0035 §3.8).</summary>
    private static string Keur(string? waarde, string paramName)
    {
        if (string.IsNullOrWhiteSpace(waarde))
        {
            throw new ArgumentException($"'{paramName}' is required.", paramName);
        }

        var getrimd = waarde.Trim();
        if (getrimd.Length > MaxNaamLengte)
        {
            throw new ArgumentException($"'{paramName}' is at most {MaxNaamLengte} characters long.", paramName);
        }

        return getrimd;
    }
}
