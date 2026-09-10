using Jaarplanner.Domain.Curriculum;

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
    /// <param name="jaarfase">
    /// The Op.stap jaar/fase this class teaches (JK, K2, K3, L1-L6). <b>Required, and the only thing a caller
    /// states about the class's level</b> — <see cref="Leerjaar"/> is derived from it (owner ruling, 2026-08-30).
    /// </param>
    public Klas(Guid schooljaarId, string naam, string jaarfase)
    {
        if (schooljaarId == Guid.Empty)
        {
            throw new ArgumentException("'schooljaarId' is required.", nameof(schooljaarId));
        }

        SchooljaarId = schooljaarId;
        Naam = Require(naam, nameof(naam));
        Jaarfase = Keur(jaarfase);
        Leerjaar = Jaarfasen.LeerjaarVoor(Jaarfase!);
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

    /// <summary>
    /// The leerjaar / leeftijdsgroep ordinal, <b>derived from <see cref="Jaarfase"/></b> since 2026-08-30: 0 for a
    /// kleutergroep, 1 to 6 for L1 to L6.
    /// <para>
    /// <b>It is no longer stated by anyone and it can no longer disagree with the jaar/fase.</b> It used to be the
    /// input and the code the derivation, which meant a kleutergroep could only say "kleuter" and the two fields
    /// could contradict each other. Kept because the klassenlijst sorts on it and the generation prompt names it,
    /// and because rows written before this field was derived still carry whatever was stored then.
    /// </para>
    /// </summary>
    public int Leerjaar { get; private set; }

    /// <summary>
    /// The Op.stap jaar/fase this class teaches (JK, K2, K3, L1–L6), or <c>null</c> when the school has not stated
    /// one (owner ruling, 2026-08-25: kleuterklassen are split per jaar).
    /// <para>
    /// <b>Why this exists beside <see cref="Leerjaar"/>, which already implies it for L1–L6.</b> It does not imply it
    /// for kleuter: <c>Leerjaar = 0</c> means "een kleutergroep" and cannot say which of the three, so a coverage
    /// figure was measured against JK, K2 AND K3 together. For a third kleuterklas that is 1288 goals where 554 are
    /// its own, on the figure the onderwijsinspectie reads. Recording the year removes the guess rather than making
    /// it; <c>Jaarfasen.VoorKlas</c> is where the two are combined, and the ordinal remains the fallback.
    /// </para>
    /// <para>
    /// <b>Nullable on purpose, and not a second source of truth.</b> Existing classes carry no value and keep the
    /// old behaviour exactly, so nothing regresses on a plan already being taught. Where it IS set it wins, and it
    /// cannot disagree with the ordinal because a value that contradicts a real leerjaar is refused at construction.
    /// </para>
    /// <para>
    /// <b>One code, so still no graadklas answer</b> (Art. XIV). A class spanning several leerjaren needs a set here;
    /// until that decision it records nothing and falls through to the ordinal, which refuses rather than guesses.
    /// </para>
    /// </summary>
    public string? Jaarfase { get; private set; }

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
    public void Wijzig(string naam, string jaarfase)
    {
        Naam = Require(naam, nameof(naam));
        Jaarfase = Keur(jaarfase);
        Leerjaar = Jaarfasen.LeerjaarVoor(Jaarfase!);
    }

    /// <summary>
    /// Accepts a jaar/fase, or refuses it for saying something the leerjaar contradicts.
    /// <para>
    /// Blank counts as absent, so a form that submits an empty field does not store <c>""</c> and make
    /// <c>Jaarfasen.IsBekend</c> the only thing standing between it and a coverage denominator of zero.
    /// </para>
    /// <para>
    /// A real leerjaar (1–6) already names its own code, so a value that disagrees with it is a mistake rather than a
    /// refinement and is refused: two answers for one class is how a denominator starts depending on which one a
    /// reader happened to pick. A kleutergroep has no code to contradict, which is the whole reason this field exists.
    /// </para>
    /// </summary>
    /// <summary>
    /// Accepts a jaar/fase, or refuses it on the one shared rule (<see cref="Jaarfasen.WatIsErMisMet"/>).
    /// <para>
    /// Blank counts as absent, so a form submitting an empty field does not store <c>""</c> and leave
    /// <c>Jaarfasen.IsBekend</c> as the only thing between it and a coverage denominator of zero.
    /// </para>
    /// <para>
    /// This throws, and <c>KlasBeheerService</c> refuses the same input earlier with a mapped 400. That is the
    /// division of labour this codebase already uses: the aggregate refuses programmer error, the service refuses
    /// teacher input, and neither restates the rule.
    /// </para>
    /// </summary>
    private static string Keur(string jaarfase)
    {
        var mis = Jaarfasen.WatIsErMisMet(jaarfase);
        if (mis is not null)
        {
            throw new ArgumentException(mis, nameof(jaarfase));
        }

        return jaarfase.Trim();
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
