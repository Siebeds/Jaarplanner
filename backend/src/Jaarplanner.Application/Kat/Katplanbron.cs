using Jaarplanner.Domain.Planning;

namespace Jaarplanner.Application.Kat;

/// <summary>
/// A thema that carries a minimumdoel as a themadoel, and how long it runs (FB-069, ADR-0059 D4).
/// </summary>
/// <param name="MinimumdoelRef">The minimumdoel it carries.</param>
/// <param name="ThemaId">The thema.</param>
/// <param name="ThemaNaam">Its name, for the message.</param>
/// <param name="DuurWeken">Its own length in lesweken: how much room placing it would need.</param>
public sealed record Themadrager(string MinimumdoelRef, Guid ThemaId, string ThemaNaam, int DuurWeken);

/// <summary>
/// A subthema as the cat judges it for one klas (FB-069).
/// </summary>
/// <param name="SubthemaId">The subthema.</param>
/// <param name="ThemaId">The thema it belongs to.</param>
/// <param name="Naam">Its name, for the message.</param>
/// <param name="Leeftijd">The jaar/fase it is written for.</param>
/// <param name="IsGepland">Whether this klas has it in the agenda: a subthemaplaatsing exists in its jaarplan.</param>
/// <param name="Leerplandoelcodes">
/// The codes its decided subdoelen aim at (<c>aanvaard</c> or <c>manueel</c> only), which is what it would cover.
/// </param>
public sealed record Katsubthema(
    Guid SubthemaId,
    Guid ThemaId,
    string Naam,
    string Leeftijd,
    bool IsGepland,
    IReadOnlyList<string> Leerplandoelcodes);

/// <summary>
/// What the cat's dekking detectors read beyond the dekking itself (FB-069). A port of its own rather than more
/// methods on <c>IDekkingOpslag</c>: the dekking's port serves the highest-risk logic in the system (Art. V.6) and
/// nothing the cat needs should widen it. Implemented over EF in <c>Infrastructure/Kat</c>, beside the other two.
/// </summary>
public interface IKatplanbron
{
    /// <summary>
    /// Every (minimumdoel, thema) themadoel link in the school, with the thema's length. School-wide, because a
    /// thema is school-wide (Art. IX.2) and one round judges every klas against the same set.
    /// </summary>
    Task<IReadOnlyList<Themadrager>> HaalThemadragersAsync(CancellationToken ct);

    /// <summary>
    /// Every subthema in the school, with whether <paramref name="klasId"/> has it in the agenda. The klas decides
    /// only <see cref="Katsubthema.IsGepland"/>; the subthema's themselves are shared content.
    /// </summary>
    Task<IReadOnlyList<Katsubthema>> HaalSubthemasAsync(Guid klasId, CancellationToken ct);

    /// <summary>
    /// The klas's schooljaar, with its closures, so a detector can build a <see cref="Themakalender"/> and count
    /// schooldagen the way the rest of the app counts them. <c>null</c> when the klas is gone.
    /// </summary>
    Task<Schooljaar?> HaalSchooljaarAsync(Guid klasId, CancellationToken ct);
}
