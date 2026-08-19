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
    /// Creates a class group <b>inside a school year</b> (Art. IX.3: "Schooljaar — contains multiple klassen";
    /// E3-01). The school year must exist. The name must be unique (case-insensitively) <b>school-wide</b> — a
    /// duplicate is a validation fault, not a second class, because the Excel import resolves classes <b>by
    /// name</b> and two same-named classes would make that resolution arbitrary.
    /// </summary>
    Task<KlasWeergave> MaakKlasAsync(
        Guid schooljaarId,
        KlasCreatie creatie,
        CancellationToken cancellationToken = default);

    Task<KlasWeergave> WijzigKlasAsync(Guid klasId, KlasCreatie wijziging, CancellationToken cancellationToken = default);

    /// <summary>
    /// Deletes a class group. Refused with a validation fault while any subthema still references it —
    /// deleting would orphan class-scoped content (the FK is <c>Restrict</c>), so this reports the
    /// blocking count instead of surfacing a database error (ADR-0006 §4).
    /// </summary>
    Task VerwijderKlasAsync(Guid klasId, CancellationToken cancellationToken = default);
}

/// <summary>
/// Input for creating/renaming a class group. It deliberately carries <b>no</b> <c>SchooljaarId</c>: on create the
/// year comes from the route (<c>POST /api/schooljaren/{schooljaarId}/klassen</c>), and on update it must not
/// change — moving a class to another school year would move its jaarplan onto a different vakantiestructuur,
/// which is a copy (E8-03), not a rename. A <c>SchooljaarId</c> in this record would have made "rename" able to
/// silently do that.
/// </summary>
/// <param name="Naam">The class name (e.g. "L3 — derde leerjaar"). Required, unique school-wide.</param>
/// <param name="Leerjaar">The leerjaar/leeftijdsgroep ordinal (e.g. 3 for L3); 0 for kleuter groepen.</param>
public sealed record KlasCreatie(string Naam, int Leerjaar);

/// <summary>A class group as returned by the API.</summary>
/// <param name="Id">Surrogate identity.</param>
/// <param name="SchooljaarId">The school year that contains this class (Art. IX.3).</param>
/// <param name="Naam">The class name.</param>
/// <param name="Leerjaar">The leerjaar/leeftijdsgroep ordinal.</param>
/// <param name="AantalSubthemas">How many subthema's are scoped to this class (0 for a fresh class).</param>
/// <param name="JaarFasen">
/// The Op.stap jaar/fase codes this class teaches, derived from <paramref name="Leerjaar"/> (E9-07).
/// <para>
/// <b>Derived server-side and shipped with the class, rather than exposed as an endpoint of its own or re-derived in
/// the browser.</b> The rule lives in <c>Jaarfasen.VoorLeerjaar</c> and is what <c>Dekkingsbereik.EigenJaarFase</c>
/// already measures against; a second copy in TypeScript would be a second answer to "what does this class teach?",
/// and the two would drift the first time the graadklas decision (Art. XIV) changes one of them. Every caller that
/// has a class now has its fasen for free, which is what the Doelkiezer needs to stop offering an L3 teacher
/// kleuterdoelen.
/// </para>
/// <para>
/// <b>A kleutergroep yields all three kleuter codes, not one</b> — <c>Leerjaar</c> is <c>0</c> and cannot say which
/// kleuterjaar. That is the widest honest answer, and E5-02's ruling of 2026-08-04 is the precedent for what to do
/// with it: let the teacher narrow within the set, on screen, rather than guess.
/// </para>
/// <para>
/// <b>Empty means "cannot be derived", never "teaches nothing"</b>: it is the unresolved graadklas/menggroep case
/// (Art. XIV), where <c>Jaarfasen.VoorLeerjaar</c> returns null. A caller must widen its scope rather than narrow to
/// nothing — narrowing a picker to an empty set would make every leerplandoel unreachable, which is worse than the
/// unscoped search this exists to replace.
/// </para>
/// </param>
public sealed record KlasWeergave(
    Guid Id,
    Guid SchooljaarId,
    string Naam,
    int Leerjaar,
    int AantalSubthemas,
    IReadOnlyList<string> JaarFasen);
