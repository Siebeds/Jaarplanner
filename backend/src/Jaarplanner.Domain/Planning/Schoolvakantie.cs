namespace Jaarplanner.Domain.Planning;

/// <summary>
/// A vacation or closure period within a <see cref="Schooljaar"/> (Art. IX.3: the schooljaar "carries the
/// vakantie-/periodestructuur"). Planning blocks are derived around these, which is the concrete reason
/// the grid cannot be months: Belgian vacations (herfst, kerst, krokus, paas) fall mid-month and split the
/// teaching year into uneven stretches.
/// </summary>
public sealed class Schoolvakantie
{
    // EF Core materialisation only.
    private Schoolvakantie()
    {
        Naam = null!;
    }

    /// <summary>Creates a vacation period. <paramref name="eind"/> is inclusive.</summary>
    /// <param name="naam">The Dutch name (e.g. "Herfstvakantie", "Kerstvakantie").</param>
    /// <param name="start">First day of the vacation.</param>
    /// <param name="eind">Last day of the vacation (inclusive).</param>
    public Schoolvakantie(string naam, DateOnly start, DateOnly eind)
    {
        if (string.IsNullOrWhiteSpace(naam))
        {
            throw new ArgumentException("'naam' is required.", nameof(naam));
        }

        if (eind < start)
        {
            throw new ArgumentException("Het einde van een vakantie mag niet voor de start liggen.", nameof(eind));
        }

        Naam = naam.Trim();
        Start = start;
        Eind = eind;
    }

    /// <summary>Surrogate identity.</summary>
    public Guid Id { get; private set; } = Guid.NewGuid();

    /// <summary>The vacation's Dutch name.</summary>
    public string Naam { get; private set; }

    /// <summary>First day of the vacation.</summary>
    public DateOnly Start { get; private set; }

    /// <summary>Last day of the vacation (inclusive).</summary>
    public DateOnly Eind { get; private set; }

    /// <summary>True when the vacation covers <paramref name="datum"/>.</summary>
    public bool Bevat(DateOnly datum) => datum >= Start && datum <= Eind;
}
