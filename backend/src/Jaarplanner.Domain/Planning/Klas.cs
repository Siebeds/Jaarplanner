namespace Jaarplanner.Domain.Planning;

/// <summary>
/// A class group (Art. IX.3). Minimal here — the full planning model (Schooljaar, Jaarplan,
/// planningsblokken) arrives in a later story. It exists now so the class/age-scoped school
/// content (<c>Subthema</c>/<c>Subdoel</c>/<c>Activiteit</c>, Art. IX.2) can express its required
/// <c>Klas</c> association: those entities are scoped per class &amp; age and must not exist
/// school-wide.
/// </summary>
public sealed class Klas
{
    // EF Core materialisation only.
    private Klas()
    {
        Naam = null!;
    }

    /// <summary>Creates a class group.</summary>
    /// <param name="naam">The class name (e.g. "L3 — derde leerjaar").</param>
    /// <param name="leerjaar">The leerjaar/leeftijdsgroep ordinal (e.g. 3 for L3); 0 is allowed for kleuter groepen modelled elsewhere.</param>
    public Klas(string naam, int leerjaar)
    {
        Naam = Require(naam, nameof(naam));
        Leerjaar = leerjaar;
    }

    /// <summary>Surrogate identity.</summary>
    public Guid Id { get; private set; } = Guid.NewGuid();

    /// <summary>The class name (e.g. "L3 — derde leerjaar").</summary>
    public string Naam { get; private set; }

    /// <summary>The leerjaar / leeftijdsgroep ordinal.</summary>
    public int Leerjaar { get; private set; }

    /// <summary>
    /// Renames / re-grades the class group (CRUD).
    /// <para>
    /// A <c>Klas</c> is autonomous planning data and is <b>meant</b> to be editable, so the mutator lives
    /// here and validates in one place. Writing these values through EF's property metadata instead —
    /// the technique <c>OpstapImportService</c> uses — would be borrowing a trick whose whole purpose is
    /// to keep <i>read-only curriculum</i> content unmutatable (Art. III.1), and would duplicate this
    /// invariant so that any rule added to the constructor would silently not apply on update.
    /// </para>
    /// </summary>
    public void Wijzig(string naam, int leerjaar)
    {
        Naam = Require(naam, nameof(naam));
        Leerjaar = leerjaar;
    }

    private static string Require(string value, string paramName)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new ArgumentException($"'{paramName}' is required.", paramName);
        }

        return value.Trim();
    }
}
