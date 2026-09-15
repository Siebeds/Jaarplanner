using Jaarplanner.Domain.Ontwikkelingsrapport;

namespace Jaarplanner.Application.Ontwikkelingsrapport;

/// <summary>
/// The ontwikkelingsrapport of one child at one evaluatiemoment (FB-003, FR-13.3, Art. IX.4, ADR-0035 §3.1): per
/// rapportdoel of the one K3 set a star and a text, and an algemeen besluit (R8, R9). <b>Pupil data</b> (Art. VI.7).
/// <para>
/// <b>Who may call what is the matrix's</b> (<c>OntwikkelingsrapportLezen</c>, <c>RapportInvullen</c>), applied on the
/// routes, both on the child's klas. What this service adds holds for everyone: every rapportdoel of the set is on every
/// report (D2), a star comes from the one scale, and a text is at most so long.
/// </para>
/// <para>
/// <b>It never counts for dekking</b> (FR-13.9): nothing the dekking computes reads what is stored here.
/// </para>
/// <para>
/// <b>No child's name and no text in a fault or a log</b> (ADR-0035 §3.8). Faults use the shared CRUD vocabulary
/// (<c>SchoolcontentNietGevondenFout</c> → 404, <c>SchoolcontentValidatieFout</c> → 400).
/// </para>
/// </summary>
public interface IOntwikkelingsrapportService
{
    /// <summary>
    /// The report of a child at <paramref name="moment"/>: every rapportdoel of the set in its order, each with its decided
    /// K3 subdoelen (D11, D12) and what has been filled in, and the besluit. An empty report when nothing is written yet;
    /// reading one stores nothing. 404 when the child does not exist.
    /// </summary>
    Task<RapportWeergave> HaalRapportOpAsync(Guid leerlingId, int moment, CancellationToken cancellationToken = default);

    /// <summary>
    /// Sets the star and the text for one rapportdoel. No star and a blank text clear it. 404 when the child or the
    /// rapportdoel does not exist, 400 when the star is not on the scale or the text is too long.
    /// </summary>
    Task<BeoordelingWeergave> BewaarBeoordelingAsync(
        Guid leerlingId,
        int moment,
        Guid rapportdoelId,
        BeoordelingInvoer invoer,
        CancellationToken cancellationToken = default);

    /// <summary>Sets the algemeen besluit; blank clears it. 404 when the child does not exist, 400 when it is too long.</summary>
    Task<BesluitWeergave> BewaarBesluitAsync(
        Guid leerlingId,
        int moment,
        BesluitInvoer invoer,
        CancellationToken cancellationToken = default);
}

/// <summary>One report as the screen reads it.</summary>
/// <param name="LeerlingId">The child.</param>
/// <param name="KlasId">The child's klas: what the screen asks the rights about.</param>
/// <param name="Voornaam">The child's first name.</param>
/// <param name="Achternaam">The child's family name.</param>
/// <param name="KlasNaam">The klas's name, for the heading.</param>
/// <param name="SchooljaarNaam">The klas's schooljaar, for the heading: a report can be opened in a past year.</param>
/// <param name="Moment">1, 2 or 3.</param>
/// <param name="Rapportdoelen">Every rapportdoel of the set, in its order, with what is filled in for it.</param>
/// <param name="Besluit">The algemeen besluit, or none yet.</param>
/// <param name="BesluitStatus">Who wrote the besluit; null when there is none.</param>
/// <param name="Tekening">The kindtekening's version and size (FB-005), or none; the image itself is a route of its own.</param>
public sealed record RapportWeergave(
    Guid LeerlingId,
    Guid KlasId,
    string Voornaam,
    string Achternaam,
    string KlasNaam,
    string SchooljaarNaam,
    int Moment,
    IReadOnlyList<RapportdoelBeoordelingWeergave> Rapportdoelen,
    string? Besluit,
    Tekststatus? BesluitStatus,
    TekeningWeergave? Tekening);

/// <summary>One rapportdoel on a report: the set's side, and the child's.</summary>
/// <param name="RapportdoelId">The rapportdoel.</param>
/// <param name="Titel">What the parent reads.</param>
/// <param name="Subdoelen">What it bundles: for the teacher only (R11), and only its decided K3 subdoelen.</param>
/// <param name="GradatieId">The chosen star, or none.</param>
/// <param name="Tekst">The text, or none.</param>
/// <param name="TekstStatus">Who wrote the text; null when there is none.</param>
public sealed record RapportdoelBeoordelingWeergave(
    Guid RapportdoelId,
    string Titel,
    IReadOnlyList<RapportdoelSubdoelWeergave> Subdoelen,
    Guid? GradatieId,
    string? Tekst,
    Tekststatus? TekstStatus);

/// <summary>What a teacher sets for one rapportdoel: the star and the text together, as the screen holds them.</summary>
/// <param name="GradatieId">A star of the scale, or null for none.</param>
/// <param name="Tekst">The text; null or blank for none. Nullable so a missing field reaches the service's Dutch, not ASP.NET's English.</param>
public sealed record BeoordelingInvoer(Guid? GradatieId, string? Tekst);

/// <summary>One rapportdoel's star and text as stored after a save; both null when the save cleared them.</summary>
public sealed record BeoordelingWeergave(Guid RapportdoelId, Guid? GradatieId, string? Tekst, Tekststatus? TekstStatus);

/// <summary>What a teacher sets as the algemeen besluit.</summary>
/// <param name="Tekst">The besluit; null or blank for none.</param>
public sealed record BesluitInvoer(string? Tekst);

/// <summary>The algemeen besluit as stored after a save; both null when the save cleared it.</summary>
public sealed record BesluitWeergave(string? Besluit, Tekststatus? BesluitStatus);
