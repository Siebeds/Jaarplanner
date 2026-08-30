using Jaarplanner.Domain.Planning;

namespace Jaarplanner.Domain.Schoolcontent;

/// <summary>
/// A subthema (Art. IX.2 as amended 2026-08-30) — <b>age-scoped: per <see cref="Leeftijd"/> alone</b>.
/// It belongs to a school-wide <see cref="Thema"/> but differs per leeftijd, so its <see cref="Leeftijd"/>
/// is <b>required</b>: a subthema cannot exist without an age. It carries zero or more driving questions
/// (<see cref="Onderzoeksvragen"/>, each with its own <c>Vraag</c> and optional <c>Probleemstelling</c>)
/// and a <see cref="DuurWeken"/> (≈ 2 wk, the subthemaperiode). Mutable autonomous school content (Art. III).
/// <para>
/// <b>The klas is gone from this scope, and that is the point</b> (owner ruling, 2026-08-30; ADR-0025).
/// A subthema used to require a <c>KlasId</c> as well, which meant two K3 classes each needed their own copy
/// of the same content, and a teacher who built "de speelhoek" under K3 groen found it unreachable from K3
/// blauw. What a school actually authors once is the content for an age. So a subthema on <c>K3</c> now holds
/// for <b>every</b> class that teaches K3, and its <see cref="Subdoelen"/> and <see cref="Activiteiten"/> come
/// with it.
/// </para>
/// <para>
/// <b>What stays per klas is the planning, not the content.</b> A <c>Jaarplan</c> belongs to one klas, and so
/// do its themaplaatsingen and activiteitplaatsingen: two K3 classes share this subthema and still put its
/// activiteiten on different days in a different order. The klas remains what a teacher plans <i>in</i>; it is
/// no longer what content belongs <i>to</i>.
/// </para>
/// <para>
/// A subdoel still pins its own <c>leeftijd</c>. It is now normally the same value as this one, and the field is
/// kept rather than collapsed because it is the subdoel's own record of what it differentiates for; nothing in
/// this change makes a subdoel mean something else.
/// </para>
/// </summary>
public sealed class Subthema
{
    private readonly List<Subdoel> _subdoelen = [];
    private readonly List<Activiteit> _activiteiten = [];
    private readonly List<Onderzoeksvraag> _onderzoeksvragen = [];

    // EF Core materialisation only.
    private Subthema()
    {
        Naam = null!;
        Leeftijd = null!;
    }

    internal Subthema(Guid themaId, string naam, int duurWeken, string leeftijd)
    {
        ThemaId = themaId;
        Naam = Require(naam, nameof(naam));
        DuurWeken = RequirePositive(duurWeken, nameof(duurWeken));
        Leeftijd = Require(leeftijd, nameof(leeftijd));
    }

    /// <summary>Surrogate identity.</summary>
    public Guid Id { get; private set; } = Guid.NewGuid();

    /// <summary>The owning (school-scoped) thema.</summary>
    public Guid ThemaId { get; private set; }

    /// <summary>The subthema name.</summary>
    public string Naam { get; private set; }

    /// <summary>The driving questions of this kennisrijk subthema (zero or more; Art. IX.2).</summary>
    public IReadOnlyList<Onderzoeksvraag> Onderzoeksvragen => _onderzoeksvragen;

    /// <summary>The subthemaperiode duration in weeks (≈ 2).</summary>
    public int DuurWeken { get; private set; }

    /// <summary>
    /// The age this subthema is scoped to — <b>required</b>, and now the whole of its scope (Art. IX.2).
    /// <para>
    /// It holds an Op.stap jaar/fase code (<c>Jaarfasen.Alle</c>: JK, K2, K3, L1-L6), which is the same
    /// vocabulary a <c>Klas</c> records in its own <c>Jaarfase</c>. That the two agree is what makes "this
    /// subthema is this class's" answerable at all now that the FK is gone.
    /// </para>
    /// </summary>
    public string Leeftijd { get; private set; }

    /// <summary>The age-differentiated subdoelen at the (subthema × leeftijd) level (Art. IX.2).</summary>
    public IReadOnlyList<Subdoel> Subdoelen => _subdoelen;

