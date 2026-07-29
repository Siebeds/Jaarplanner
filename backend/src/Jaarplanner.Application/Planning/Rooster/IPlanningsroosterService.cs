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
/// <param name="AantalOpenDagen">
/// Days in the block on which the school is <b>open</b>: inside the year and covered by <b>no</b> closure
/// (<see cref="Schooljaar.IsLesdag"/>). So a <see cref="Sluitingssoort.VrijeDag"/> inside the block is
/// excluded here even though it does not split the block — which is the point.
/// <para>
/// <b>The calendar sizes blocks on this, not on the calendar-day span.</b> The wireframe's central claim is
/// that block width is proportional to teaching time, so a period containing Hemelvaart plus a brugdag must
/// render visibly narrower than an unbroken period of the same calendar length — otherwise the ribbon states
/// something untrue about how much teaching fits in it.
/// </para>
/// <para>
/// <b>Called "open dagen" and not "lesdagen" on purpose: this counts weekends.</b> The domain's
/// <c>IsLesdag</c> excludes only closures — nothing in the codebase models weekends at all (no
/// <c>DayOfWeek</c> anywhere in <c>backend/src</c>) — so a Sunday satisfies it. Whether <c>IsLesdag</c>
/// should exclude weekends is a <b>domain</b> question, deliberately left open for the teachers rather than
/// answered by a second, weekend-aware definition living in this mapper: that drift is what this project
/// keeps paying for. What is <i>not</i> deferred is the name. An earlier revision called this field
/// <c>AantalLesdagen</c> and explained the discrepancy in this comment — but a comment does not travel with
/// the JSON, and the TypeScript mirror had already re-glossed it as "days the school is open", giving one
/// field two meanings in a single commit. Naming it for what it counts costs nothing and removes the lie
/// from the wire contract; the open question survives intact.
/// </para>
/// <para>
/// Dividing by 7 therefore yields the calendar-week figure the approved wireframe itself uses ("4,4 weken"
/// for 1 sep – 1 okt = 31/7). Proportional width is barely affected, because weekends fall near-uniformly
/// across blocks — but a block containing vrije dagen renders a slightly weaker narrowing than teaching-day
/// counting would give, which is part of what the teachers are being asked about.
/// </para>
/// </param>
public sealed record PlanningsblokWeergave(
    int Ordinaal,
    DateOnly Start,
    DateOnly Eind,
    int? OuderOrdinaal,
    int AantalOpenDagen);

/// <summary>One vacation, rendered as a gap in the ribbon.</summary>
/// <param name="Naam">The school's own Dutch name for it ("Herfstvakantie") — shown in the gap.</param>
/// <param name="Start">First day of the closure.</param>
/// <param name="Eind">Last day of the closure, inclusive.</param>
public sealed record PlanningsonderbrekingWeergave(string Naam, DateOnly Start, DateOnly Eind);
