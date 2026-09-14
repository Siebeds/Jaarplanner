namespace Jaarplanner.Application.Toegang;

/// <summary>
/// Directie's beheer of gebruikers and their rights (E6-04, FA FR-12.2, Art. VI.1, ADR-0030 §3 row "Gebruikers,
/// klassen en schooljaren beheren …", which is directie only). It invites a gebruiker by their Microsoft sign-in name
/// (ADR-0031 decision 3), gives and takes themabeheer and the directie right (R4, R16), links leerkrachten to klassen
/// (R15), appoints hoofdleerkrachten per (schooljaar, jaarfase) (R5, I20) and removes a gebruiker (I17).
/// <para>
/// <b>Who may call it is the Api's business</b>: every route over this service carries the <c>Beheer</c> policy. The
/// service itself enforces the one rule that is about the data rather than the caller: <b>the last directie who can
/// sign in cannot be demoted or removed</b> (ADR-0031 decision 7, <see cref="GebruikerbeheerOpties"/>), with the count
/// of the others read under a lock on the directie rows, so two directieleden demoting each other at the same moment
/// cannot both succeed.
/// </para>
/// <para>
/// Staff data only (Art. VI.2): a name, a sign-in name, flags and links. Nothing here reads or writes pupil data.
/// </para>
/// </summary>
public interface IGebruikerBeheerService
{
    /// <summary>Every gebruiker with their rights, klassen and appointments, and which schooljaren have ended.</summary>
    Task<GebruikersOverzicht> HaalOverzichtOpAsync(CancellationToken cancellationToken = default);

