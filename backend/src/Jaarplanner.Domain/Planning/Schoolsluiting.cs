namespace Jaarplanner.Domain.Planning;

/// <summary>
/// A period the school is closed within a <see cref="Schooljaar"/> — either a vacation or a single free day
/// (Art. IX.3: the schooljaar "carries the vakantie-/periodestructuur").
/// <para>
/// <b>Why this is not called <c>Schoolvakantie</c>.</b> It was, until the type had to cover Hemelvaart,
/// Pinkstermaandag and pedagogische studiedagen too. A "Schoolvakantie" whose soort is <c>VrijeDag</c> would
/// be a name asserting something false about the domain, so the type is named for what it actually is: a
/// closure. <see cref="Soort"/> says whether it ends a planning period.
/// </para>
/// <para>
/// Only a <see cref="Sluitingssoort.Vakantie"/> cuts the teaching year into stretches — which is the concrete
/// reason the planning grid cannot be months: Belgian vacations fall mid-month and split the year unevenly.
/// A <see cref="Sluitingssoort.VrijeDag"/> is a non-teaching day inside a block and leaves the grid intact.
/// </para>
/// </summary>
public sealed class Schoolsluiting
{
    // EF Core materialisation only.
    private Schoolsluiting()
    {
        Naam = null!;
    }

    /// <summary>Creates a closure. <paramref name="eind"/> is inclusive.</summary>
    /// <param name="naam">The Dutch name (e.g. "Herfstvakantie", "Hemelvaart", "Pedagogische studiedag").</param>
    /// <param name="start">First day of the closure.</param>
    /// <param name="eind">Last day of the closure (inclusive).</param>
    /// <param name="soort">
    /// Whether this closure ends a planning period. Defaults to <see cref="Sluitingssoort.Vakantie"/> — the
    /// conservative choice, since treating a real vacation as a mere free day would let a planningsblok span
    /// it, which Art. IX.3 forbids.
    /// </param>
    public Schoolsluiting(string naam, DateOnly start, DateOnly eind, Sluitingssoort soort = Sluitingssoort.Vakantie)
    {
        if (string.IsNullOrWhiteSpace(naam))
        {
            throw new ArgumentException("'naam' is required.", nameof(naam));
        }

        if (eind < start)
        {
            throw new ArgumentException("Het einde van een sluiting mag niet voor de start liggen.", nameof(eind));
        }

        Naam = naam.Trim();
        Start = start;
        Eind = eind;
        Soort = soort;
    }

    /// <summary>Surrogate identity.</summary>
    public Guid Id { get; private set; } = Guid.NewGuid();

    /// <summary>The closure's Dutch name.</summary>
    public string Naam { get; private set; }

    /// <summary>First day of the closure.</summary>
    public DateOnly Start { get; private set; }

    /// <summary>Last day of the closure (inclusive).</summary>
    public DateOnly Eind { get; private set; }

    /// <summary>Whether this closure ends a planning period (<see cref="Sluitingssoort.Vakantie"/>) or not.</summary>
    public Sluitingssoort Soort { get; private set; }

    /// <summary>True when this closure cuts the teaching year — i.e. it is a vacation, not a single free day.</summary>
    public bool BreektPeriode => Soort == Sluitingssoort.Vakantie;

    /// <summary>True when the closure covers <paramref name="datum"/>.</summary>
    public bool Bevat(DateOnly datum) => datum >= Start && datum <= Eind;
}
