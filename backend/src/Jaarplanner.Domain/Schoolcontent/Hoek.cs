namespace Jaarplanner.Domain.Schoolcontent;

/// <summary>
/// A learning corner of one class: the boekenhoek, the bouwhoek, the zandtafel (owner, meeting 2026-08-30).
/// Mutable autonomous school content (Art. III) — the school decides what corners it keeps, nothing about a
/// hoek is decreed.
/// <para>
/// <b>A hoek hangs off a <see cref="KlasId"/> and off nothing else, and that is the point of it.</b> The rest of
/// the school-content model hangs under a <c>Thema</c>: a <c>Subthema</c> belongs to one, an <c>Activiteit</c>
/// belongs to a subthema. A hoek belongs to none. It is a physical place in a classroom that is there in
/// september and still there in june, across every thema the class works through. Modelling it under a thema
/// would have meant re-creating the boekenhoek for each of the year's eight thema's, and asking which of the
/// eight is the real one.
/// </para>
/// <para>
/// <b>What changes per period is not the hoek but its <see cref="Hoekverrijking"/></b>, which hangs off a
/// <c>Hoekplaatsing</c> rather than off this. That split is the whole model: the hoek recurs, the verrijking is
/// what makes this fortnight's boekenhoek different from last fortnight's.
/// </para>
/// <para>
/// <b>Per klas rather than per leeftijd</b>, unlike <see cref="Subthema"/>, which moved to leeftijd scoping on
/// this same day. The two are scoped by what they are: a subthema is content a school authors once for an age
/// and every class of that age teaches, while a hoek is furniture. K3A genuinely may have a bouwhoek that K3B
/// does not, and a model that shared them would put a corner on a screen for a teacher who has no such corner
/// in her room. The convenience the sharing would have bought is bought instead by copying — see
/// <see cref="KopieerNaar"/> — which leaves each class owning what it says it has.
/// </para>
/// <para>
/// <b>No doelkoppelingen (owner ruling, 2026-08-30).</b> A hoek links to no leerplandoel, so nothing here can
/// move a dekkingscijfer. That is deliberate rather than unfinished: dekking is proven through a link hanging
/// off a placed thema (Art. V.1), and letting a corner grant coverage would grant it a second time for content
/// the thema already proves. When recurring activiteiten that DO carry doelen arrive (the turnles, the onthaal),
/// they are a different feature and will have to argue for their effect on Art. V on their own terms.
/// </para>
/// </summary>
public sealed class Hoek
{
    // EF Core materialisation only.
    private Hoek()
    {
        Naam = null!;
    }

    /// <summary>Creates a hoek for one class.</summary>
    /// <param name="klasId">The class whose room this corner is in. Required.</param>
    /// <param name="naam">What the teacher calls it ("boekenhoek", "ontdektafel"). Required.</param>
    /// <param name="omschrijving">Optional longer description of what the corner permanently holds.</param>
    public Hoek(Guid klasId, string naam, string? omschrijving = null)
    {
        KlasId = RequireId(klasId, nameof(klasId));
        Naam = Require(naam, nameof(naam));
        Omschrijving = Optional(omschrijving);
    }

    /// <summary>Surrogate identity.</summary>
    public Guid Id { get; private set; } = Guid.NewGuid();

    /// <summary>The class this corner belongs to. Required; a hoek cannot exist school-wide.</summary>
    public Guid KlasId { get; private set; }

    /// <summary>What the teacher calls it. Required.</summary>
    public string Naam { get; private set; }

    /// <summary>
    /// What the corner permanently holds, optionally. This is the part that does NOT change per thema; what
    /// does is a <see cref="Hoekverrijking"/> on a placement.
    /// </summary>
    public string? Omschrijving { get; private set; }

    /// <summary>Renames or re-describes the corner (mutable autonomous content, Art. III).</summary>
    public void Wijzig(string naam, string? omschrijving)
    {
        Naam = Require(naam, nameof(naam));
        Omschrijving = Optional(omschrijving);
    }

    /// <summary>
    /// A copy of this hoek for another class, so a teacher setting her room up can take over a colleague's list
    /// instead of retyping it (owner, 2026-08-30).
    /// <para>
    /// <b>It is a copy and not a share, and the difference is the whole reason this returns a new entity.</b> The
    /// copy carries its own <see cref="Id"/> and belongs to <paramref name="klasId"/> from the moment it exists:
    /// renaming it, describing it differently or deleting it touches nothing in the class it came from. Sharing
    /// one row between two classrooms would mean one teacher's rename silently rewrote another teacher's room.
    /// </para>
    /// <para>
    /// It deliberately carries <b>no</b> link back to its origin. There is nothing a later screen could honestly
    /// do with one: two boekenhoeken that started as one copy are two corners in two rooms the moment they
    /// exist, and a "synchronise" affordance built on such a link would be the sharing this method exists to
    /// avoid.
    /// </para>
    /// </summary>
    public Hoek KopieerNaar(Guid klasId) => new(klasId, Naam, Omschrijving);

    private static Guid RequireId(Guid value, string paramName) =>
        value == Guid.Empty ? throw new ArgumentException($"'{paramName}' is required.", paramName) : value;

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
