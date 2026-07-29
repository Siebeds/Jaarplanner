using Jaarplanner.Application.Planning.Beheer;
using Jaarplanner.Application.Schoolcontent.Beheer;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.Infrastructure.PlanningBeheer;

/// <summary>
/// EF Core implementation of <see cref="IKlasBeheerService"/> over <see cref="AppDbContext"/>.
/// <para>
/// <b>Name uniqueness is enforced in the database, not just here.</b> The school-content Excel import
/// resolves a class by its <b>name</b>, so two same-named classes would make that resolution arbitrary.
/// The in-memory pre-check below produces the friendly Dutch 400; the unique index added alongside this
/// service is what actually holds under concurrency (two simultaneous POSTs both pass the check, then
/// one <c>SaveChanges</c> loses) — a <see cref="DbUpdateException"/> from that race is translated to the
/// same validation fault rather than surfacing as a 500.
/// </para>
/// </summary>
public sealed class KlasBeheerService : IKlasBeheerService
{
    private readonly AppDbContext _context;

    public KlasBeheerService(AppDbContext context) => _context = context;

    /// <inheritdoc />
    public async Task<IReadOnlyList<KlasWeergave>> HaalKlassenOpAsync(CancellationToken cancellationToken = default)
    {
        // One grouped count instead of N+1: the subthema tallies for every class in a single query.
        var subthemaAantallen = await _context.Subthemas
            .GroupBy(s => s.KlasId)
            .Select(g => new { KlasId = g.Key, Aantal = g.Count() })
            .ToDictionaryAsync(x => x.KlasId, x => x.Aantal, cancellationToken);

        var klassen = await _context.Klassen
            .OrderBy(k => k.Leerjaar)
            .ThenBy(k => k.Naam)
            .ToListAsync(cancellationToken);

        return klassen
            .Select(k => new KlasWeergave(
                k.Id,
                k.SchooljaarId,
                k.Naam,
                k.Leerjaar,
                subthemaAantallen.TryGetValue(k.Id, out var aantal) ? aantal : 0))
            .ToList();
    }

    /// <inheritdoc />
    public async Task<KlasWeergave> HaalKlasOpAsync(Guid klasId, CancellationToken cancellationToken = default)
    {
        var klas = await VindKlasAsync(klasId, cancellationToken);
        var aantal = await _context.Subthemas.CountAsync(s => s.KlasId == klasId, cancellationToken);

        return new KlasWeergave(klas.Id, klas.SchooljaarId, klas.Naam, klas.Leerjaar, aantal);
    }

    /// <inheritdoc />
    public async Task<KlasWeergave> MaakKlasAsync(
        Guid schooljaarId,
        KlasCreatie creatie,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(creatie);

        var naam = VereisNaam(creatie.Naam);
        await VereisVrijeNaamAsync(naam, uitgezonderd: null, cancellationToken);

        // A klas must live in an existing school year (Art. IX.3 containment, E3-01). Checked here so a bad id is
        // a friendly 404 rather than an opaque FK violation, and created THROUGH the schooljaar so the containment
        // is expressed by the aggregate that owns it.
        var schooljaar = await _context.Schooljaren
            .FirstOrDefaultAsync(s => s.Id == schooljaarId, cancellationToken)
            ?? throw new SchoolcontentNietGevondenFout($"Schooljaar {schooljaarId} is niet gevonden.");

        var klas = schooljaar.VoegKlasToe(naam, creatie.Leerjaar);

        // Registered explicitly as Added. Reaching a new entity only through a navigation of an already-tracked
        // principal makes EF apply its "key is set, so it must already exist" heuristic and mark the Klas *Modified*,
        // which then fails with a concurrency error because there is no such row yet. The domain mutator still owns
        // the containment; this line only says "insert it".
        _context.Klassen.Add(klas);
        await BewaarAsync(naam, cancellationToken);

        return new KlasWeergave(klas.Id, klas.SchooljaarId, klas.Naam, klas.Leerjaar, AantalSubthemas: 0);
    }

