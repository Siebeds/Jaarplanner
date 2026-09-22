using Jaarplanner.Domain.Kat;

namespace Jaarplanner.Application.Kat;

/// <summary>
/// What the cat brought one gebruiker (TB-057, ADR-0059 K4): what it noticed, and the proposals that are waiting for
/// her decision. FB-071 is what shows it.
/// </summary>
/// <param name="Signalen">What the cat noticed, newest first, and still true at this moment.</param>
/// <param name="Voorstellen">The open proposals she is the one to decide (Art. IV.1), newest first.</param>
public sealed record Deurmat(IReadOnlyList<Deurmatsignaal> Signalen, IReadOnlyList<Deurmatvoorstel> Voorstellen);

/// <summary>
/// One thing the cat noticed, as the deurmat shows it. <paramref name="Gegevens"/> and <paramref name="Verwijzing"/>
/// are derived on this read, never read from the stored signal, so the cat cannot assert a state of the dekking the
/// computation no longer supports (ADR-0059 D2).
/// </summary>
/// <param name="Gegevens">
/// What the message needs, keyed by the placeholder names of <paramref name="Soort"/>'s entry in <c>nl.json</c>,
/// which is where the sentence itself lives (owner ruling 2026-09-22).
/// </param>
public sealed record Deurmatsignaal(
    Guid Id,
    Signaalsoort Soort,
    Guid KlasId,
    string Klasnaam,
    IReadOnlyDictionary<string, object> Gegevens,
    string? Verwijzing,
    DateTimeOffset Aangemaakt,
    bool Gezien);

/// <summary>Which flow an open proposal belongs to; each is decided in its own screen, not here.</summary>
public enum Deurmatvoorstelsoort
{
    /// <summary>An activiteit the AI proposed under a subthema (ADR-0056).</summary>
    Activiteitvoorstel,

    /// <summary>A place the AI proposed for a leerplandoel (ADR-0050).</summary>
    Subdoelvoorstel,

    /// <summary>A new subthema the AI proposed (ADR-0050).</summary>
    Subthemavoorstel,

    /// <summary>A minimumdoel the AI proposed as themadoel (ADR-0052).</summary>
    Minimumdoelsuggestie,
}

/// <summary>
/// One open proposal on the deurmat. It is a pointer, not a second place to decide: deciding it stays in the flow that
/// owns it, so there is one definition of what accepting means.
/// </summary>
public sealed record Deurmatvoorstel(
    Deurmatvoorstelsoort Soort,
    Guid Id,
    string Titel,
    string? Verwijzing,
    string AiMotivatie);

/// <summary>What the cat brought the signed-in gebruiker, and the two things she can do with a signal.</summary>
public interface IDeurmatService
{
    /// <summary>
    /// The deurmat of <paramref name="gebruikerId"/>. Every row goes through <c>Rechtenmatrix</c>: she sees a signal
    /// only if it is addressed to her, and a proposal only if she is the one to decide it (Art. VI.1).
    /// </summary>
    Task<Deurmat> HaalAsync(Guid gebruikerId, CancellationToken ct);

    /// <summary>Records that she saw a signal of hers.</summary>
    /// <exception cref="Schoolcontent.Beheer.SchoolcontentNietGevondenFout">
    /// No signal with that id is addressed to her. A signal of someone else's is answered as a missing one, so the
    /// deurmat never tells her that a signal she may not see exists.
    /// </exception>
    Task MarkeerGezienAsync(Guid gebruikerId, Guid signaalId, CancellationToken ct);

    /// <summary>
    /// Puts a signal of hers away until the next schooldag (ADR-0059 D4). It comes back then if its reason still
    /// holds, and never if it does not.
    /// </summary>
    /// <exception cref="Schoolcontent.Beheer.SchoolcontentNietGevondenFout">As <see cref="MarkeerGezienAsync"/>.</exception>
    Task StelUitAsync(Guid gebruikerId, Guid signaalId, CancellationToken ct);
}
