using Jaarplanner.Application.Planning.Generatie;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.Infrastructure.Planning;

/// <summary>
/// EF Core implementation of <see cref="IJaarplanOpslag"/> over <see cref="AppDbContext"/> (E3-01), the planning
/// sibling of <c>EfDoelMatchOpslag</c>. It keeps EF Core out of <see cref="JaarplanGeneratieService"/> so the
/// generation flow stays testable against a fake with no database (Art. IV.6, Art. VIII).
/// </summary>
public sealed class EfJaarplanOpslag : IJaarplanOpslag
{
    private readonly AppDbContext _context;

    public EfJaarplanOpslag(AppDbContext context) => _context = context;

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

        // The closures come with the school year (owned collection) and are the input the grid is derived from —
        // loading the year without them would silently yield a grid with no vacation breaks at all.
        var schooljaar = await _context.Schooljaren
            .FirstOrDefaultAsync(s => s.Id == klas.SchooljaarId, cancellationToken);

        // Unreachable while the FK holds; a null here would mean the containment was violated in the database.
        return schooljaar is null ? null : (klas, schooljaar);
    }

    /// <inheritdoc />
    /// <remarks>
    /// Tracked (no <c>AsNoTracking</c>) so placements added/changed by the service persist on
    /// <see cref="BewaarAsync"/>. The owned placement collection loads with its owner.
    /// </remarks>
    public Task<Jaarplan?> LaadJaarplanAsync(Guid klasId, CancellationToken cancellationToken = default) =>
        _context.Jaarplannen.FirstOrDefaultAsync(j => j.KlasId == klasId, cancellationToken);

    /// <inheritdoc />
    public void VoegJaarplanToe(Jaarplan jaarplan)
    {
        ArgumentNullException.ThrowIfNull(jaarplan);
        _context.Jaarplannen.Add(jaarplan);
    }

    /// <inheritdoc />
    /// <remarks>
    /// Tracked, so a <c>Vervang</c> on the loaded aggregate persists on <see cref="BewaarAsync"/>. Both owned
    /// collections load with their owner. The school year is part of the predicate rather than an assertion afterwards:
    /// a row written for another year must not be read at all, since every value in it is a date.
    /// </remarks>
    public Task<Generatieparameters?> LaadGeneratieparametersAsync(
        Guid klasId,
        Guid schooljaarId,
        CancellationToken cancellationToken = default) =>
        _context.Generatieparameters
            .FirstOrDefaultAsync(p => p.KlasId == klasId && p.SchooljaarId == schooljaarId, cancellationToken);

    /// <inheritdoc />
    /// <remarks>
    /// The unique index on <c>(KlasId, SchooljaarId)</c> is the arbiter, not a pre-check: the service's load-or-create
    /// cannot cover two simultaneous POSTs, and before this the loser got a raw <c>23505</c> surfacing as a 500 with an
    /// English detail. The same shape <c>SchooljaarBeheerService</c> catches for a duplicate school-year name.
    /// </remarks>
    public async Task<bool> ProbeerGeneratieparametersToeTeVoegenAsync(
        Generatieparameters parameters,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(parameters);

        _context.Generatieparameters.Add(parameters);

        try
        {
            await _context.SaveChangesAsync(cancellationToken);

            return true;
        }
        catch (DbUpdateException ex) when (IsUniekeSleutelSchending(ex))
        {
            // Detach the losing insert AND its owned rows, so the caller's reload runs on a usable context. Listed
            // explicitly rather than relying on a detach cascading from the owner: an owned entry left in `Added` would
            // be retried on the next SaveChanges, against a parent row that was never written.
            var mislukt = _context.ChangeTracker.Entries()
                .Where(entry => entry.State == EntityState.Added)
                .Where(entry => entry.Entity is Generatieparameters or BewaardStartthema or BewaardVastMoment)
                .ToList();

            foreach (var entry in mislukt)
            {
                entry.State = EntityState.Detached;
            }

            return false;
        }
    }

    /// <summary>The settings row's own table, the only one whose <c>23505</c> is the race this port recovers from.</summary>
    private const string ParametersTabel = "generatieparameters";

    /// <summary>
    /// True for a unique-key violation on the kept settings row itself — the concurrent-insert race.
    /// <para>
    /// <b>Scoped by the table, matched exactly.</b> The first version tested
    /// <c>ConstraintName.Contains("generatieparameters")</c>, which also matches
    /// <c>IX_startthemavoorkeuren_GeneratieparametersId_BlokStart</c> and
    /// <c>IX_vastemomenten_GeneratieparametersId_Datum</c> — two other tables, because their FK column is
    /// <c>GeneratieparametersId</c>. A violation on either would have been reported as the lost race, the caller's
    /// reload would have found no row, and the request would have 500'd blaming a duplicate settings row that never
    /// existed. It was unreachable (<c>Generatieparameters.Vervang</c> refuses a duplicate <c>BlokStart</c> before any
    /// insert can be attempted), but the comment claimed a scoping the substring did not give.
    /// </para>
    /// <para>
    /// The table rather than the index name on purpose: a <c>23505</c> on this table can only be the
    /// <c>(KlasId, SchooljaarId)</c> index or the primary key, and the key is a client-generated <c>Guid</c>. Naming the
    /// index would tie the recovery to an EF-generated identifier that a rename would silently break, and the failure
    /// mode of that would be the 500 this method exists to prevent.
    /// </para>
    /// </summary>
    private static bool IsUniekeSleutelSchending(DbUpdateException ex) =>
        ex.InnerException is Npgsql.PostgresException { SqlState: "23505" } pg &&
        string.Equals(pg.TableName, ParametersTabel, StringComparison.Ordinal);

    /// <inheritdoc />
    /// <remarks>
    /// Themadoelen + doelsuggesties are needed to describe a thema's goals in the prompt and the read view (only
    /// <c>aanvaard</c>/<c>manueel</c> count — Art. V.1). Subthema's are deliberately not loaded: E3-01 places thema's
    /// on the coarse tier, and pulling the whole class/age subtree would be a large read for no consumer.
    /// </remarks>
    public async Task<IReadOnlyList<Thema>> LaadThemasAsync(CancellationToken cancellationToken = default) =>
        await _context.Themas
            .Include(t => t.Themadoelen)
            .Include(t => t.Doelsuggesties)
            .OrderBy(t => t.Naam)
            .ToListAsync(cancellationToken);

    /// <inheritdoc />
    public Task BewaarAsync(CancellationToken cancellationToken = default) =>
        _context.SaveChangesAsync(cancellationToken);
}
