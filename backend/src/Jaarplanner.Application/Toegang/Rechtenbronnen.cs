using Jaarplanner.Domain.Curriculum;

namespace Jaarplanner.Application.Toegang;

/// <summary>
/// The rights a gebruiker holds today (E6-02, Art. VI.1). One read per gebruiker per request: the Api's authorisation
/// handler and <c>GET /api/ik</c> both ask here, and nothing caches the answer beyond the request.
/// </summary>
public interface IRechtenService
{
    /// <summary>The rights of <paramref name="gebruikerId"/> today. A gebruiker who does not exist holds none.</summary>
    Task<Rechten> HaalRechtenOpAsync(Guid gebruikerId, CancellationToken cancellationToken = default);
}

/// <summary>
/// Builds the resource a resource-based matrix row is checked against, from the id in a route (E6-02). So a controller
/// does not assemble a leeftijd, a maker and a goal-link flag by hand, and every route asks the same question the same
/// way. <c>null</c> means there is no such subthema or activiteit: the controller answers that as it answers any
/// missing resource, before any rights question is asked.
/// </summary>
public interface IRechtenbronnen
{
    /// <summary>The leeftijd of a subthema: for the subthema, subdoel, streefwoordenschat and new-activiteit rows.</summary>
    Task<Leeftijdsinhoud?> VoorSubthemaAsync(Guid subthemaId, CancellationToken cancellationToken = default);

    /// <summary>An activiteit with its leeftijd, maker and whether any goal is linked to it: for the activiteit rows.</summary>
    Task<Activiteitbron?> VoorActiviteitAsync(Guid activiteitId, CancellationToken cancellationToken = default);

    /// <summary>The leeftijd of a proposed subdoel (FB-057, ADR-0050): for deciding it.</summary>
    Task<Leeftijdsinhoud?> VoorSubdoelvoorstelAsync(Guid subdoelvoorstelId, CancellationToken cancellationToken = default);

    /// <summary>The leeftijd of a proposed new subthema (FB-057, ADR-0050): for deciding it.</summary>
    Task<Leeftijdsinhoud?> VoorSubthemavoorstelAsync(Guid subthemavoorstelId, CancellationToken cancellationToken = default);

    /// <summary>A thema, with whether it holds content beyond its own open wizard run's items: for deleting it (I26).</summary>
    Task<Themabron?> VoorThemaAsync(Guid themaId, CancellationToken cancellationToken = default);

    // --- The planning of one klas (E6-02 slice 3): every route whose resource belongs to a klas answers with it. ---

    /// <summary>The planning of a klas named in the route.</summary>
    Task<Klasplanning?> VoorKlasAsync(Guid klasId, CancellationToken cancellationToken = default);

    /// <summary>The planning of the klas a hoek belongs to.</summary>
    Task<Klasplanning?> VoorHoekAsync(Guid hoekId, CancellationToken cancellationToken = default);

    /// <summary>The planning of the klas a hoekplaatsing is in.</summary>
    Task<Klasplanning?> VoorHoekplaatsingAsync(Guid plaatsingId, CancellationToken cancellationToken = default);

    /// <summary>The planning of the klas an algemene fiche belongs to.</summary>
    Task<Klasplanning?> VoorAlgemeneFicheAsync(Guid ficheId, CancellationToken cancellationToken = default);

    /// <summary>The planning of the klas an algemene ficheplaatsing is in.</summary>
    Task<Klasplanning?> VoorAlgemeneFicheplaatsingAsync(Guid plaatsingId, CancellationToken cancellationToken = default);

    /// <summary>
    /// A klas named in the route, as reading its planning needs it: with the leeftijden it stands for (FB-013).
    /// <c>null</c> when the klas does not exist.
    /// </summary>
    Task<Klasinzage?> VoorKlasinzageAsync(Guid klasId, CancellationToken cancellationToken = default);

    // --- The ontwikkelingsrapport of one klas (FB-001): its leerlingen, and from FB-003 on its reports. ---

    /// <summary>The ontwikkelingsrapport of a klas named in the route. <c>null</c> when the klas does not exist.</summary>
    Task<Rapportklas?> VoorRapportklasAsync(Guid klasId, CancellationToken cancellationToken = default);

    /// <summary>The ontwikkelingsrapport of the klas a leerling is in. <c>null</c> when the leerling does not exist.</summary>
    Task<Rapportklas?> VoorLeerlingAsync(Guid leerlingId, CancellationToken cancellationToken = default);

