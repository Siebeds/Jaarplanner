using Jaarplanner.Application.Planning.Weekplanning;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.Infrastructure.Planning;

/// <summary>
/// EF Core implementation of <see cref="IWeekplanningOpslag"/> over <see cref="AppDbContext"/> (E9-03), the day-level
/// sibling of <see cref="EfJaarplanOpslag"/>. It keeps EF Core out of <see cref="WeekplanningService"/> so the flow
/// stays testable against a fake with no database (Art. IV.6, Art. VIII).
/// </summary>
public sealed class EfWeekplanningOpslag : IWeekplanningOpslag
{
    private readonly AppDbContext _context;

    public EfWeekplanningOpslag(AppDbContext context) => _context = context;

    /// <inheritdoc />
    public async Task<(Klas Klas, Schooljaar Schooljaar)?> LaadKlasMetSchooljaarAsync(
        Guid klasId,
        CancellationToken cancellationToken = default)
    {
        var klas = await _context.Klassen.FirstOrDefaultAsync(k => k.Id == klasId, cancellationToken);
        if (klas is null)
        {
            return null;
        }

        // The closures come with the school year (owned collection) and are what decides which days can take anything.
        // Loading the year without them would yield a calendar in which no day is ever closed.
        var schooljaar = await _context.Schooljaren
            .FirstOrDefaultAsync(s => s.Id == klas.SchooljaarId, cancellationToken);

        // Unreachable while the FK holds; a null here would mean the containment was violated in the database.
        return schooljaar is null ? null : (klas, schooljaar);
    }

    /// <inheritdoc />
    /// <remarks>
    /// Tracked (no <c>AsNoTracking</c>) so placements added or moved by the service persist on
    /// <see cref="BewaarAsync"/>.
    /// <para>
    /// <b>The <c>Include</c> is not optional and is the one thing in this class that can silently break the feature.</b>
    /// The thema placements are an EF <i>owned</i> collection and load with their owner; the activiteit placements are a
    /// regular navigation and do not. Without this line every day in the week view renders empty, every mutation
    /// silently re-adds a placement that already exists, and <b>no test using the fake would notice</b> — which is
    /// exactly the missing-navigation failure E5-01's audit recorded. Pinned by a Postgres integration test that plans
    /// a day, re-reads it and asserts the activiteit is there.
    /// </para>
    /// </remarks>
    public Task<Jaarplan?> LaadJaarplanAsync(Guid klasId, CancellationToken cancellationToken = default) =>
        _context.Jaarplannen
            .Include("_activiteitplaatsingen")
            // The subthema windows, for exactly the same reason and with exactly the same failure mode. Added
            // 2026-08-25 AFTER shipping the feature without it: the endpoint stored a window, the database held it,
            // every unit test passed against the fake, and the calendar drew nothing because this collection came back
            // empty. The paragraph above had already written down that this line is the one thing that can silently
            // break the feature, and the next navigation broke it anyway, so it is worth stating plainly: adding a
            // collection to this aggregate means adding it here.
            .Include("_subthemaplaatsingen")
            // Two collection navigations in one statement is a cartesian product, because the owned `_plaatsingen`
            // already load with the owner. Split here as well as in `KlasBeheerService` rather than only there: this is
            // the hotter of the two paths (every week read against a delete), and fixing the cold one alone is the
            // shape of defect this file's own audit record keeps finding.
            .AsSplitQuery()
            .FirstOrDefaultAsync(j => j.KlasId == klasId, cancellationToken);

    /// <inheritdoc />
    public void VoegJaarplanToe(Jaarplan jaarplan)
    {
        ArgumentNullException.ThrowIfNull(jaarplan);
        _context.Jaarplannen.Add(jaarplan);
    }

    /// <inheritdoc />
    public async Task<Activiteitinhoud?> LaadActiviteitinhoudAsync(
        Guid activiteitId,
        CancellationToken cancellationToken = default)
    {
        var inhoud = await Bevraag(a => a.Id == activiteitId).FirstOrDefaultAsync(cancellationToken);

        return inhoud;
    }

