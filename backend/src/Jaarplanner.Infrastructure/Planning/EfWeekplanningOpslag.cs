using Jaarplanner.Application.Planning.Weekplanning;
using Jaarplanner.Domain.Planning;
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
    /// </summary>
    private IQueryable<Activiteitinhoud> Bevraag(
        System.Linq.Expressions.Expression<Func<Domain.Schoolcontent.Activiteit, bool>> filter) =>
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
            activiteit.Doelkoppelingen.Select(k => k.LeerplandoelCode).ToList());
}