    // --- Personal content (FB-036): a woordweb. ---

    /// <summary>A woordweb with its owner. <c>null</c> when the woordweb does not exist.</summary>
    Task<Woordwebbron?> VoorWoordwebAsync(Guid woordwebId, CancellationToken cancellationToken = default);
}

/// <summary>
/// One gebruiker's woordweb (FB-036, ADR-0043): the resource of the <c>WoordwebBewerken</c> row, whose one column is its
/// owner. A type of its own, so no other row's column can match it and it can match no other row.
/// </summary>
/// <param name="WoordwebId">The woordweb.</param>
/// <param name="EigenaarId">Whose web it is.</param>
public sealed record Woordwebbron(Guid WoordwebId, Guid EigenaarId);

/// <summary>
/// Shared content of one leeftijd (a subthema, its subdoelen, its streefwoordenschat, a new activiteit under it): the
/// resource for the rows whose columns are HL and "LK leeftijd" (ADR-0030 §3).
/// <para>
/// <b>Two ways in, one per source.</b> A leeftijd already stored (a subthema's) is canonical, and
/// <see cref="IRechtenbronnen"/> builds the record from it with the constructor. A leeftijd from anywhere else, such as a
/// request body (the subthema create, the new leeftijd of an I13 re-scope), goes through <see cref="UitInvoer"/>.
/// Otherwise <c>" K3"</c> would pass the service's validation (which trims) and then fail the ordinal rights
/// comparison, so a K3 hoofdleerkracht would be refused on their own leeftijd.
/// </para>
/// </summary>
/// <param name="Leeftijd">One of the nine jaar/fase codes, exactly as stored.</param>
public sealed record Leeftijdsinhoud(string Leeftijd)
{
    /// <summary>
    /// The resource for a leeftijd that did not come from the database. It goes through
    /// <see cref="Jaarfasen.LeesLeeftijd"/>, the same function the subthema create and re-scope validate with
    /// (<c>SchoolcontentBeheerService.VereisLeeftijd</c>). So it accepts exactly what those writes accept, in the
    /// trimmed form they store. <c>SubthemaLeeftijdInvoerTests</c> runs both over a set of inputs, as a tripwire
    /// against the function being un-shared.
    /// </summary>
    /// <returns>
    /// <c>null</c> when the input is no leeftijd at all. The caller may then let the write refuse it, with the write's
    /// own 400 and sentence, or refuse it the same way. <b>Deferring to the write is safe only because the write refuses
    /// exactly these inputs:</b> it validates with the same function, <see cref="Jaarfasen.LeesLeeftijd"/>, which
    /// <c>SubthemaLeeftijdInvoerTests</c> pins. If the two ever differed, a null here could send an input the write
    /// accepts past the rights check.
    /// </returns>
    public static Leeftijdsinhoud? UitInvoer(string? leeftijd) =>
        Jaarfasen.LeesLeeftijd(leeftijd) is { } code ? new Leeftijdsinhoud(code) : null;
}

/// <summary>The planning of one klas (jaarplan, (her)generatie, agenda, hoeken, algemene fiches): the "LK eigen" resource.</summary>
public sealed record Klasplanning(Guid KlasId);

/// <summary>
/// One klas as <b>reading</b> its planning needs it (FB-013, ADR-0040): the jaarplan, the agenda, the dekking and their
/// export. The row <c>KlasplanningBekijken</c> asks it: a leerkracht or hoofdleerkracht reads a klas whose leeftijden
/// include one of their own, and a klastoewijzing reads its own klas.
/// <para>
/// <b>A type of its own rather than a <see cref="Klasplanning"/></b>, because it carries the klas's leeftijden and a
/// planning resource does not: a write row can never be passed by a reading resource's leeftijd, nor a read by a write's.
/// </para>
/// <para>
/// <b>Built only through <see cref="Voor"/></b>, which takes the klas's <b>stated</b> jaarfase and maps it with
/// <see cref="Domain.Toegang.Leeftijdsrechten.VoorKlas"/>, the one klas→leeftijden mapping of Art. VI.1. So a graadklas
/// decision (Art. XIV) moves this rule with the leeftijd rights, and a klas without a stated jaarfase stands for no
/// leeftijd: only its own leerkrachten, themabeheer and directie read it (fail closed, as ADR-0030 I12).
/// </para>
/// </summary>
public sealed record Klasinzage
{
    private Klasinzage(Guid klasId, IReadOnlyList<string> leeftijden)
    {
        KlasId = klasId;
        Leeftijden = leeftijden;
    }

