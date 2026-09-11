namespace Jaarplanner.Domain.Schoolcontent;

/// <summary>
/// An algemene fiche: a recurring activity of one class that belongs to no thema, such as the onthaal or the turnles
/// on Monday (owner, 2026-09-11, from the teachers' feedback: <i>"lesfiches algemene/terugkerende activiteiten los
/// staand van thema/subthema kunnen inplannen en dit ook kunnen linken aan doelen"</i>). Mutable autonomous school
/// content (Art. III).
/// <para>
/// <b>Per klas, like a <see cref="Hoek"/>, and for the same reason.</b> Whether a class starts the day with an
/// onthaal and which hour it has the gym is a fact about that class's week, not about a thema and not about an age:
/// K3 groen may turn on Monday and K3 blauw on Thursday. A fiche therefore states its <see cref="KlasId"/> directly
/// and hangs under nothing else.
/// </para>
/// <para>
/// <b>Unlike a hoek it carries doelkoppelingen, and they count for dekking</b> (owner ruling, 2026-09-11, Art. V.1
/// as amended that day). A turnles covers bewegingsopvoeding goals that no thema in the plan will ever carry; without
/// this those goals would stand in the gap-analyse as missing for the whole year while the class works on them every
/// week. A link counts once the fiche is <b>ingepland</b>, i.e. has at least one
/// <c>AlgemeneFicheplaatsing</c> in its class's agenda; the rule itself lives in the dekking computation.
/// </para>
/// <para>
/// <b>Every link is <see cref="KoppelingStatus.Manueel"/>, and the type makes that the only possibility.</b>
/// <see cref="KoppelAanDoel"/> takes no status: nothing proposes goals for a fiche, so a <c>Voorgesteld</c> row here
/// could only be a bug, and one that would reach the dekking filter's blind side.
/// </para>
/// </summary>
public sealed class AlgemeneFiche
{
    private readonly List<DoelKoppeling> _doelkoppelingen = [];

    // EF Core materialisation only.
    private AlgemeneFiche()
    {
        Naam = null!;
    }

    /// <summary>Creates a fiche for one class.</summary>
    /// <param name="klasId">The class whose week this activity is part of. Required.</param>
    /// <param name="naam">What the teacher calls it ("onthaal", "turnen"). Required.</param>
    /// <param name="omschrijving">Optionally, what happens in it: the fiche's own text.</param>
    public AlgemeneFiche(Guid klasId, string naam, string? omschrijving = null)
    {
        KlasId = klasId == Guid.Empty ? throw new ArgumentException("'klasId' is required.", nameof(klasId)) : klasId;
        Naam = Require(naam, nameof(naam));
        Omschrijving = Optional(omschrijving);
    }

    /// <summary>Surrogate identity.</summary>
    public Guid Id { get; private set; } = Guid.NewGuid();

    /// <summary>The class this fiche belongs to. Required; there is no school-wide fiche.</summary>
    public Guid KlasId { get; private set; }

    /// <summary>What the teacher calls it. Required, unique within the class.</summary>
    public string Naam { get; private set; }

    /// <summary>What happens in it, optionally.</summary>
    public string? Omschrijving { get; private set; }

    /// <summary>The leerplandoelen this activity works on, all <see cref="KoppelingStatus.Manueel"/>.</summary>
    public IReadOnlyList<DoelKoppeling> Doelkoppelingen => _doelkoppelingen;

    /// <summary>Renames or re-describes the fiche.</summary>
    public void Wijzig(string naam, string? omschrijving)
    {
        Naam = Require(naam, nameof(naam));
        Omschrijving = Optional(omschrijving);
    }

    /// <summary>
    /// Links this fiche to a leerplandoel, as the teacher's own decision.
    /// <para>
    /// That <paramref name="leerplandoelCode"/> is a code the curriculum actually carries is the service's check
    /// (Art. III.5): the domain cannot see the curriculum table.
    /// </para>
    /// </summary>
    /// <exception cref="ArgumentException">
    /// The fiche already carries that goal. Dutch, because the teacher who picked it twice is the one who reads it.
    /// </exception>
    public DoelKoppeling KoppelAanDoel(string leerplandoelCode)
    {
        var koppeling = new DoelKoppeling(leerplandoelCode, KoppelingStatus.Manueel);

        if (_doelkoppelingen.Any(k => string.Equals(k.LeerplandoelCode, koppeling.LeerplandoelCode, StringComparison.Ordinal)))
        {
            throw new ArgumentException($"Deze fiche is al gekoppeld aan leerdoel '{koppeling.LeerplandoelCode}'.");
        }

        _doelkoppelingen.Add(koppeling);
        return koppeling;
    }

    /// <summary>Removes one goal link. <c>false</c> when the fiche holds none with that id.</summary>
    public bool Ontkoppel(Guid koppelingId) => _doelkoppelingen.RemoveAll(k => k.Id == koppelingId) > 0;

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