    /// <inheritdoc />
    public async Task<KlasWeergave> WijzigKlasAsync(Guid klasId, KlasCreatie wijziging, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(wijziging);

        var klas = await VindKlasAsync(klasId, cancellationToken);
        await VereisVrijeNaamAsync(wijziging.Naam, uitgezonderd: klasId, cancellationToken);

        // The domain owns the invariant (Klas.Wijzig validates naam once) — the service does not
        // re-implement it, and does not write through EF property metadata, which is a technique
        // reserved for keeping read-only curriculum content unmutatable (Art. III.1).
        klas.Wijzig(wijziging.Naam, wijziging.Leerjaar);
        await BewaarAsync(klas.Naam, cancellationToken);

        var aantal = await _context.Subthemas.CountAsync(s => s.KlasId == klasId, cancellationToken);

        return new KlasWeergave(klas.Id, klas.SchooljaarId, klas.Naam, klas.Leerjaar, aantal);
    }

    /// <inheritdoc />
    public async Task VerwijderKlasAsync(Guid klasId, CancellationToken cancellationToken = default)
    {
        var klas = await VindKlasAsync(klasId, cancellationToken);

        // Report the blocking references as a 400 with a count, rather than letting the Restrict FK
        // surface as an opaque 500 (in the spirit of ADR-0006 §4 — clear diagnostics rather than raw plumbing).
        var aantal = await _context.Subthemas.CountAsync(s => s.KlasId == klasId, cancellationToken);
        if (aantal > 0)
        {
            throw new SchoolcontentValidatieFout(
                $"Klas '{klas.Naam}' heeft nog {aantal} subthema('s) en kan niet verwijderd worden. " +
                "Verwijder of verplaats eerst die klasgebonden inhoud.");
        }

        _context.Klassen.Remove(klas);
        await _context.SaveChangesAsync(cancellationToken);
    }

    private async Task<Klas> VindKlasAsync(Guid klasId, CancellationToken cancellationToken)
    {
        var klas = await _context.Klassen.FirstOrDefaultAsync(k => k.Id == klasId, cancellationToken);

        return klas ?? throw new SchoolcontentNietGevondenFout($"Klas {klasId} is niet gevonden.");
    }

    private static string VereisNaam(string? naam)
    {
        if (string.IsNullOrWhiteSpace(naam))
        {
            throw new SchoolcontentValidatieFout("Een klas heeft een naam nodig.");
        }

        return naam.Trim();
    }

    /// <summary>
    /// Rejects a name already taken by another class, compared case-insensitively <b>in the database</b>.
    /// <para>
    /// Uses <c>lower(naam) = lower(@naam)</c> (EF translates <see cref="string.ToLower()"/> to SQL
    /// <c>lower</c>), deliberately <b>not</b> <c>ILIKE</c>. <c>ILIKE</c>'s second argument is a LIKE
    /// <i>pattern</i>, so passing an unescaped class name straight from the request body made <c>%</c> and
    /// <c>_</c> act as wildcards: creating "K3_groen" matched an existing "K3-groen" and was refused as a
    /// duplicate that does not exist. A .NET <c>OrdinalIgnoreCase</c> comparer is equally wrong — in
    /// LINQ-to-Entities it translates to a case-<i>sensitive</i> SQL predicate.
    /// </para>
    /// <para>
    /// This is the friendly-message path; the database's own functional unique index on
    /// <c>lower(naam)</c> is what actually holds under a concurrent race.
    /// </para>
    /// </summary>
    private async Task VereisVrijeNaamAsync(string? naam, Guid? uitgezonderd, CancellationToken cancellationToken)
    {
        var genormaliseerd = VereisNaam(naam).ToLower();

        var bezet = await _context.Klassen
            .Where(k => uitgezonderd == null || k.Id != uitgezonderd)
            .AnyAsync(k => k.Naam.ToLower() == genormaliseerd, cancellationToken);

        if (bezet)
        {
            throw new SchoolcontentValidatieFout($"Er bestaat al een klas met de naam '{naam!.Trim()}'.");
        }
    }

    /// <summary>
    /// Saves, translating a unique-index violation on the class name into the same friendly validation
    /// fault the pre-check raises. Covers the concurrent-POST race the pre-check cannot.
    /// </summary>
    private async Task BewaarAsync(string naam, CancellationToken cancellationToken)
    {
        try
        {
            await _context.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex) when (IsUniekeNaamSchending(ex))
        {
            throw new SchoolcontentValidatieFout($"Er bestaat al een klas met de naam '{naam}'.");
        }
    }

    private static bool IsUniekeNaamSchending(DbUpdateException ex) =>
        ex.InnerException is Npgsql.PostgresException { SqlState: "23505" } pg &&
        pg.ConstraintName?.Contains("klassen", StringComparison.OrdinalIgnoreCase) == true;
}
