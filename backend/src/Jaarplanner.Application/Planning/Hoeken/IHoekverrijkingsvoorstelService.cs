namespace Jaarplanner.Application.Planning.Hoeken;

/// <summary>
/// The AI proposes a verrijking for one hoek while one subthema runs, and the klas decides it (FB-028, ADR-0070).
/// Rights are the Api's: all three are <c>KlasplanningBewerken</c> on the klas in the route; this service checks that
/// the hoek and the proposal belong to that klas.
/// </summary>
public interface IHoekverrijkingsvoorstelService
{
    /// <summary>Every open proposal for a hoek of the klas, oldest first.</summary>
    /// <exception cref="Schoolcontent.Beheer.SchoolcontentNietGevondenFout">No such klas.</exception>
    Task<IReadOnlyList<HoekverrijkingsvoorstelWeergave>> HaalOpAsync(Guid klasId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Asks the AI for a verrijking of <paramref name="hoekId"/> while <paramref name="subthemaId"/> runs. It replaces the
    /// open proposal for that pair; it never touches the corner's verrijking. An unreadable answer stores nothing and
    /// changes nothing (Art. IV.5); an answer that repeats the current or a rejected text keeps nothing either.
    /// </summary>
    /// <exception cref="Schoolcontent.Beheer.SchoolcontentNietGevondenFout">No such klas, hoek or subthema.</exception>
    /// <exception cref="Schoolcontent.Beheer.SchoolcontentValidatieFout">
    /// The hoek is of another klas, or the subthema is for an age the klas does not teach.
    /// </exception>
    /// <exception cref="Ai.PromptTeGrootFout">The request is over the prompt ceiling (TB-007).</exception>
    Task<HoekverrijkingsvoorstelResultaat> StelVoorAsync(
        Guid klasId,
        Guid hoekId,
        Guid subthemaId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Accepts, possibly changed, or rejects a proposal. Accepting writes the text as the corner's verrijking for the
    /// window the beslissing names, through <see cref="IHoekverrijkingService.BewaarAsync"/>, replacing what it held.
    /// Rejecting changes no verrijking.
    /// </summary>
    /// <exception cref="Schoolcontent.Beheer.SchoolcontentNietGevondenFout">No such proposal in this klas, or no such window.</exception>
    /// <exception cref="Schoolcontent.Beheer.SchoolcontentValidatieFout">
    /// Already decided, the decision is not valid, or the window is of another subthema.
    /// </exception>
    Task<HoekverrijkingsvoorstelBesluit> BeslisAsync(
        Guid klasId,
        Guid voorstelId,
        HoekverrijkingsvoorstelBeslissing beslissing,
        CancellationToken cancellationToken = default);
}

/// <summary>One open proposal.</summary>
public sealed record HoekverrijkingsvoorstelWeergave(Guid Id, Guid HoekId, Guid SubthemaId, string Tekst, string AiMotivatie);

/// <summary>
/// Body of a decision. <c>Geweigerd</c> ignores the rest. <c>Aanvaard</c> needs the window, as a save of a verrijking
/// does: the stored <see cref="SubthemaperiodeId"/>, or, for a subthema the agenda drew from its activiteiten alone,
/// <see cref="Van"/> and <see cref="Tot"/>. <see cref="Tekst"/> is the edited text, or <c>null</c> for the proposal as it is.
/// </summary>
public sealed record HoekverrijkingsvoorstelBeslissing(
    Domain.Schoolcontent.KoppelingStatus Status,
    string? Tekst = null,
    Guid? SubthemaperiodeId = null,
    DateOnly? Van = null,
    DateOnly? Tot = null);

/// <summary>What a decision did: the status stored, and for an acceptance the window's verrijkingen as they now stand.</summary>
public sealed record HoekverrijkingsvoorstelBesluit(
    Domain.Schoolcontent.KoppelingStatus Status,
    SubthemaperiodeVerrijkingen? Periode);

/// <summary>
/// What a request did: the proposal it stored, none (the model found nothing new to say), or, for an unreadable
/// answer, an English operator diagnostic and no change.
/// </summary>
public sealed record HoekverrijkingsvoorstelResultaat(bool IsGeslaagd, HoekverrijkingsvoorstelWeergave? Voorstel, string? Fout)
{
    public static HoekverrijkingsvoorstelResultaat Geslaagd(HoekverrijkingsvoorstelWeergave? voorstel) => new(true, voorstel, null);

    public static HoekverrijkingsvoorstelResultaat Mislukt(string fout) => new(false, null, fout);
}
