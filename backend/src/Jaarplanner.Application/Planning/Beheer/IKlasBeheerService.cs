namespace Jaarplanner.Application.Planning.Beheer;

/// <summary>
/// CRUD use cases for <c>Klas</c> (Art. IX.3) — the missing creation path without which a fresh
/// deployment can hold no class-scoped school content at all.
/// <para>
/// <b>Why this exists.</b> <c>Subthema</c>/<c>Subdoel</c>/<c>Activiteit</c> are class &amp; age scoped
/// (Art. IX.2) and a <c>Subthema</c> requires a resolvable <c>KlasId</c>. Before this service there was
/// no seed and no endpoint that created a <c>Klas</c>, so the school-content Excel import reported every
/// subthema as "onbekende klas — overgeslagen" and silently dropped its whole activiteit subtree, and
/// <c>MaakSubthemaAsync</c> rejected every call with "Onbekende klas". E3 compounds it: a jaarplan is
/// generated <i>per class</i>, so plan generation has nothing to generate for.
/// </para>
/// <para>
/// Faults use the shared CRUD fault vocabulary
/// (<see cref="Schoolcontent.Beheer.SchoolcontentNietGevondenFout"/> → 404,
/// <see cref="Schoolcontent.Beheer.SchoolcontentValidatieFout"/> → 400) so the existing
/// exception handler maps them without new plumbing in the (thin) Api (Art. VIII).
/// </para>
/// </summary>
public interface IKlasBeheerService
{
    Task<IReadOnlyList<KlasWeergave>> HaalKlassenOpAsync(CancellationToken cancellationToken = default);

    Task<KlasWeergave> HaalKlasOpAsync(Guid klasId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Creates a class group. The name must be unique (case-insensitively) — a duplicate is a
    /// validation fault, not a second class, because the Excel import resolves classes <b>by name</b>
    /// and two same-named classes would make that resolution arbitrary.
    /// </summary>
    Task<KlasWeergave> MaakKlasAsync(KlasCreatie creatie, CancellationToken cancellationToken = default);

    Task<KlasWeergave> WijzigKlasAsync(Guid klasId, KlasCreatie wijziging, CancellationToken cancellationToken = default);

    /// <summary>
    /// Deletes a class group. Refused with a validation fault while any subthema still references it —
    /// deleting would orphan class-scoped content (the FK is <c>Restrict</c>), so this reports the
    /// blocking count instead of surfacing a database error (ADR-0006 §4).
    /// </summary>
    Task VerwijderKlasAsync(Guid klasId, CancellationToken cancellationToken = default);
}

/// <summary>Input for creating/renaming a class group.</summary>
/// <param name="Naam">The class name (e.g. "L3 — derde leerjaar"). Required, unique.</param>
/// <param name="Leerjaar">The leerjaar/leeftijdsgroep ordinal (e.g. 3 for L3); 0 for kleuter groepen.</param>
public sealed record KlasCreatie(string Naam, int Leerjaar);

/// <summary>A class group as returned by the API.</summary>
/// <param name="Id">Surrogate identity.</param>
/// <param name="Naam">The class name.</param>
/// <param name="Leerjaar">The leerjaar/leeftijdsgroep ordinal.</param>
/// <param name="AantalSubthemas">How many subthema's are scoped to this class (0 for a fresh class).</param>
public sealed record KlasWeergave(Guid Id, string Naam, int Leerjaar, int AantalSubthemas);
