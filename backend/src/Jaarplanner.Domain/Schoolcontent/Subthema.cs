using Jaarplanner.Domain.Planning;

namespace Jaarplanner.Domain.Schoolcontent;

/// <summary>
/// A subthema (Art. IX.2) — <b>class/age-scoped: per <see cref="KlasId"/> &amp; <see cref="Leeftijd"/></b>.
/// It belongs to a school-wide <see cref="Thema"/> but may differ per klas/leeftijd, so its
/// <see cref="KlasId"/> (FK to <see cref="Klas"/>) and <see cref="Leeftijd"/> are <b>required</b>:
/// a subthema cannot exist school-wide. It carries the driving question(s) of a kennisrijk thema
/// (<see cref="Probleemstelling"/> / <see cref="Onderzoeksvraag"/>) and a <see cref="DuurWeken"/>
/// (≈ 2 wk, the subthemaperiode). Mutable autonomous school content (Art. III).
/// <para>
/// The class/age scope flows down: <see cref="Subdoelen"/> and <see cref="Activiteiten"/> belong to
/// this subthema and therefore inherit its <see cref="KlasId"/>, while a subdoel additionally pins
/// its own <c>leeftijd</c> for the per-<c>(subthema × leeftijd)</c> differentiation (Art. IX.2).
/// </para>
/// </summary>
public sealed class Subthema
{
    private readonly List<Subdoel> _subdoelen = [];
    private readonly List<Activiteit> _activiteiten = [];

    // EF Core materialisation only.
    private Subthema()
    {
        Naam = null!;
        Leeftijd = null!;
    }

    internal Subthema(Guid themaId, string naam, int duurWeken, Guid klasId, string leeftijd)
    {
        ThemaId = themaId;
        Naam = Require(naam, nameof(naam));
        DuurWeken = RequirePositive(duurWeken, nameof(duurWeken));
        KlasId = RequireKlas(klasId);
        Leeftijd = Require(leeftijd, nameof(leeftijd));
    }

    /// <summary>Surrogate identity.</summary>
    public Guid Id { get; private set; } = Guid.NewGuid();

    /// <summary>The owning (school-scoped) thema.</summary>
    public Guid ThemaId { get; private set; }

    /// <summary>The subthema name.</summary>
    public string Naam { get; private set; }

    /// <summary>The driving problem statement of a kennisrijk thema; optional.</summary>
    public string? Probleemstelling { get; private set; }

    /// <summary>The driving research question of a kennisrijk thema; optional.</summary>
    public string? Onderzoeksvraag { get; private set; }

    /// <summary>The subthemaperiode duration in weeks (≈ 2).</summary>
    public int DuurWeken { get; private set; }

    /// <summary>The owning class — <b>required</b> (class scoping is structural; Art. IX.2).</summary>
    public Guid KlasId { get; private set; }

    /// <summary>The age this subthema is scoped to — <b>required</b> (age scoping is structural; Art. IX.2).</summary>
    public string Leeftijd { get; private set; }

    /// <summary>The age-differentiated subdoelen at the (subthema × leeftijd) level (Art. IX.2).</summary>
    public IReadOnlyList<Subdoel> Subdoelen => _subdoelen;

    /// <summary>The activiteiten that realise this subthema (Art. IX.2).</summary>
    public IReadOnlyList<Activiteit> Activiteiten => _activiteiten;

    /// <summary>Sets the kennisrijk-thema driving question(s).</summary>
    public void StelVraagstellingIn(string? probleemstelling, string? onderzoeksvraag)
    {
        Probleemstelling = Optional(probleemstelling);
        Onderzoeksvraag = Optional(onderzoeksvraag);
    }

    /// <summary>
    /// Updates the subthema's basic attributes (mutable autonomous content, Art. III). Used by the
    /// school-content import overwrite path (E1-08); the identity fields (naam, klas, leeftijd) are
    /// the match key and are not changed here.
    /// </summary>
    public void WerkBasisGegevensBij(int duurWeken) =>
        DuurWeken = RequirePositive(duurWeken, nameof(duurWeken));

    /// <summary>
    /// Renames the subthema (CRUD, E1-10). The class/age scope (<see cref="KlasId"/>/<see cref="Leeftijd"/>)
    /// is part of its identity and is changed only via <see cref="WijzigScope"/>.
    /// </summary>
    public void WijzigNaam(string naam) => Naam = Require(naam, nameof(naam));

    /// <summary>
    /// Re-scopes the subthema to a different class/age (CRUD, E1-10). Class scoping stays structural:
    /// a subthema can never become school-wide — both a non-empty <paramref name="klasId"/> and a
    /// non-blank <paramref name="leeftijd"/> remain required (Art. IX.2).
    /// </summary>
    public void WijzigScope(Guid klasId, string leeftijd)
    {
        KlasId = RequireKlas(klasId);
        Leeftijd = Require(leeftijd, nameof(leeftijd));
    }

    /// <summary>
    /// Removes an activiteit (and, via the EF cascade, its goal links) from this subthema. CRUD delete
    /// of a class/age-scoped activiteit (E1-10).
    /// </summary>
    public void VerwijderActiviteit(Activiteit activiteit)
    {
        ArgumentNullException.ThrowIfNull(activiteit);
        _activiteiten.Remove(activiteit);
    }

    /// <summary>
    /// Removes a subdoel from this subthema. Used by the import overwrite reconciliation (E1-08) to drop
    /// an AI-only <c>voorgesteld</c> link the file no longer carries, or — only on explicit teacher
    /// confirmation — a discarded human decision (Art. IV.2).
    /// </summary>
    public void VerwijderSubdoel(Subdoel subdoel)
    {
        ArgumentNullException.ThrowIfNull(subdoel);
        _subdoelen.Remove(subdoel);
    }

    /// <summary>
    /// Adds an age-differentiated subdoel. The <paramref name="leeftijd"/> records the
    /// per-<c>(subthema × leeftijd)</c> differentiation (Art. IX.2).
    /// </summary>
    public Subdoel VoegSubdoelToe(string leeftijd, DoelKoppeling koppeling)
    {
        var subdoel = new Subdoel(Id, leeftijd, koppeling);
        _subdoelen.Add(subdoel);
        return subdoel;
    }

    /// <summary>Adds an activiteit to this (class/age-scoped) subthema.</summary>
    public Activiteit VoegActiviteitToe(
        string naam,
        ActiviteitType activiteitType,
        string? hoek = null,
        string? verwachteUitkomsten = null)
    {
        var activiteit = new Activiteit(Id, naam, activiteitType, hoek, verwachteUitkomsten);
        _activiteiten.Add(activiteit);
        return activiteit;
    }

    private static Guid RequireKlas(Guid klasId) =>
        klasId != Guid.Empty
            ? klasId
            : throw new ArgumentException("Een subthema is klas-gebonden; klasId is verplicht (Art. IX.2).", nameof(klasId));

    private static string Require(string value, string paramName)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new ArgumentException($"'{paramName}' is required.", paramName);
        }

        return value.Trim();
    }

    private static int RequirePositive(int value, string paramName) =>
        value > 0 ? value : throw new ArgumentOutOfRangeException(paramName, value, "Duur in weken moet positief zijn.");

    private static string? Optional(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
