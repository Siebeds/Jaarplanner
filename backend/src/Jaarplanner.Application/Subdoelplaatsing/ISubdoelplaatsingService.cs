using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Schoolcontent;

namespace Jaarplanner.Application.Subdoelplaatsing;

/// <summary>
/// The subdoelplaatsing use cases (FB-057, ADR-0050): how many leerplandoelen of a thema's themadoelen are still open
/// per leeftijd, asking the AI where they go, and deciding its proposals. Rights are the Api's (the
/// <c>SubdoelplaatsingVragen</c> and <c>SubdoelplaatsingBeslissen</c> rows, per leeftijd).
/// </summary>
public interface ISubdoelplaatsingService
{
    /// <summary>
    /// Per leeftijd at which the thema has a subthema: the open count and the open proposals (D1). Only open proposals:
    /// a decided one is an ordinary subdoel or subthema, or gone.
    /// </summary>
    /// <exception cref="Schoolcontent.Beheer.SchoolcontentNietGevondenFout">The thema does not exist.</exception>
    Task<SubdoelplaatsingOverzicht> HaalOpAsync(Guid themaId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Asks the AI where the open goals of <paramref name="leeftijd"/> go, replacing that leeftijd's open proposals (D2).
    /// An unreadable answer stores nothing and changes nothing (Art. IV.5).
    /// </summary>
    /// <exception cref="Schoolcontent.Beheer.SchoolcontentValidatieFout">No open goal, or no subthema at that leeftijd.</exception>
    /// <exception cref="Ai.PromptTeGrootFout">The request is over the prompt ceiling (TB-007).</exception>
    Task<SubdoelplaatsingResultaat> StelVoorAsync(Guid themaId, string leeftijd, CancellationToken cancellationToken = default);

    /// <summary>Accepts or rejects a proposal to add a goal to an existing subthema (D5).</summary>
    Task BeslisSubdoelAsync(Guid subdoelvoorstelId, KoppelingStatus status, CancellationToken cancellationToken = default);

    /// <summary>Accepts, possibly changed, or rejects a proposed new subthema with its goals (D4).</summary>
    Task BeslisSubthemaAsync(Guid subthemavoorstelId, SubthemavoorstelBeslissing beslissing, CancellationToken cancellationToken = default);
}

/// <summary>The thema page's view: one entry per leeftijd with a subthema, in the order of <see cref="Jaarfasen.Alle"/>.</summary>
public sealed record SubdoelplaatsingOverzicht(Guid ThemaId, IReadOnlyList<LeeftijdPlaatsing> Leeftijden);

/// <summary>
/// One leeftijd: how many goals are open (for everyone), and the open proposals, which the Api sends only to whoever may
/// decide them (D6); <see cref="MagBeslissen"/> says which the caller got.
/// </summary>
public sealed record LeeftijdPlaatsing(
    string Leeftijd,
    int AantalOpen,
    bool MagBeslissen,
    IReadOnlyList<SubdoelvoorstelWeergave> Subdoelvoorstellen,
    IReadOnlyList<SubthemavoorstelWeergave> Subthemavoorstellen);

/// <summary>
/// One open goal proposal. <see cref="SubthemaId"/> is set for one in an existing subthema;
/// <see cref="ActiviteitNaam"/> names the activiteit an accepted goal came from (ADR-0052 D4), while it still exists.
/// </summary>
public sealed record SubdoelvoorstelWeergave(
    Guid Id,
    string LeerplandoelCode,
    string? Tekst,
    Doelsoort? Doelsoort,
    Guid? SubthemaId,
    string AiMotivatie,
    string? ActiviteitNaam = null);

/// <summary>One open proposed new subthema with its goals.</summary>
public sealed record SubthemavoorstelWeergave(
    Guid Id,
    string Naam,
    string Onderzoeksvraag,
    int DuurWeken,
    string AiMotivatie,
    IReadOnlyList<SubdoelvoorstelWeergave> Doelen);

/// <summary>Body of a decision on a proposed goal: <c>Aanvaard</c> or <c>Geweigerd</c>.</summary>
public sealed record SubdoelvoorstelBeslissing(KoppelingStatus Status);

/// <summary>
/// Body of a decision on a proposed new subthema. <c>Aanvaard</c> may carry a changed name, onderzoeksvraag and length,
/// and the goals to keep; an absent value keeps the proposal's. <c>Geweigerd</c> ignores the rest.
/// </summary>
public sealed record SubthemavoorstelBeslissing(
    KoppelingStatus Status,
    string? Naam = null,
    string? Onderzoeksvraag = null,
    int? DuurWeken = null,
    IReadOnlyList<string>? LeerplandoelCodes = null);

/// <summary>
/// What a run did: how many goal proposals and new subthema's it stored and how many items of the answer it dropped,
/// or, for an unreadable answer, an English operator diagnostic and no change.
/// </summary>
public sealed record SubdoelplaatsingResultaat(
    bool IsGeslaagd,
    int AantalVoorgesteld,
    int AantalNieuweSubthemas,
    int AantalOvergeslagen,
    string? Fout)
{
    public static SubdoelplaatsingResultaat Geslaagd(int voorgesteld, int nieuw, int overgeslagen) => new(true, voorgesteld, nieuw, overgeslagen, null);

    public static SubdoelplaatsingResultaat Mislukt(string fout) => new(false, 0, 0, 0, fout);
}