    /// <summary>The activiteiten that realise this subthema (Art. IX.2).</summary>
    public IReadOnlyList<Activiteit> Activiteiten => _activiteiten;

    /// <summary>
    /// Adds a driving question to this subthema. Only adds when <paramref name="vraag"/> is non-blank;
    /// returns the new <see cref="Onderzoeksvraag"/>.
    /// </summary>
    public Onderzoeksvraag VoegOnderzoeksvraagToe(string vraag, string? probleemstelling = null)
    {
        var ov = new Onderzoeksvraag(Id, vraag, probleemstelling);
        _onderzoeksvragen.Add(ov);
        return ov;
    }

    /// <summary>
    /// Removes a driving question from this subthema (CRUD, E1-10). Used when a teacher deletes an
    /// onderzoeksvraag; the removal is a deliberate human decision, so the caller persists it (Art. IV.2).
    /// </summary>
    public void VerwijderOnderzoeksvraag(Onderzoeksvraag ov)
    {
        ArgumentNullException.ThrowIfNull(ov);
        _onderzoeksvragen.Remove(ov);
    }

    /// <summary>
    /// Updates the subthema's basic attributes (mutable autonomous content, Art. III). Used by the
    /// school-content import overwrite path (E1-08); the identity fields (naam, leeftijd) are
    /// the match key and are not changed here.
    /// </summary>
    public void WerkBasisGegevensBij(int duurWeken) =>
        DuurWeken = RequirePositive(duurWeken, nameof(duurWeken));

    /// <summary>
    /// Renames the subthema (CRUD, E1-10). The age scope (<see cref="Leeftijd"/>) is part of its identity
    /// and is changed only via <see cref="WijzigScope"/>.
    /// </summary>
    public void WijzigNaam(string naam) => Naam = Require(naam, nameof(naam));

    /// <summary>
    /// Re-scopes the subthema to a different age (CRUD, E1-10). Age scoping stays structural: a subthema can
    /// never become ageless, so a non-blank <paramref name="leeftijd"/> remains required (Art. IX.2).
    /// <para>
    /// <b>Moving a subthema to another age moves it between classes</b>, because a class reaches it through the
    /// age it teaches. That is a bigger act than it was when the klas was named explicitly, and it is the
    /// caller's to present as one.
    /// </para>
    /// </summary>
    public void WijzigScope(string leeftijd) => Leeftijd = Require(leeftijd, nameof(leeftijd));

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
    /// <b>THIS VERB NO LONGER HAS A SCOPE INVARIANT TO ENFORCE, and that is a real loss of a guard rather than a
    /// simplification</b> (Art. IX.2 as amended 2026-08-30). It used to refuse a destination in another klas,
    /// because a subthema named its klas and handing one class's content to another was the thing that could go
    /// wrong. A subthema now names only an age, an activiteit inherits that age, and nothing an aggregate can see
    /// distinguishes a legitimate destination from an illegitimate one: moving an L3 activiteit into a K3
    /// subthema is a teacher making a strange choice, not a breach of anyone's boundary.
    /// </para>
    /// <para>
    /// <b>What kept the offer sensible has therefore become the service's job alone.</b>
    /// <c>HaalSubthemaBestemmingenAsync</c> offers only subthema's at an age the asking klas teaches, and it is
    /// now the ONLY thing doing so — an API caller that posts an arbitrary subthemaId is no longer refused here.
    /// Recorded rather than quietly dropped, because a reader comparing this against the old version should see
    /// that a check was removed on purpose and where the remaining one lives.
    /// </para>
    /// <para>
    /// A move to another <b>thema</b> and to another <b>leeftijd</b> are both permitted (owner rulings,
    /// 2026-08-05), and the panel says what a leeftijd change means rather than leaving it to an option label
    /// (<c>themabeheer.activiteitVerplaatsLeeftijd</c>). <b>E1-19</b>, filed for the re-scoping route that
    /// carried activiteiten across a class boundary, is closed by this amendment rather than by that story:
    /// there is no class boundary left for it to cross.
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

}
