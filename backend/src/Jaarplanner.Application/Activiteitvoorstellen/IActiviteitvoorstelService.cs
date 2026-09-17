using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Schoolcontent;

namespace Jaarplanner.Application.Activiteitvoorstellen;

/// <summary>
/// The activiteitvoorstellen use cases (FB-025, ADR-0056): the AI proposes activiteiten under a subthema to the gebruiker
/// who asked, and she or directie decides them (A3). Rights are the Api's: asking is <c>EigenActiviteitMaken</c> at the
/// subthema's leeftijd, deciding <c>ActiviteitvoorstelBeslissen</c> on the proposal.
/// </summary>
public interface IActiviteitvoorstelService
{
    /// <summary>
    /// The open proposals under the subthema, the caller's own first, oldest first: only hers, or with
    /// <paramref name="vanIedereen"/> everyone's (directie, A3).
    /// </summary>
    /// <exception cref="Schoolcontent.Beheer.SchoolcontentNietGevondenFout">The subthema does not exist.</exception>
    Task<IReadOnlyList<ActiviteitvoorstelWeergave>> HaalOpAsync(
        Guid subthemaId,
        Guid gebruikerId,
        bool vanIedereen,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Asks the AI for activiteiten under the subthema, replacing the caller's open proposals there (D4). An unreadable
    /// answer stores nothing and changes nothing (Art. IV.5).
    /// </summary>
    /// <exception cref="Schoolcontent.Beheer.SchoolcontentValidatieFout">The subthema has no decided subdoel (D6).</exception>
    /// <exception cref="Ai.PromptTeGrootFout">The request is over the prompt ceiling (TB-007).</exception>
    Task<ActiviteitvoorstelResultaat> StelVoorAsync(Guid subthemaId, Guid gebruikerId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Accepts, possibly changed, or rejects a proposal (D8). Accepting creates an own activiteit of its asker, whoever
    /// decides (A3).
    /// </summary>
    /// <exception cref="Schoolcontent.Beheer.SchoolcontentNietGevondenFout">No such proposal.</exception>
    /// <exception cref="Schoolcontent.Beheer.SchoolcontentValidatieFout">Already decided, or the decision is not valid.</exception>
    Task<ActiviteitvoorstelBesluit> BeslisAsync(
        Guid activiteitvoorstelId,
        ActiviteitvoorstelBeslissing beslissing,
        CancellationToken cancellationToken = default);
}

/// <summary>One goal of a proposal, with what the screen shows of it.</summary>
public sealed record ActiviteitvoorstelDoel(string LeerplandoelCode, string? Tekst, Doelsoort? Doelsoort);

/// <summary>One open proposal, with who asked for it; <see cref="IsEigen"/> when that is the caller.</summary>
public sealed record ActiviteitvoorstelWeergave(
    Guid Id,
    Guid SubthemaId,
    Guid AanvragerId,
    string AanvragerNaam,
    bool IsEigen,
    string Naam,
    ActiviteitType? ActiviteitType,
    string VerwachteUitkomsten,
    int LengteInLesuren,
    Guid? OnderzoeksvraagId,
    string? Onderzoeksvraag,
    IReadOnlyList<ActiviteitvoorstelDoel> Doelen,
    string AiMotivatie);

/// <summary>
/// Body of a decision. <c>Geweigerd</c> ignores the rest. <c>Aanvaard</c> without a <see cref="Naam"/> takes the proposal
/// as it is; with one, it is the edited form and every field is taken as given: a <c>null</c> soort is none, a
/// <c>null</c> list keeps no goal, and the expected outcomes and length are required.
/// </summary>
public sealed record ActiviteitvoorstelBeslissing(
    KoppelingStatus Status,
    string? Naam = null,
    ActiviteitType? ActiviteitType = null,
    string? VerwachteUitkomsten = null,
    int? LengteInLesuren = null,
    IReadOnlyList<string>? LeerplandoelCodes = null);

/// <summary>What a decision did: the status stored, and for an acceptance the own activiteit it created.</summary>
public sealed record ActiviteitvoorstelBesluit(KoppelingStatus Status, Guid? ActiviteitId);

/// <summary>
/// What a run did: how many proposals it stored and how many items of the answer it dropped, or, for an unreadable
/// answer, an English operator diagnostic and no change.
/// </summary>
public sealed record ActiviteitvoorstelResultaat(bool IsGeslaagd, int AantalVoorgesteld, int AantalOvergeslagen, string? Fout)
{
    public static ActiviteitvoorstelResultaat Geslaagd(int voorgesteld, int overgeslagen) => new(true, voorgesteld, overgeslagen, null);

    public static ActiviteitvoorstelResultaat Mislukt(string fout) => new(false, 0, 0, fout);
}

/// <summary>The configurable limit of D3, bound from <c>Activiteitvoorstellen</c>.</summary>
public sealed class ActiviteitvoorstelOpties
{
    /// <summary>Configuration section name.</summary>
    public const string SectionName = "Activiteitvoorstellen";

    /// <summary>The highest value <see cref="MaxPerVraag"/> may take.</summary>
    public const int Bovengrens = 10;

    /// <summary>How many proposals one request asks for and keeps at most (D3).</summary>
    public int MaxPerVraag { get; init; } = 5;
}
