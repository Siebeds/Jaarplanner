using Jaarplanner.Domain.Kat;

namespace Jaarplanner.Application.Kat;

/// <summary>
/// One thing a detector noticed about a klas, on this tick or on this read (TB-057, ADR-0059 D2). It is the fresh
/// truth; a <see cref="Signaal"/> row is only the memory that it was noticed, and the state a person put on it.
/// </summary>
/// <param name="Soort">What was noticed.</param>
/// <param name="KlasId">The klas it is about.</param>
/// <param name="Sleutel">
/// What makes it the same finding across ticks, unique within its soort and klas: a goal code, a subthema id. A
/// detector that returns the same sleutel for the same situation is what keeps a tick from writing a second row.
/// </param>
/// <param name="OntvangerIds">
/// Who is addressed, from <see cref="Katcontext.OntvangerIds"/>. A detector narrows that list when a finding concerns
/// fewer people; it never widens it, because the context already holds everyone the klas addresses (ADR-0059 D5).
/// </param>
/// <param name="Titel">
/// What the recipient reads, in Dutch: a teacher can act on it, which Art. II.3 allows to be composed here. It is
/// derived again on every read, never stored (D2).
/// </param>
/// <param name="Verwijzing">
/// Where she can do something about it, as a path in the app (<c>/klassen/{id}/agenda</c>), or <c>null</c> when the
/// finding points nowhere. The frontend turns it into a link; the backend names no host.
/// </param>
public sealed record Signaalvondst(
    Signaalsoort Soort,
    Guid KlasId,
    string Sleutel,
    IReadOnlyList<Guid> OntvangerIds,
    string Titel,
    string? Verwijzing = null)
{
    /// <summary>Identity across a tick and a read: the same situation, whoever it is addressed to.</summary>
    public (Signaalsoort Soort, Guid KlasId, string Sleutel) Kenmerk => (Soort, KlasId, Sleutel);
}