    /// <summary>One gebruiker as <see cref="HaalOverzichtOpAsync"/> shows them.</summary>
    /// <exception cref="GebruikerbeheerNietGevondenFout">No such gebruiker.</exception>
    Task<GebruikerBeheerWeergave> HaalGebruikerOpAsync(Guid gebruikerId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Invites a person by their Microsoft sign-in name (UPN), stored normalised (<c>Gebruiker.NormaliseerEmail</c>).
    /// They can log in once their first login binds the invitation.
    /// </summary>
    /// <exception cref="GebruikerbeheerValidatieFout">No single sign-in name, or a name that is too long.</exception>
    /// <exception cref="GebruikerBestaatAlFout">A gebruiker with this sign-in name exists already.</exception>
    Task<GebruikerBeheerWeergave> NodigUitAsync(GebruikerUitnodiging uitnodiging, CancellationToken cancellationToken = default);

    /// <summary>Gives the directie right (R16). Idempotent.</summary>
    Task<GebruikerBeheerWeergave> GeefDirectierechtAsync(Guid gebruikerId, CancellationToken cancellationToken = default);

    /// <summary>Takes the directie right away (R16). Idempotent for someone who does not hold it.</summary>
    /// <exception cref="LaatsteDirectieFout">This is the last gebruiker with the directie right.</exception>
    Task<GebruikerBeheerWeergave> NeemDirectierechtAfAsync(Guid gebruikerId, CancellationToken cancellationToken = default);

    /// <summary>Gives themabeheer (R4). Idempotent.</summary>
    Task<GebruikerBeheerWeergave> GeefThemabeheerAsync(Guid gebruikerId, CancellationToken cancellationToken = default);

    /// <summary>Takes themabeheer away (R4). Idempotent. What they built stays.</summary>
    Task<GebruikerBeheerWeergave> NeemThemabeheerAfAsync(Guid gebruikerId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Removes a gebruiker. Their klastoewijzingen and appointments go with them (cascade); the activiteiten they made
    /// stay, with no maker, and so become purely shared (ADR-0030 I17). A directie may remove themselves while another
    /// directie remains.
    /// </summary>
    /// <exception cref="LaatsteDirectieFout">This is the last gebruiker with the directie right.</exception>
    Task VerwijderAsync(Guid gebruikerId, CancellationToken cancellationToken = default);

    /// <summary>Makes the gebruiker a leerkracht of the klas (R15). Idempotent: a pair exists at most once.</summary>
    Task<GebruikerBeheerWeergave> WijsKlasToeAsync(Guid gebruikerId, Guid klasId, CancellationToken cancellationToken = default);

    /// <summary>Unlinks the gebruiker from the klas. Idempotent.</summary>
    Task<GebruikerBeheerWeergave> HaalKlasWegAsync(Guid gebruikerId, Guid klasId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Appoints the gebruiker hoofdleerkracht of <paramref name="jaarfase"/> in a schooljaar (R5). Several per jaarfase
    /// are allowed, and no klastoewijzing is needed (I20). Idempotent.
    /// </summary>
    /// <exception cref="GebruikerbeheerValidatieFout">The jaarfase is not one of the nine codes.</exception>
    Task<GebruikerBeheerWeergave> StelAanAlsHoofdleerkrachtAsync(
        Guid gebruikerId, Guid schooljaarId, string jaarfase, CancellationToken cancellationToken = default);

    /// <summary>Withdraws that appointment. Idempotent.</summary>
    /// <exception cref="GebruikerbeheerValidatieFout">The jaarfase is not one of the nine codes.</exception>
    Task<GebruikerBeheerWeergave> TrekAanstellingInAsync(
        Guid gebruikerId, Guid schooljaarId, string jaarfase, CancellationToken cancellationToken = default);
}

/// <summary>
/// <c>GET /api/gebruikers</c>: every gebruiker, and the schooljaren that have ended on the school's clock.
/// </summary>
/// <param name="Gebruikers">Ordered by name.</param>
/// <param name="VoorbijeSchooljaarIds">
/// Every schooljaar whose last school day has passed (ADR-0030 R20, the same <c>Rechtenberekening.TeltNog</c> the
/// rights use). A klastoewijzing or appointment in such a year no longer counts for the shared content. Sent for every
/// schooljaar, not only those with an appointment, so a screen can say it about a year before anything is ticked in it.
/// </param>
public sealed record GebruikersOverzicht(
    IReadOnlyList<GebruikerBeheerWeergave> Gebruikers,
    IReadOnlyList<Guid> VoorbijeSchooljaarIds);

/// <summary>One gebruiker, with what directie needs to see to maintain their rights.</summary>
/// <param name="Id">The gebruiker.</param>
/// <param name="Naam">The name shown in the app.</param>
/// <param name="Email">The Microsoft sign-in name (UPN) they were invited under, normalised.</param>
/// <param name="IsDirectie">Holds the directie right.</param>
/// <param name="HeeftThemabeheer">Holds themabeheer.</param>
/// <param name="IsAangemeld">
/// Whether a first login has bound the invitation to a Microsoft account. <c>false</c> is the state in which ADR-0031
/// decision 3's residual risk lives: a sign-in name reassigned before the first login binds to whoever holds it then.
/// </param>
/// <param name="Klastoewijzingen">The klassen they teach (R15), in every schooljaar.</param>
/// <param name="Hoofdleerkrachtaanstellingen">Their hoofdleerkracht appointments (R5), in every schooljaar.</param>
public sealed record GebruikerBeheerWeergave(
    Guid Id,
    string Naam,
    string Email,
    bool IsDirectie,
    bool HeeftThemabeheer,
    bool IsAangemeld,
    IReadOnlyList<KlastoewijzingBeheerWeergave> Klastoewijzingen,
    IReadOnlyList<AanstellingBeheerWeergave> Hoofdleerkrachtaanstellingen);

/// <summary>A klas the gebruiker teaches.</summary>
/// <param name="KlasId">The klas.</param>
/// <param name="KlasNaam">Its name.</param>
/// <param name="Jaarfase">The klas's stated jaarfase, or <c>null</c> on a legacy row that states none.</param>
/// <param name="SchooljaarId">The klas's schooljaar.</param>
/// <param name="TeltVoorGedeeldeInhoud">
/// Whether this klastoewijzing gives a leeftijd right on the shared content today: exactly what the rights service
/// grants as "LK leeftijd". It needs both a schooljaar that has not ended (R20) and a stated jaarfase (R22, I12).
/// The klas's own planning stays with its leerkrachten either way (I21).
/// </param>
public sealed record KlastoewijzingBeheerWeergave(
    Guid KlasId,
    string KlasNaam,
    string? Jaarfase,
    Guid SchooljaarId,
    bool TeltVoorGedeeldeInhoud);

/// <summary>A hoofdleerkracht appointment.</summary>
/// <param name="SchooljaarId">The schooljaar it is for.</param>
/// <param name="Jaarfase">The jaarfase it is for.</param>
/// <param name="TeltVoorGedeeldeInhoud">Whether its schooljaar has not ended yet (R20), so it gives the right today.</param>
public sealed record AanstellingBeheerWeergave(Guid SchooljaarId, string Jaarfase, bool TeltVoorGedeeldeInhoud);

/// <summary>
/// How the last-directie guard (ADR-0031 decision 7) decides who else can still administer the school.
/// <para>
/// <b>The guard counts only another directie who can sign in.</b> Under Entra that is an invitation a first login has
/// bound: an unbound one may never be used (a mistyped sign-in name, someone who never comes), and a school whose only
/// other directie is such an invitation could lose its last working account. So <see cref="OngekoppeldeDirectieKanAanmelden"/>
/// is <c>false</c> by default, and that default is the production rule.
/// </para>
/// <para>
/// <b>The one exception is the development sign-in</b> (<c>Authenticatie:Modus = Ontwikkeling</c>, which the Api refuses
/// to start with outside Development). It signs a developer in by picking any gebruiker and binds nobody, so there every
/// directie can sign in and none is ever bound; counting only bound ones would make every directie undemotable. The Api
/// sets this flag from the mode, and nothing else sets it.
/// </para>
/// </summary>
public sealed class GebruikerbeheerOpties
{
    /// <summary>Whether an unbound directie invitation counts as a directie who can sign in. Development sign-in only.</summary>
    public bool OngekoppeldeDirectieKanAanmelden { get; set; }
}

/// <summary><c>POST /api/gebruikers</c>: who to invite.</summary>
/// <param name="Email">Their Microsoft sign-in name (UPN). Often not their mailbox address (ADR-0031 decision 3).</param>
/// <param name="Naam">The name to show until their first login supplies one; blank falls back to the sign-in name.</param>
/// <param name="IsDirectie">Give the directie right straight away.</param>
/// <param name="HeeftThemabeheer">Give themabeheer straight away.</param>
public sealed record GebruikerUitnodiging(
    string? Email,
    string? Naam,
    bool IsDirectie = false,
    bool HeeftThemabeheer = false);

/// <summary>The gebruiker, klas or schooljaar a beheer request names does not exist (404).</summary>
public sealed class GebruikerbeheerNietGevondenFout : Exception
{
    public GebruikerbeheerNietGevondenFout(string message)
        : base(message)
    {
    }
}

/// <summary>The request itself is wrong (400). The message is Dutch, for directie (Art. II.3).</summary>
public sealed class GebruikerbeheerValidatieFout : Exception
{
    public GebruikerbeheerValidatieFout(string message)
        : base(message)
    {
    }
}

/// <summary>
/// The request is well-formed but the current state refuses it (409). The message is Dutch, for directie, who can act
/// on it (Art. II.3 as amended 2026-07-30). Nothing was changed.
/// </summary>
public abstract class GebruikerbeheerConflictFout : Exception
{
    protected GebruikerbeheerConflictFout(string message)
        : base(message)
    {
    }
}

/// <summary>A gebruiker with this sign-in name exists already.</summary>
public sealed class GebruikerBestaatAlFout : GebruikerbeheerConflictFout
{
    public GebruikerBestaatAlFout(string message)
        : base(message)
    {
    }
}

/// <summary>The change would leave the school without anyone holding the directie right (ADR-0031 decision 7).</summary>
public sealed class LaatsteDirectieFout : GebruikerbeheerConflictFout
{
    public LaatsteDirectieFout(string message)
        : base(message)
    {
    }
}