    /// <inheritdoc />
    public async Task<IReadOnlyList<Activiteitinhoud>> LaadActiviteitinhoudAsync(
        IReadOnlyCollection<Guid> activiteitIds,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(activiteitIds);

        // Short-circuited rather than sent as `WHERE id IN ()`, which Npgsql renders as a always-false predicate but
        // still costs a round trip. An empty week is the common case on a fresh plan.
        if (activiteitIds.Count == 0)
        {
            return [];
        }

        return await Bevraag(a => activiteitIds.Contains(a.Id)).ToListAsync(cancellationToken);
    }

    /// <inheritdoc />
    public async Task<IReadOnlyList<Subthemainhoud>> LaadSubthemainhoudAsync(
        IReadOnlyCollection<Guid> subthemaIds,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(subthemaIds);

        // Short-circuited for the same reason as the activiteit overload: `WHERE id IN ()` still costs a round trip,
        // and a plan with no marked-off windows is the common case.
        if (subthemaIds.Count == 0)
        {
            return [];
        }

        return await _context.Subthemas
            .AsNoTracking()
            .Where(sub => subthemaIds.Contains(sub.Id))
            .Join(
                _context.Themas.AsNoTracking(),
                sub => sub.ThemaId,
                thema => thema.Id,
                (sub, thema) => new Subthemainhoud(sub.Id, sub.Naam, thema.Id, thema.Naam, sub.KlasId))
            .ToListAsync(cancellationToken);
    }

    /// <inheritdoc />
    public Task BewaarAsync(CancellationToken cancellationToken = default) =>
        _context.SaveChangesAsync(cancellationToken);

