using Jaarplanner.Domain.Curriculum;

namespace Jaarplanner.Application.Schoolcontent.Beheer;

/// <summary>
/// The leerplandoelen of a thema per leeftijd (FB-009, TB-048, FR-2.3).
/// <para>
/// <b>A preview of what the thema offers, never dekking.</b> Dekking belongs to a klas and needs a plan (Art. V.1); this
/// knows no klas. It is computed and never stored, and it counts no leerplandoel for dekking that Art. V.1 does not.
/// </para>
/// <para>
/// <b>The list is the concordance of the thema's minimumdoelen</b> (TB-048): every leerplandoel whose minimumdoel is one of
/// the thema's themadoelen (ADR-0046), at its own jaar/fase, whether or not anything under the thema links it yet.
/// Linking or unlinking a minimumdoel changes it at once.
/// </para>
/// <para>
/// <b>Beside the list, the decided links that fall outside it</b> (<c>Aanvaard</c>, <c>Manueel</c>): a leerplandoel a
/// subdoel, a shared activiteit or a legacy leerplandoel-themadoel links, whose minimumdoel the thema does not aim at. A
/// subdoel and an activiteit goal sit at their subthema's leeftijd, a legacy themadoel at its leerplandoel's jaar/fase.
/// They are shown apart and never counted with the list.
/// </para>
/// </summary>
public interface IThemaDoelenoverzichtQuery
{
    /// <exception cref="SchoolcontentNietGevondenFout">The thema does not exist.</exception>
    Task<ThemaDoelenoverzicht> HaalOpAsync(Guid themaId, CancellationToken cancellationToken = default);
}

/// <summary>
/// Where in the thema a leerplandoel is linked. A thema's doelsuggestie proposes a minimumdoel and is no place of a
/// leerplandoel (ADR-0052).
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

/// <summary>A leerplandoel at one leeftijd, once.</summary>
/// <param name="Plaatsen">Where the thema links it; filled only for a leerplandoel outside the list.</param>
public sealed record OverzichtLeerplandoel(
    string Code,
    Doelsoort Doelsoort,
    string Tekst,
    bool NietMeerInOpstap,
    string? MinimumdoelRef,
    IReadOnlyList<DoelPlaats> Plaatsen);

/// <summary>One leeftijd of the overview.</summary>
/// <param name="Leerplandoelen">The leerplandoelen of the thema's minimumdoelen at this jaar/fase: the list, and what the counts count.</param>
/// <param name="BuitenMinimumdoelen">Leerplandoelen linked under the thema at this leeftijd that belong to none of its minimumdoelen.</param>
public sealed record LeeftijdDoelen(
    string Leeftijd,
    IReadOnlyList<OverzichtLeerplandoel> Leerplandoelen,
    IReadOnlyList<OverzichtLeerplandoel> BuitenMinimumdoelen);

/// <summary>The whole overview, leeftijden in jaar/fase order (JK first).</summary>
public sealed record ThemaDoelenoverzicht(Guid ThemaId, IReadOnlyList<LeeftijdDoelen> Leeftijden);
