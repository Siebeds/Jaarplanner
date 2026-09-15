namespace Jaarplanner.Application.Planning.Hoeken;

/// <summary>
/// What each hoek of a class holds while a subthema runs (FB-020, ADR-0041): read per range for the agenda, written
/// per subthemaperiode from the sheet the subthemabalk opens.
/// <para>
/// <b>Keyed on the subthemaperiode, the stored window a teacher marked off for a subthema in her klas's plan.</b> The
/// agenda also draws a subthema that runs only because its activiteiten sit on days, with no window stored. Saving a
/// verrijking there first stores the window as the agenda draws it (owner, 2026-09-15), so every running subthema
/// works the same for her.
/// </para>
/// </summary>
public interface IHoekverrijkingService
{
    /// <summary>
    /// Every stored subthemaperiode of the klas that shares a day with <paramref name="van"/>-<paramref name="tot"/>,
    /// each with the verrijkingen written for it. A window with none written is in the list with an empty one, so a
    /// screen can offer to fill it in.
    /// </summary>
    /// <exception cref="Jaarplanner.Application.Schoolcontent.Beheer.SchoolcontentNietGevondenFout">No such klas.</exception>
    /// <exception cref="Jaarplanner.Application.Schoolcontent.Beheer.SchoolcontentValidatieFout">The range runs backwards.</exception>
    Task<IReadOnlyList<SubthemaperiodeVerrijkingen>> HaalVoorBereikAsync(
        Guid klasId,
        DateOnly van,
        DateOnly tot,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Writes the verrijkingen of one subthemaperiode: a text per hoek, where a blank text removes that hoek's one.
    /// Hoeken not in the request are left as they are, so the hoek detail can save one hoek without resending the rest.
    /// </summary>
    /// <exception cref="Jaarplanner.Application.Schoolcontent.Beheer.SchoolcontentNietGevondenFout">
    /// No such klas, no such window in its plan, or no such hoek.
    /// </exception>
    /// <exception cref="Jaarplanner.Application.Schoolcontent.Beheer.SchoolcontentValidatieFout">
    /// A hoek of another klas, a text over <see cref="MaximaleLengte"/> characters, or neither a window nor a subthema
    /// with its days to store one.
    /// </exception>
    Task<SubthemaperiodeVerrijkingen> BewaarAsync(
        Guid klasId,
        HoekverrijkingenInvoer invoer,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// How many verrijkingen hang on the windows of one subthema, across every klas: what deleting it would take along.
    /// Zero for a subthema that does not exist, which deletes nothing either.
    /// </summary>
    Task<int> TelVoorSubthemaAsync(Guid subthemaId, CancellationToken cancellationToken = default);

    /// <summary>The longest text one verrijking may hold, in characters; the sheet's field stops at the same number.</summary>
    const int MaximaleLengte = 2000;
}

/// <summary>What the sheet saves: which window, and a text per hoek.</summary>
/// <param name="SubthemaperiodeId">
/// The stored window. Null when the agenda drew the subthema from its activiteiten alone; then the three fields below
/// say which window to store first.
/// </param>
/// <param name="SubthemaId">The subthema, when no window is stored yet.</param>
/// <param name="Van">The first day the agenda draws the subthema on, when no window is stored yet.</param>
/// <param name="Tot">The last day, when no window is stored yet.</param>
/// <param name="Verrijkingen">A text per hoek; a blank one removes what that hoek had.</param>
public sealed record HoekverrijkingenInvoer(
    Guid? SubthemaperiodeId,
    Guid? SubthemaId,
    DateOnly? Van,
    DateOnly? Tot,
    IReadOnlyList<HoekverrijkingTekst> Verrijkingen);

/// <summary>What one hoek holds for the window, or blank to remove it.</summary>
public sealed record HoekverrijkingTekst(Guid HoekId, string? Tekst);

/// <summary>One stored subthemaperiode of the klas, with what each hoek holds while it runs.</summary>
/// <param name="SubthemaperiodeId">The window's own id, what a save addresses.</param>
/// <param name="SubthemaId">The subthema that runs in it.</param>
/// <param name="SubthemaNaam">Its name, so a screen can label the window without the plan.</param>
/// <param name="Van">First day, inclusive.</param>
/// <param name="Tot">Last day, inclusive.</param>
/// <param name="Verrijkingen">One per hoek that has one; empty is the ordinary state of a new window.</param>
public sealed record SubthemaperiodeVerrijkingen(
    Guid SubthemaperiodeId,
    Guid SubthemaId,
    string SubthemaNaam,
    DateOnly Van,
    DateOnly Tot,
    IReadOnlyList<HoekverrijkingWeergave> Verrijkingen);

/// <summary>What one hoek holds for one window.</summary>
public sealed record HoekverrijkingWeergave(Guid Id, Guid HoekId, string Tekst);

/// <summary>The body of the answer to "how many verrijkingen would go".</summary>
public sealed record Hoekverrijkingaantal(int Aantal);
