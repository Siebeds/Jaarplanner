using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Ontwikkelingsrapport;

namespace Jaarplanner.Application.Ontwikkelingsrapport;

/// <summary>
/// The one K3 set of rapportdoelen and the one sterrenschaal (FB-002, FR-13.2, Art. IX.4, ADR-0035 §3.1, §3.2). Neither
/// is pupil data, and neither has a schooljaar (R4, R5, R7).
/// <para>
/// <b>Who may write is the matrix's</b> (<c>RapportsetBewerken</c>: every K3 leerkracht during a running schooljaar, and
/// not admin, R31), applied on the routes. Reading is open to every signed-in gebruiker. What this service adds holds
/// for everyone: a rapportdoel bundles only decided subdoelen of a K3 subthema (D11, D12), checked on every write and
/// filtered on every read.
/// </para>
/// <para>
/// Faults use the shared CRUD vocabulary (<c>SchoolcontentNietGevondenFout</c> → 404, <c>SchoolcontentValidatieFout</c> →
/// 400), with a Dutch sentence a teacher can act on.
/// </para>
/// </summary>
public interface IRapportsetService
{
    /// <summary>The scale, by <c>Volgorde</c>.</summary>
    Task<IReadOnlyList<GradatieWeergave>> HaalGradatiesOpAsync(CancellationToken cancellationToken = default);

    /// <summary>The fixed palette, in its own order: what the colour choice offers.</summary>
    IReadOnlyList<Sterkleur> HaalKleurenOp();

    /// <summary>Adds a star at the end of the scale. 400 when the label is missing or too long, or the kleur is not one of the palette.</summary>
    Task<GradatieWeergave> MaakGradatieAsync(GradatieInvoer invoer, CancellationToken cancellationToken = default);

    /// <summary>Renames and recolours a star. 404 when it does not exist, 400 as for the create.</summary>
    Task<GradatieWeergave> WijzigGradatieAsync(Guid gradatieId, GradatieInvoer invoer, CancellationToken cancellationToken = default);

    /// <summary>Deletes a star. 404 when it does not exist.</summary>
    Task VerwijderGradatieAsync(Guid gradatieId, CancellationToken cancellationToken = default);

    /// <summary>Puts the scale in the order given. 400 unless the list names every star exactly once.</summary>
    Task OrdenGradatiesAsync(VolgordeInvoer invoer, CancellationToken cancellationToken = default);

    /// <summary>The set, by <c>Volgorde</c>, each with only its decided K3 subdoelen (D11, D12).</summary>
    Task<IReadOnlyList<RapportdoelWeergave>> HaalRapportdoelenOpAsync(CancellationToken cancellationToken = default);

    /// <summary>Every subdoel a rapportdoel may bundle: decided, under a K3 subthema. The picker's list.</summary>
    Task<IReadOnlyList<RapportdoelSubdoelWeergave>> HaalKandidatenOpAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Adds a rapportdoel at the end of the set. 400 when the titel is missing or too long, or a subdoel id is not one of
    /// the candidates.
    /// </summary>
    Task<RapportdoelWeergave> MaakRapportdoelAsync(RapportdoelInvoer invoer, CancellationToken cancellationToken = default);

    /// <summary>Sets a rapportdoel's titel and subdoelen. 404 when it does not exist, 400 as for the create.</summary>
    Task<RapportdoelWeergave> WijzigRapportdoelAsync(
        Guid rapportdoelId,
        RapportdoelInvoer invoer,
        CancellationToken cancellationToken = default);

    /// <summary>Deletes a rapportdoel. 404 when it does not exist.</summary>
    Task VerwijderRapportdoelAsync(Guid rapportdoelId, CancellationToken cancellationToken = default);

    /// <summary>Puts the set in the order given. 400 unless the list names every rapportdoel exactly once.</summary>
    Task OrdenRapportdoelenAsync(VolgordeInvoer invoer, CancellationToken cancellationToken = default);
}

/// <summary>What a teacher types for a star.</summary>
/// <param name="Label">Required, at most 60 characters after trimming.</param>
/// <param name="Kleur">One of the <see cref="Sterkleur"/> names, as <c>GET /api/gradaties/kleuren</c> lists them.</param>
/// <remarks>
/// Both nullable, and the kleur a string, on purpose: with a non-nullable string ASP.NET's implicit <c>[Required]</c>
/// would refuse a blank label first, and with the enum type an unknown colour would fail binding, both in English, before
/// the service's Dutch sentence could.
/// </remarks>
public sealed record GradatieInvoer(string? Label, string? Kleur);

/// <summary>A star as the scale shows it.</summary>
/// <param name="Id">Surrogate identity.</param>
/// <param name="Label">What the star means.</param>
/// <param name="Kleur">The colour, serialised by name.</param>
/// <param name="Volgorde">Its place on the scale.</param>
public sealed record GradatieWeergave(Guid Id, string Label, Sterkleur Kleur, int Volgorde);

/// <summary>A new order for the whole scale or the whole set: every id once, first to last.</summary>
/// <param name="Ids">Nullable, so a missing list reaches the Dutch refusal rather than an English binding error.</param>
public sealed record VolgordeInvoer(IReadOnlyList<Guid>? Ids);

/// <summary>What a teacher enters for a rapportdoel.</summary>
/// <param name="Titel">Required, at most 120 characters after trimming.</param>
/// <param name="SubdoelIds">The subdoelen it bundles, each a candidate. Missing or empty is allowed (see the service).</param>
public sealed record RapportdoelInvoer(string? Titel, IReadOnlyList<Guid>? SubdoelIds);

/// <summary>A rapportdoel as the set shows it.</summary>
/// <param name="Id">Surrogate identity.</param>
/// <param name="Titel">The group's title.</param>
/// <param name="Volgorde">Its place in the set.</param>
/// <param name="Subdoelen">Its decided K3 subdoelen, by thema, subthema and code.</param>
public sealed record RapportdoelWeergave(Guid Id, string Titel, int Volgorde, IReadOnlyList<RapportdoelSubdoelWeergave> Subdoelen);

/// <summary>One subdoel as a rapportdoel and the picker show it: the goal it links, and where it sits.</summary>
/// <param name="Id">The subdoel's id: what <see cref="RapportdoelInvoer.SubdoelIds"/> names.</param>
/// <param name="LeerplandoelCode">The linked leerplandoel's code.</param>
/// <param name="LeerplandoelTekst">The linked leerplandoel's official text (read-only, Art. III.1).</param>
/// <param name="Doelsoort">The goal type, serialised by name, as on the leerplandoel read endpoints.</param>
/// <param name="ThemaNaam">The thema the subthema belongs to.</param>
/// <param name="SubthemaNaam">The subthema the subdoel belongs to.</param>
public sealed record RapportdoelSubdoelWeergave(
    Guid Id,
    string LeerplandoelCode,
    string LeerplandoelTekst,
    Doelsoort Doelsoort,
    string ThemaNaam,
    string SubthemaNaam);
