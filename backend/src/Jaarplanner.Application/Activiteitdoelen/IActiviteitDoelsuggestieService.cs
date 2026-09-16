using Jaarplanner.Domain.Schoolcontent;

namespace Jaarplanner.Application.Activiteitdoelen;

/// <summary>
/// The AI's goal proposals for one activiteit (FB-026, ADR-0054): asking for them and deciding one. Rights are the Api's
/// (the <c>DoelenKoppelen</c> row on the activiteit).
/// </summary>
public interface IActiviteitDoelsuggestieService
{
    /// <summary>
    /// Asks the AI for goals of the activiteit's leeftijd, replacing its open proposals (D3). An unreadable answer stores
    /// nothing and changes nothing (Art. IV.5).
    /// </summary>
    /// <exception cref="Schoolcontent.Beheer.SchoolcontentNietGevondenFout">The activiteit does not exist.</exception>
    /// <exception cref="Schoolcontent.Beheer.SchoolcontentValidatieFout">No goal of that leeftijd is left to propose.</exception>
    /// <exception cref="Ai.PromptTeGrootFout">The request is over the prompt ceiling (TB-007).</exception>
    Task<ActiviteitDoelsuggestieResultaat> StelVoorAsync(Guid activiteitId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Accepts or rejects one proposed goal link. An accepted goal that is not yet a subdoel of the subthema is proposed as
    /// one (D4).
    /// </summary>
    Task BeslisAsync(Guid activiteitId, Guid koppelingId, KoppelingStatus status, CancellationToken cancellationToken = default);
}

/// <summary>Body of a decision on a proposed goal link: <c>Aanvaard</c> or <c>Geweigerd</c>.</summary>
public sealed record DoelvoorstelBeslissing(KoppelingStatus Status);

/// <summary>
/// What a run did: how many proposals it stored and how many items of the answer it dropped, or, for an unreadable
/// answer, an English operator diagnostic and no change.
/// </summary>
public sealed record ActiviteitDoelsuggestieResultaat(bool IsGeslaagd, int AantalVoorgesteld, int AantalOvergeslagen, string? Fout)
{
    public static ActiviteitDoelsuggestieResultaat Geslaagd(int voorgesteld, int overgeslagen) => new(true, voorgesteld, overgeslagen, null);

    public static ActiviteitDoelsuggestieResultaat Mislukt(string fout) => new(false, 0, 0, fout);
}
