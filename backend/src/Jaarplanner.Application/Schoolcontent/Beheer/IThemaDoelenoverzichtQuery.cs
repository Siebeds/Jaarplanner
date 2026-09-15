using Jaarplanner.Domain.Curriculum;

namespace Jaarplanner.Application.Schoolcontent.Beheer;

/// <summary>
/// The leerplandoelen a thema reaches through what hangs under it, per leeftijd, and the minimumdoelen those reach through
/// the concordance (FB-009, FR-2.3, FR-9.3).
/// <para>
/// <b>A preview of what the thema offers, never dekking.</b> Dekking belongs to a klas and needs a plan (Art. V.1); this
/// knows no klas. It is computed from the links and never stored: a thema has no link of its own to a minimumdoel, and its
/// 2–3 themadoelen stay its anchors (owner ruling 2026-09-15).
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
/// Where in the thema a leerplandoel is linked. An accepted doelsuggestie is a place of its own and never a themadoel: the
/// 2–3 themadoelen are the thema's curated anchors and the suggesties are kept apart from them (Art. IX.2); accepting one
/// changes its status and nothing else.
/// </summary>
public enum DoelPlaatsSoort
{
    Themadoel,
    Doelsuggestie,
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

/// <summary>A minimumdoel the leeftijd's leerplandoelen concord to.</summary>
/// <param name="Leerplandoelen">The codes of this leeftijd's leerplandoelen that lead to it, in code order.</param>
public sealed record OverzichtMinimumdoel(
    string Ref,
    string Leeftijd,
    string Nr,
    string Omschrijving,
    IReadOnlyList<string> Leerplandoelen);

/// <summary>What the thema reaches at one leeftijd.</summary>
public sealed record LeeftijdDoelen(
    string Leeftijd,
    IReadOnlyList<OverzichtLeerplandoel> Leerplandoelen,
    IReadOnlyList<OverzichtMinimumdoel> Minimumdoelen);

/// <summary>The whole overview, leeftijden in jaar/fase order (JK first).</summary>
public sealed record ThemaDoelenoverzicht(Guid ThemaId, IReadOnlyList<LeeftijdDoelen> Leeftijden);
