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
/// <param name="Gegevens">
/// What the sentence needs, not the sentence: the doel's code and text, a thema's name, a count of lesweken. The copy
/// lives in <c>nl.json</c> and the frontend composes it (owner ruling 2026-09-22), so the cat's whole vocabulary stays
/// in the catalogue the catalogus test guards, rather than half here and half there. Art. II.3 would have allowed
/// composing it here; the owner chose the catalogue.
/// <para>
/// Keys are the placeholder names of the soort's message, and each soort documents its own on
/// <see cref="Signaalsoort"/>. Values are strings or numbers: a number stays a number so the copy can count
/// ("1 lesweek" against "3 lesweken"). It is derived again on every read, never stored (D2).
/// </para>
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
    IReadOnlyDictionary<string, object> Gegevens,
    string? Verwijzing = null)
{
    /// <summary>Identity across a tick and a read: the same situation, whoever it is addressed to.</summary>
    public (Signaalsoort Soort, Guid KlasId, string Sleutel) Kenmerk => (Soort, KlasId, Sleutel);
}
