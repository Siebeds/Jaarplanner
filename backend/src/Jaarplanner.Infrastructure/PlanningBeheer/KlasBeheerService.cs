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

        return new KlasWeergave(klas.Id, klas.Naam, klas.Leerjaar, aantal);
    }

    /// <inheritdoc />
    public async Task<KlasWeergave> MaakKlasAsync(KlasCreatie creatie, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(creatie);

        var naam = VereisNaam(creatie.Naam);
        await VereisVrijeNaamAsync(naam, uitgezonderd: null, cancellationToken);

        var klas = new Klas(naam, creatie.Leerjaar);
        _context.Klassen.Add(klas);
        await BewaarAsync(naam, cancellationToken);

        return new KlasWeergave(klas.Id, klas.Naam, klas.Leerjaar, AantalSubthemas: 0);
    }

    /// <inheritdoc />
    public async Task<KlasWeergave> WijzigKlasAsync(Guid klasId, KlasCreatie wijziging, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(wijziging);

        var klas = await VindKlasAsync(klasId, cancellationToken);
        var naam = VereisNaam(wijziging.Naam);
        await VereisVrijeNaamAsync(naam, uitgezonderd: klasId, cancellationToken);

        // Klas is deliberately mutator-free (it predates any CRUD story), so the rename is written
        // through EF's property metadata — the same technique the Op.stap import uses to refresh
        // read-only curriculum content without giving the entity public setters.
        var entry = _context.Entry(klas);
        entry.Property(k => k.Naam).CurrentValue = naam;
        entry.Property(k => k.Leerjaar).CurrentValue = wijziging.Leerjaar;
        await BewaarAsync(naam, cancellationToken);

        var aantal = await _context.Subthemas.CountAsync(s => s.KlasId == klasId, cancellationToken);

        return new KlasWeergave(klas.Id, naam, wijziging.Leerjaar, aantal);
    }

    /// <inheritdoc />
    public async Task VerwijderKlasAsync(Guid klasId, CancellationToken cancellationToken = default)
    {
        var klas = await VindKlasAsync(klasId, cancellationToken);

        // Report the blocking references as a 400 with a count, rather than letting the Restrict FK
        // surface as an opaque 500 (ADR-0006 §4: report, never dump plumbing on the teacher).
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
    /// Rejects a name already taken by another class. Compared case-insensitively <b>in the database</b>
    /// (<c>ILIKE</c> via <see cref="EF.Functions"/>) rather than with a .NET comparer, because an
    /// <c>OrdinalIgnoreCase</c> comparison in LINQ-to-Entities translates to a case-<i>sensitive</i> SQL
    /// predicate — the exact defect that lets "water" and "Water" both persist elsewhere in this codebase.
    /// </summary>
    private async Task VereisVrijeNaamAsync(string naam, Guid? uitgezonderd, CancellationToken cancellationToken)
    {
        var bezet = await _context.Klassen
            .Where(k => uitgezonderd == null || k.Id != uitgezonderd)
            .AnyAsync(k => EF.Functions.ILike(k.Naam, naam), cancellationToken);

        if (bezet)
        {
            throw new SchoolcontentValidatieFout($"Er bestaat al een klas met de naam '{naam}'.");
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