    /// <summary>The klas.</summary>
    public Guid KlasId { get; }

    /// <summary>The leeftijden this klas stands for, through the one klas→leeftijden mapping. Empty grants no leeftijd.</summary>
    public IReadOnlyList<string> Leeftijden { get; }

    /// <param name="klasId">The klas.</param>
    /// <param name="gesteldeJaarfase">The klas's <c>Jaarfase</c> exactly as stored. Never derive it from the leerjaar.</param>
    public static Klasinzage Voor(Guid klasId, string? gesteldeJaarfase) =>
        new(klasId, Domain.Toegang.Leeftijdsrechten.VoorKlas(gesteldeJaarfase));
}

/// <summary>
/// The ontwikkelingsrapport of one klas: its leerlingen and their reports, the resource of the ontwikkelingsrapport rows
/// (FB-001, ADR-0030 footnote ⁶, ADR-0035 §3.3). <b>A type of its own rather than a <see cref="Klasplanning"/></b>,
/// because "LK eigen" means something narrower here: only a klas that grants K3, and filling in only during its
/// schooljaar (R26). A planning resource can therefore never pass a report row, nor a report resource a planning row.
/// <para>
/// It is built for any klas that exists, K3 or not. Whether that klas can have leerlingen at all (D9) is the matrix's
/// question for a leerkracht and the service's for directie and Leerlingzorg (FB-008), who pass the read row on any klas.
/// </para>
/// </summary>
/// <param name="KlasId">The klas.</param>
public sealed record Rapportklas(Guid KlasId);

/// <summary>
/// An existing activiteit, as the delete and move rows need it (ADR-0030 §3, R25, R33, I19). It also serves every
/// HL or "LK leeftijd" row about that activiteit, through its <paramref name="Leeftijd"/>.
/// </summary>
/// <param name="ActiviteitId">The activiteit.</param>
/// <param name="Leeftijd">The leeftijd of its subthema.</param>
/// <param name="MakerId">Who created it, or <c>null</c> (imported, older than the rule, or its maker was removed).</param>
/// <param name="HeeftDoelkoppelingen">
/// Whether a decided goal is linked to it: an <c>aanvaard</c> or <c>manueel</c> link. A <c>voorgesteld</c> or
/// <c>geweigerd</c> link does not count for R25's "while no goal is linked to it" (owner, 2026-09-17, ADR-0053 D5).
/// </param>
/// <param name="EigenaarId">
/// The owner of an own activiteit (ADR-0049), or <c>null</c> for a shared one. On an own activiteit only the owner's
/// column and the columns that read or copy one match (D3 to D5); the shared columns do not.
/// </param>
public sealed record Activiteitbron(
    Guid ActiviteitId,
    string Leeftijd,
    Guid? MakerId,
    bool HeeftDoelkoppelingen,
    Guid? EigenaarId = null);

/// <summary>
/// A thema, as deleting it needs it (E6-02, default I26). The delete takes every subthema, subdoel and activiteit under
/// it along, at every leeftijd, so what decides themabeheer's right is whether any of those is someone else's.
/// </summary>
/// <param name="ThemaId">The thema.</param>
/// <param name="HeeftAndermansInhoud">
/// Whether it holds a subthema, subdoel or activiteit that its own wizard run did not create, or that run has ended (I23:
/// after the run its items are ordinary shared content). <c>false</c> for an empty thema.
/// </param>
/// <param name="GekoppeldeLeeftijden">
/// The leeftijden at which an activiteit the open run created carries a goal link. Under the owner's ruling on Q4
/// (2026-09-14) such an activiteit counts as the run's own only for a caller who may link goals at that leeftijd
/// (<c>DoelenKoppelen</c>), because deleting the thema removes the link (R19). <b>Required, with no default:</b> a
/// producer that forgot it would otherwise allow the delete in silence, so leaving it out is a compile error. Empty
/// when there is none.
/// </param>
public sealed record Themabron(Guid ThemaId, bool HeeftAndermansInhoud, IReadOnlyList<string> GekoppeldeLeeftijden);
