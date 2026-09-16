using Jaarplanner.Domain.Curriculum;

namespace Jaarplanner.Application.Schoolcontent.Beheer;

/// <summary>
/// The leerplandoelen a thema reaches through what hangs under it, per leeftijd (FB-009, FB-044, FR-2.3).
/// <para>
/// <b>A preview of what the thema offers, never dekking.</b> Dekking belongs to a klas and needs a plan (Art. V.1); this
/// knows no klas. It is computed from the links and never stored.
/// </para>
/// <para>
/// <b>Leerplandoelen only.</b> The minimumdoelen a thema aims at are its themadoelen (ADR-0046) and stand above this block
/// on the page, so the overview no longer repeats them (FB-044). A leerplandoel still carries its minimumdoel's ref, which
/// its detail shows.
/// </para>
/// <para>
/// <b>Only decided links count</b> (<c>Aanvaard</c>, <c>Manueel</c>), the rule Art. V uses: themadoelen, accepted
/// doelsuggesties, each subthema's subdoelen and the goals of its activiteiten. A themadoel or a doelsuggestie hangs on the
/// whole thema, so it is placed at its leerplandoel's own jaar/fase (the ticket's default); a subdoel and an activiteit goal
/// at their subthema's leeftijd.
/// </para>
/// </summary>
public interface IThemaDoelenoverzichtQuery
{
    /// <exception cref="SchoolcontentNietGevondenFout">The thema does not exist.</exception>
    Task<ThemaDoelenoverzicht> HaalOpAsync(Guid themaId, CancellationToken cancellationToken = default);
}

/// <summary>
/// Where in the thema a leerplandoel is linked. A thema's doelsuggestie proposes a minimumdoel and is no place of a
/// leerplandoel (ADR-0049).
/// </summary>
public enum DoelPlaatsSoort
{
    Themadoel,
    Subdoel,
    Activiteit,
}

/// <summary>One place a leerplandoel is linked.</summary>
/// <param name="Naam">The subthema's name for a subdoel, the activiteit's for an activiteit goal; null for a themadoel.</param>
public sealed record DoelPlaats(DoelPlaatsSoort Soort, string? Naam);

/// <summary>A leerplandoel the thema reaches at one leeftijd, once, with every place it is linked.</summary>
public sealed record OverzichtLeerplandoel(
    string Code,
    Doelsoort Doelsoort,
    string Tekst,
    bool NietMeerInOpstap,
    string? MinimumdoelRef,
    IReadOnlyList<DoelPlaats> Plaatsen);

/// <summary>What the thema reaches at one leeftijd.</summary>
public sealed record LeeftijdDoelen(string Leeftijd, IReadOnlyList<OverzichtLeerplandoel> Leerplandoelen);

/// <summary>The whole overview, leeftijden in jaar/fase order (JK first).</summary>
public sealed record ThemaDoelenoverzicht(Guid ThemaId, IReadOnlyList<LeeftijdDoelen> Leeftijden);