    /// <summary>
    /// The one projection both overloads share, so a single-activiteit load and a whole-week load can never disagree
    /// about what an activiteit's content tree is.
    /// <para>
    /// <b>Joined explicitly rather than through navigations, because there are none to use.</b> An
    /// <c>Activiteit</c> holds a <c>SubthemaId</c> and a <c>Subthema</c> holds a <c>ThemaId</c>; neither carries a
    /// reference property, so the klas — which lives on the subthema (Art. IX.2) — is only reachable by joining. That
    /// klas is what the class-boundary check needs, so this join is load-bearing rather than convenience.
    /// </para>
    /// <para>
    /// Projected in SQL (no <c>Include</c> of the goal links) so a week's worth of cards is one query. The
    /// <c>Doelcodes</c> subquery reads the activiteit's own owned links only, which is the display set — <b>not</b> a
    /// coverage computation, and it must never be used as one (Art. V.1; see <c>Activiteitplaatsing</c>).
    /// </para>
    /// <para>
    /// <b>Filtered to <c>Aanvaard</c>/<c>Manueel</c>, which it was not</b> (found by the 2026-08-20 audit). The
    /// <b>same</b> predicate as every other place in this codebase that treats a link as real:
    /// <c>JaarplanGeneratiePromptBuilder.ThemaDoelcodes</c> (the kalender card's own display set, documented as
    /// "themadoelen + accepted/manual links"), <c>EfDekkingOpslag</c>'s four layers and
    /// <c>OngekoppeldeDoelenQuery</c>. "Display only" was never a licence to widen the set: it bounds what the codes
    /// may be <i>counted into</i>, not which links exist.
    /// </para>
    /// <para>
    /// <b>The defect was latent, and saying so is the point.</b> No route reaches those statuses on an
    /// <i>activiteit</i> link today: the only creation site is
    /// <c>SchoolcontentBeheerService.KoppelActiviteitAanDoelAsync</c>, hard-coded <c>Manueel</c>;
    /// <c>ActiviteitenController</c> offers POST and DELETE and no status route; and
    /// <c>DoelMatchingService</c> resolves a suggestion out of <c>Thema.Doelsuggesties</c> only. Nor does any component
    /// read this field yet. So nothing was ever mis-shown to a teacher — the predicate is fixed <b>before</b> E8's
    /// activiteit-level matching makes those statuses reachable.
    /// <i>An earlier version of this paragraph said a rejected link "arrived on the day card" and told a teacher their
    /// rejection did nothing. That dressed a contract fix as a repaired harm, which is the same class of overclaim the
    /// rest of this commit removes.</i>
    /// </para>
    /// <para>
    /// <b>When E8 lands, widen the <i>shape</i> and not this predicate.</b> These are bare codes with no per-code
    /// status, so an AI suggestion at activiteit level needs code+status pairs on the contract; loosening the filter
    /// instead would put unanswered suggestions on the card as fact (Art. IV.1).
    /// </para>
    /// <para>
    /// Ordered in SQL so two reads of one week can never present the same activiteit's doelen in two orders. Without an
    /// <c>ORDER BY</c> the row order is simply <b>unspecified</b> — that is the whole of the justification, and no more
    /// than it.
    /// <para>
    /// <b>Unpinnable by a test, and recorded rather than papered over:</b> two mutation attempts on 2026-08-20 both left
    /// the assertion green, because the unordered read happened to come back sorted by code. An assertion that flips per
    /// run is worse than none, so the claim was deleted instead of the guard weakened. <b>This line is guarded by nothing
    /// but this sentence, and so is the ordering note on <c>Activiteitinhoud.Doelcodes</c>.</b> Do not delete either on
    /// the strength of a green suite.
    /// </para>
    /// <para>
    /// *A first version of this paragraph blamed <c>DoelKoppeling.Id</c> being a fresh <c>Guid</c>. That was a cause
    /// invented to fit the observation: unordered is unordered whatever the key, and the sorted output is better
    /// explained by a scan of <c>DoelKoppelingMapping</c>'s own index on <c>leerplandoel_code</c>. Left as a note
    /// because reaching for a mechanism when "unspecified" is the honest answer is the same move as the overclaim this
    /// commit removes elsewhere.*
    /// </para>
    /// <para>
    /// <b>It sorts in the database collation</b>, whereas the sibling it matches on the <i>predicate</i>
    /// (<c>JaarplanGeneratiePromptBuilder.ThemaDoelcodes</c>) sorts <c>StringComparer.Ordinal</c>. For today's codes the
    /// two agree; for codes differing in case or punctuation they need not. The parity claim below is about the filter
    /// and not about the order.
    /// </para>
    /// <para>
    /// No <c>Distinct</c>, deliberately: the sibling needs one because it concatenates two sources, this reads a single
    /// activiteit's own links, and a duplicate code on one activiteit would be a data defect to surface rather than to
    /// hide behind a projection.
    /// </para>
    /// </para>
    /// </summary>
    private IQueryable<Activiteitinhoud> Bevraag(
        System.Linq.Expressions.Expression<Func<Activiteit, bool>> filter) =>
        from activiteit in _context.Activiteiten.Where(filter)
        join subthema in _context.Subthemas on activiteit.SubthemaId equals subthema.Id
        join thema in _context.Themas on subthema.ThemaId equals thema.Id
        select new Activiteitinhoud(
            activiteit.Id,
            activiteit.Naam,
            activiteit.ActiviteitType.ToString(),
            subthema.Id,
            subthema.Naam,
            subthema.KlasId,
            subthema.Leeftijd,
            thema.Id,
            thema.Naam,
            activiteit.Doelkoppelingen
                .Where(k => k.Status == KoppelingStatus.Aanvaard || k.Status == KoppelingStatus.Manueel)
                .OrderBy(k => k.LeerplandoelCode)
                .Select(k => k.LeerplandoelCode)
                .ToList(),
            activiteit.Kleur,
            activiteit.LengteInLesuren);
}
