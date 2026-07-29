using Jaarplanner.Domain.Planning;

namespace Jaarplanner.Application.Planning.Rooster;

/// <summary>
/// Reads a school year's <b>derived planning grid</b> — the blocks plus the vacations that separate them
/// (Art. IX.3, ADR-0013, ADR-0020).
/// <para>
/// <b>Why this exists as its own read path (E3-06).</b> The calendar has to render the grid itself, not just
/// the thema's placed on it: an <i>empty</i> period must still appear, or a teacher cannot see where there is
/// room, and E3-09's "goals placed nowhere" has no ribbon to sit beside.
/// <see cref="Generatie.JaarplanWeergave"/> returns only placements, so it cannot answer "what does the year
/// look like". Deriving the grid in the browser instead was rejected outright: the grain lives in
/// configuration behind <see cref="IPlanningsblokIndeling"/> (ADR-0013), and a second implementation in
/// TypeScript would be a copy that silently disagrees with the server the first time the configuration
/// changes.
/// </para>
/// <para>
/// <b>Read-only and derived.</b> Nothing here is stored — the blocks are recomputed from the year's span and
/// closures on every call, which is what keeps the granularity a configuration question (Art. XIV).
/// </para>
/// </summary>
public interface IPlanningsroosterService
{
    /// <summary>
    /// The grid for one school year at the given tier. Throws the shared not-found fault when the year does
    /// not exist, so the existing exception handler maps it to a 404 with no new plumbing in the (thin) Api.
    /// </summary>
    Task<PlanningsroosterWeergave> HaalRoosterOpAsync(
        Guid schooljaarId,
        Planningsblokniveau niveau = Planningsblokniveau.Themaperiode,
        CancellationToken cancellationToken = default);
}

/// <summary>
/// A school year's planning grid as the calendar consumes it.
/// </summary>
/// <param name="SchooljaarId">The year the grid was derived from.</param>
/// <param name="SchooljaarNaam">The year label (e.g. "2026-2027").</param>
/// <param name="Start">First school day.</param>
/// <param name="Eind">Last school day, inclusive.</param>
/// <param name="Niveau">The tier these blocks belong to.</param>
/// <param name="Blokindeling">
/// The seam's human-readable description of the configured grain (e.g. "themaperiode 5 wk, subthemaperiode
/// 2 wk"), so the UI can explain <i>why</i> the periods look the way they do rather than leaving a teacher to
/// infer a unit that the model deliberately does not have.
/// </param>
/// <param name="Blokken">The derived blocks, chronological.</param>
/// <param name="Onderbrekingen">
/// Only the closures that <b>break a period</b> (the real vacations), chronological. These are the literal
/// gaps between blocks in the ribbon. A <see cref="Sluitingssoort.VrijeDag"/> is deliberately absent: it sits
/// <i>inside</i> a block and drawing it as a gap would reintroduce exactly the slivers ADR-0020 §5 removed.
/// </param>
public sealed record PlanningsroosterWeergave(
    Guid SchooljaarId,
    string SchooljaarNaam,
    DateOnly Start,
    DateOnly Eind,
    string Niveau,
    string Blokindeling,
    IReadOnlyList<PlanningsblokWeergave> Blokken,
    IReadOnlyList<PlanningsonderbrekingWeergave> Onderbrekingen);

/// <summary>One derived block.</summary>
/// <param name="Ordinaal">1-based display position within the tier ("periode 3"). Display only — never a key.</param>
/// <param name="Start">
/// First day covered. <b>This is the placement key</b> (ADR-0020 §3): a <c>ThemaplaatsingWeergave.BlokStart</c>
/// matching this value is the placement that belongs in this block.
/// </param>
/// <param name="Eind">Last day covered, inclusive.</param>
/// <param name="OuderOrdinaal">For a subthemaperiode, the themaperiode it nests in; null for a themaperiode.</param>
/// <param name="AantalLesdagen">
/// Days in the block for which <see cref="Schooljaar.IsLesdag"/> holds: inside the year and covered by
/// <b>no</b> closure. So a <see cref="Sluitingssoort.VrijeDag"/> inside the block is excluded here even
/// though it does not split the block — which is the point.
/// <para>
/// <b>The calendar sizes blocks on this, not on the calendar-day span.</b> The wireframe's central claim is
/// that block width is proportional to teaching time, so a period containing Hemelvaart plus a brugdag must
/// render visibly narrower than an unbroken period of the same calendar length — otherwise the ribbon states
/// something untrue about how much teaching fits in it.
/// </para>
/// <para>
/// <b>Caveat, stated rather than silently absorbed: this counts weekends.</b> <c>IsLesdag</c> excludes only
/// closures, and nothing in the codebase models weekends at all (no <c>DayOfWeek</c> anywhere in
/// <c>backend/src</c>), so a Sunday counts as a lesdag. The figure is therefore "days the school is not
/// closed", and dividing by 7 yields the calendar-week count the approved wireframe itself uses ("4,4 weken"
/// for 1 sep – 1 okt = 31/7). Proportional width is unaffected, because weekends fall near-uniformly across
/// blocks. It is deliberately <b>not</b> fixed here: a second, weekend-aware definition of "lesdag" living in
/// this mapper while the domain keeps another is precisely the drift this project keeps paying for. Whether
/// <c>IsLesdag</c> should exclude weekends is a domain question — raised as a review item for E3-06, since a
/// teacher reading "5,1 weken" is the person who can say whether that reads as five teaching weeks.
/// </para>
/// </param>
public sealed record PlanningsblokWeergave(
    int Ordinaal,
    DateOnly Start,
    DateOnly Eind,
    int? OuderOrdinaal,
    int AantalLesdagen);

/// <summary>One vacation, rendered as a gap in the ribbon.</summary>
/// <param name="Naam">The school's own Dutch name for it ("Herfstvakantie") — shown in the gap.</param>
/// <param name="Start">First day of the closure.</param>
/// <param name="Eind">Last day of the closure, inclusive.</param>
public sealed record PlanningsonderbrekingWeergave(string Naam, DateOnly Start, DateOnly Eind);
