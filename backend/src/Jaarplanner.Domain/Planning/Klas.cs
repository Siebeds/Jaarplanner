namespace Jaarplanner.Domain.Planning;

/// <summary>
/// A class group (Art. IX.3). It exists so the class/age-scoped school content
/// (<c>Subthema</c>/<c>Subdoel</c>/<c>Activiteit</c>, Art. IX.2) can express its required <c>Klas</c>
/// association — those entities are scoped per class &amp; age and must not exist school-wide — and it is the
/// unit a <see cref="Jaarplan"/> is generated for (E3-01).
/// <para>
/// <b>A klas belongs to exactly one <see cref="Schooljaar"/></b> (Art. IX.3: "Schooljaar — contains multiple
/// klassen"; E3-01). The containment is required rather than optional, because everything downstream needs it:
/// a jaarplan is planned over <i>a</i> year's planningsblokken, and those blocks are derived from that year's
/// vakantiestructuur. A nullable <c>SchooljaarId</c> would mean "contains multiple klassen" held only when
/// somebody remembered to set it, which is not containment.
/// </para>
/// <para>
/// <b>Class names stay unique school-wide</b> (the pre-existing unique index), not per schooljaar. The
/// school-content Excel import resolves a class <b>by name</b>, so scoping the uniqueness per year would make
/// that resolution ambiguous the moment a second year exists. The consequence — "L3" cannot exist in two
/// schooljaren at once — is inherited, not introduced here, and is E8-03's ("kopiëren van een vorig
/// schooljaar") problem to solve deliberately.
/// </para>
/// <para>
/// <b><see cref="Leerjaar"/> is not assumed to be singular downstream.</b> How a graadklas / menggroep spanning
/// several leerjaren is modelled is an open decision (Art. XIV), and the <see cref="Jaarplan"/> aggregate has no
/// invariant that mentions this value.
/// <para>
/// <b>It is no longer purely descriptive, though (E5-02, owner ruling 2026-08-04).</b> This documentation used to say
/// "no planning logic keys on this value"; that stopped being true when a class began being measured against its own
/// jaar/fase, because <c>Jaarfasen.VoorLeerjaar</c> turns this ordinal into the **denominator of every coverage
/// figure**. The two unresolved cases are handled by refusing rather than guessing: a value that maps to nothing
/// (a graadklas ordinal) yields <c>null</c>, and <c>DekkingService</c> then widens the scope and declares that it
/// did. <c>0</c> means "een kleutergroep" and cannot say which kleuterjaar, so it yields all three kleuter codes.
/// </para>
/// </para>
/// </summary>
public sealed class Klas
{
    // EF Core materialisation only.
    private Klas()
    {
        Naam = null!;
    }

    /// <summary>Creates a class group inside a school year.</summary>
    /// <param name="schooljaarId">The school year that contains this class (Art. IX.3). Required.</param>
    /// <param name="naam">The class name (e.g. "L3 — derde leerjaar").</param>
    /// <param name="leerjaar">The leerjaar/leeftijdsgroep ordinal (e.g. 3 for L3); 0 is allowed for kleuter groepen modelled elsewhere.</param>
    public Klas(Guid schooljaarId, string naam, int leerjaar)
    {
        if (schooljaarId == Guid.Empty)
        {
            throw new ArgumentException("'schooljaarId' is required.", nameof(schooljaarId));
        }

        SchooljaarId = schooljaarId;
        Naam = Require(naam, nameof(naam));
        Leerjaar = leerjaar;
    }

    /// <summary>Surrogate identity.</summary>
    public Guid Id { get; private set; } = Guid.NewGuid();

    /// <summary>
    /// The <see cref="Schooljaar"/> that contains this class (Art. IX.3). Immutable after creation: moving a
    /// class between school years would move its jaarplan onto a different vakantiestructuur, which is a copy
    /// operation (E8-03), not a rename.
    /// </summary>
    public Guid SchooljaarId { get; private set; }

    /// <summary>The class name (e.g. "L3 — derde leerjaar").</summary>
    public string Naam { get; private set; }

    /// <summary>The leerjaar / leeftijdsgroep ordinal. Descriptive only — see the type documentation.</summary>
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
