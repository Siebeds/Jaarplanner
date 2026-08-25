using Jaarplanner.Domain.Planning;

using Jaarplanner.Domain.Schoolcontent;

namespace Jaarplanner.Application.Planning.Weekplanning;

/// <summary>
/// The persistence seam for the day-level planning flow (Art. VIII layering), the sibling of
/// <c>IJaarplanOpslag</c>. <see cref="WeekplanningService"/> depends only on this abstraction — not on EF Core — so
/// the whole flow runs against an in-memory fake with <b>no database</b> in unit tests (Art. IV.6).
/// <para>
/// <b>Deliberately a second seam rather than four more methods on <c>IJaarplanOpslag</c>.</b> That interface
/// documents itself as the generation flow's seam and every method on it serves deriving blocks, building a prompt and
/// persisting proposals. Day-level scheduling shares its aggregate and none of its purpose, and a fake for one flow
/// that has to implement the other's methods is how a test ends up asserting against a stub it never exercises.
/// </para>
/// </summary>
public interface IWeekplanningOpslag
{
    /// <summary>
    /// Loads a class with the <see cref="Schooljaar"/> containing it — both are needed, because the class says whose
    /// plan this is and the school year holds the closures that decide which days can take anything. Returns
    /// <c>null</c> when there is no such class.
    /// </summary>
    Task<(Klas Klas, Schooljaar Schooljaar)?> LaadKlasMetSchooljaarAsync(
        Guid klasId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Loads the class's <see cref="Jaarplan"/> with <b>both</b> its placement collections, tracked so mutations
    /// persist on <see cref="BewaarAsync"/>. Returns <c>null</c> when the class has no plan yet.
    /// <para>
    /// <b>Both collections, and the "both" is load-bearing.</b> The thema placements are what
    /// <c>ValtBuitenThemaperiode</c> is computed against, and they are an EF <i>owned</i> collection (loaded
    /// automatically) while the activiteit placements are a regular navigation (loaded only if the implementation says
    /// so). An implementation that forgot the <c>Include</c> would return a plan whose days all look empty — and every
    /// test using the fake would still pass, which is the failure mode E5-01 recorded for a missing navigation.
    /// </para>
    /// </summary>
    Task<Jaarplan?> LaadJaarplanAsync(Guid klasId, CancellationToken cancellationToken = default);

    /// <summary>Registers a freshly created plan for persistence (the lazy "one Jaarplan per Klas" creation).</summary>
    void VoegJaarplanToe(Jaarplan jaarplan);

    /// <summary>
    /// Resolves one activiteit to the content tree above it — subthema, thema, the owning klas and its goal links.
    /// Returns <c>null</c> when there is no such activiteit.
    /// <para>
    /// The <see cref="Activiteitinhoud.KlasId"/> it carries is what makes the class-boundary check possible at all: an
    /// <c>Activiteit</c> row knows only its subthema, and the klas lives one level up (Art. IX.2).
    /// </para>
    /// </summary>
    Task<Activiteitinhoud?> LaadActiviteitinhoudAsync(
        Guid activiteitId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// The same resolution for many activiteiten at once — what the week view needs, so rendering a fortnight is one
    /// query rather than one per scheduled activiteit. Ids with no matching activiteit are simply absent from the
    /// result; the caller decides what a missing one means.
    /// </summary>
    Task<IReadOnlyList<Activiteitinhoud>> LaadActiviteitinhoudAsync(
        IReadOnlyCollection<Guid> activiteitIds,
        CancellationToken cancellationToken = default);

    /// <summary>Persists the pending changes as a single unit of work.</summary>
    /// <summary>
    /// The naming tree of the given subthema's, for labelling a marked-off window.
    /// <para>
    /// <b>Not derivable from <see cref="Activiteitinhoud"/>, and that is the point of the whole feature.</b> A window
    /// may exist for a subthema with no activiteiten at all, so there is nothing to read its name off; the caller has
    /// to be able to ask about a subthema directly.
    /// </para>
    /// </summary>
    /// <param name="subthemaIds">The subthema's to resolve. An empty collection returns empty without a round trip.</param>
    /// <param name="cancellationToken">Cancellation.</param>
    Task<IReadOnlyList<Subthemainhoud>> LaadSubthemainhoudAsync(
        IReadOnlyCollection<Guid> subthemaIds,
        CancellationToken cancellationToken = default);

    Task BewaarAsync(CancellationToken cancellationToken = default);
}

/// <summary>
/// One activiteit with the content tree above it, flattened — the shape the week view and the class-boundary check both
/// need.
/// </summary>
/// <param name="ActiviteitId">The activiteit.</param>
/// <param name="Naam">Its name.</param>
/// <param name="ActiviteitType">Its type, already serialised to the enum's name.</param>
/// <param name="SubthemaId">The subthema it realises.</param>
/// <param name="SubthemaNaam">The subthema's name.</param>
/// <param name="KlasId">
/// The klas that owns the subthema, and therefore the activiteit (Art. IX.2, where class scoping is structural).
/// </param>
/// <param name="Leeftijd">The subthema's age scope. Carried for the picker E9-07 narrows; unused by this service.</param>
/// <param name="ThemaId">The thema the subthema belongs to.</param>
/// <param name="ThemaNaam">The thema's name.</param>
/// <param name="Doelcodes">
/// The leerplandoel codes the activiteit carries through its own <b>accepted or manual</b> links.
/// <para>
/// <b>Two bounds, and reading only the first one is what went wrong.</b> <i>Display only</i> — coverage runs through
/// the thema's placement, never through this (Art. V.1). And <i>decided links only</i>: a <c>Voorgesteld</c> link is
/// an AI suggestion nobody has answered and a <c>Geweigerd</c> one is a doel the teacher rejected, so neither may be
/// presented as a doel this activiteit works toward (Art. IV.1/IV.2). The first version filtered on nothing; no route
/// produces those statuses on an activiteit link yet, so the widening was latent rather than visible.
/// </para>
/// <para>
/// <b>No order is promised here</b>, deliberately. The EF implementation does sort by code, but nothing verifies it and
/// the sort is collation-dependent, so promising it on the interface would bind every implementer to something the
/// suite cannot check. See <c>EfWeekplanningOpslag.Bevraag</c> for the reasoning and the failed attempts to pin it.
/// </para>
/// </param>
public sealed record Activiteitinhoud(
    Guid ActiviteitId,
    string Naam,
    string ActiviteitType,
    Guid SubthemaId,
    string SubthemaNaam,
    Guid KlasId,
    string Leeftijd,
    Guid ThemaId,
    string ThemaNaam,
    IReadOnlyList<string> Doelcodes,
    /// <summary>The teacher's colour label, or null. A label they chose, never a signal the app reads.</summary>
    Activiteitkleur? Kleur = null,
    /// <summary>How many consecutive lesuren the activiteit takes. One unless the teacher said otherwise.</summary>
    int LengteInLesuren = 1);

/// <summary>
/// A subthema's identity and the names above it, for a screen that has to label a period it holds no content for.
/// </summary>
/// <param name="SubthemaId">The subthema.</param>
/// <param name="SubthemaNaam">Its name.</param>
/// <param name="ThemaId">The owning thema.</param>
/// <param name="ThemaNaam">Its name.</param>
/// <param name="KlasId">
/// The class it belongs to. A subthema inherits its thema's klas (Art. IX.2), and the write path compares it against
/// the plan's before marking off days.
/// </param>
public sealed record Subthemainhoud(
    Guid SubthemaId,
    string SubthemaNaam,
    Guid ThemaId,
    string ThemaNaam,
    Guid KlasId);
