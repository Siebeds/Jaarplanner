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
    /// Moves <paramref name="activiteit"/> out of this subthema and into <paramref name="doelSubthema"/>
    /// (E4-08, FR-7.2). The activiteit keeps its identity, its attributes and every
    /// <c>DoelKoppeling</c> it carries, which is what makes this different in kind from deleting it here and
    /// retyping it there.
    /// <para>
    /// <b>The class boundary is the invariant of this verb, and it is enforced here because this is the only
    /// place both scopes are known</b> (Art. IX.2: a subthema is scoped per klas and leeftijd, an activiteit
    /// inherits that scope). A move to another klas would silently hand one class's content to another, so it
    /// is refused. A move to another <b>thema</b> is allowed (owner ruling, 2026-08-05).
    /// <para>
    /// <b>Deliberately narrow wording: this guards the move verb, not the system.</b>
    /// <c>WijzigScope</c> still accepts a different klas, so re-scoping a subthema carries every activiteit in
    /// it across a class boundary by another route. That is pre-existing E1-10 behaviour which no screen
    /// offers, and whether the ruling is meant to bind it too is an open question for the owner rather than
    /// something this method may decide (antagonist round 1).
    /// </para>
    /// <para>
    /// A move to another <b>leeftijd</b> within the same klas is permitted, which is the graadklas
    /// differentiation Art. IX.2 exists for. <b>Ruled by the owner on 2026-08-05</b>, after an antagonist
    /// QUESTION established that the earlier ruling had only covered the *thema* boundary and that this half
    /// had been inferred: permitted, <b>and the panel must say what it means</b> rather than leave it to the
    /// age printed in an option label (<c>themabeheer.activiteitVerplaatsLeeftijd</c>).
    /// </para>
    /// </para>
    /// </summary>
    public void VerplaatsActiviteitNaar(Activiteit activiteit, Subthema doelSubthema)
    {
        ArgumentNullException.ThrowIfNull(activiteit);
        ArgumentNullException.ThrowIfNull(doelSubthema);

        if (!_activiteiten.Contains(activiteit))
        {
            // Not a teacher's mistake and not reachable through the API, where the source subthema is resolved
            // from the activiteit itself. English and a 500 rather than a Dutch 400: a caller pairing the wrong
            // two objects is an operator diagnostic (Art. II.3), and it must not travel to a teacher's screen.
            throw new InvalidOperationException("Activiteit does not belong to this subthema.");
        }

        // Both refusals below deliberately pass **no paramName**, and that is not a style choice.
        // `ArgumentException(message, paramName)` appends "(Parameter 'doelSubthema')" to `Message`, the service
        // forwards `ex.Message` as the 400's `detail`, and the form renders that detail verbatim. The paramName
        // overload therefore puts an English developer artefact in a Dutch sentence on a teacher's screen, which
        // is the defect E1-14's round 4 found on this very screen. Caught here by an integration test asserting
        // the payload rather than the status code.
        if (doelSubthema.Id == Id)
        {
            throw new ArgumentException("Deze activiteit staat al in dit subthema.");
        }

        if (doelSubthema.KlasId != KlasId)
        {
            // Art. IX.2 makes the class scope structural. The sentence stays free of the article reference and
            // says what the reader can do, which is the rule E1-14 landed for every message on these screens.
            throw new ArgumentException("Een activiteit kan alleen verhuizen naar een subthema van dezelfde klas.");
        }

        _activiteiten.Remove(activiteit);
        doelSubthema._activiteiten.Add(activiteit);
        activiteit.VerhuisNaar(doelSubthema.Id);
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
