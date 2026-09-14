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
}

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
    /// trimmed form they store. A test runs both over the same inputs.
    /// </summary>
    /// <returns>
    /// <c>null</c> when the input is no leeftijd at all. The caller lets the write refuse it, with the write's own 400
    /// and sentence, or refuses it the same way. It never skips the rights check on a null.
    /// </returns>
    public static Leeftijdsinhoud? UitInvoer(string? leeftijd) =>
        Jaarfasen.LeesLeeftijd(leeftijd) is { } code ? new Leeftijdsinhoud(code) : null;
}

/// <summary>The planning of one klas (jaarplan, (her)generatie, agenda, hoeken, algemene fiches): the "LK eigen" resource.</summary>
public sealed record Klasplanning(Guid KlasId);

/// <summary>
/// An existing activiteit, as the delete and move rows need it (ADR-0030 §3, R25, R33, I19). It also serves every
/// HL or "LK leeftijd" row about that activiteit, through its <paramref name="Leeftijd"/>.
/// </summary>
/// <param name="ActiviteitId">The activiteit.</param>
/// <param name="Leeftijd">The leeftijd of its subthema.</param>
/// <param name="MakerId">Who created it, or <c>null</c> (imported, older than the rule, or its maker was removed).</param>
/// <param name="HeeftDoelkoppelingen">
/// Whether any goal is linked to it, whatever the link's status. Counting a <c>geweigerd</c> or <c>voorgesteld</c> link
/// as linked is the fail-closed reading of R25's "while no goal is linked to it". It is neither ruled nor a listed
/// default; the owner's answer is owed before any path creates an activiteit link that is not <c>manueel</c> (E8-07).
/// See the R25 carry-forward under E6-02 in <c>backlog/E6-beheer-rollen-samenwerking.md</c>.
/// </param>
public sealed record Activiteitbron(Guid ActiviteitId, string Leeftijd, Guid? MakerId, bool HeeftDoelkoppelingen);

/// <summary>
/// A thema, as deleting it needs it (E6-02, default I26). The delete takes every subthema, subdoel and activiteit under
/// it along, at every leeftijd, so what decides themabeheer's right is whether any of those is someone else's.
/// </summary>
/// <param name="ThemaId">The thema.</param>
/// <param name="HeeftAndermansInhoud">
/// Whether it holds a subthema, subdoel or activiteit that its own wizard run did not create, or that run has ended (I23:
/// after the run its items are ordinary shared content). <c>false</c> for an empty thema.
/// </param>
public sealed record Themabron(Guid ThemaId, bool HeeftAndermansInhoud);
