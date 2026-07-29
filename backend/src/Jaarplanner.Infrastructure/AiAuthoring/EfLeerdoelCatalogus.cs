using Jaarplanner.Application.AiAuthoring;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.Infrastructure.AiAuthoring;

/// <summary>
/// EF Core implementation of <see cref="ILeerdoelCatalogus"/> over <see cref="AppDbContext"/> (E2-07).
/// Reads the Op.stap leerplandoelen <c>AsNoTracking</c> — a pure read of read-only reference data, so
/// it never mutates curriculum content (Art. III.1) — applying the optional discipline/jaar-fase/code
/// filter and ordering by the stable code so callers get a deterministic candidate set.
/// </summary>
public sealed class EfLeerdoelCatalogus : ILeerdoelCatalogus
{
    private readonly AppDbContext _context;

    public EfLeerdoelCatalogus(AppDbContext context) => _context = context;

    /// <inheritdoc />
    public async Task<IReadOnlyList<Leerplandoel>> HaalLeerdoelenAsync(
        LeerdoelSelectie selectie,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(selectie);

        IQueryable<Leerplandoel> query = _context.Leerplandoelen.AsNoTracking();

        var disciplines = Genormaliseerd(selectie.Disciplines);
        if (disciplines.Count > 0)
        {
            query = query.Where(d => disciplines.Contains(d.DisciplineNummer));
        }

        var jaarFasen = Genormaliseerd(selectie.JaarFasen);
        if (jaarFasen.Count > 0)
        {
            query = query.Where(d => jaarFasen.Contains(d.JaarFase));
        }

        var codes = Genormaliseerd(selectie.Codes);
        if (codes.Count > 0)
        {
            query = query.Where(d => codes.Contains(d.Code));
        }

        return await query
            .OrderBy(d => d.Code)
            .ToListAsync(cancellationToken);
    }

    private static List<string> Genormaliseerd(IReadOnlyCollection<string>? waarden) =>
        (waarden ?? [])
            .Where(w => !string.IsNullOrWhiteSpace(w))
            .Select(w => w.Trim())
            .Distinct(StringComparer.Ordinal)
            .ToList();
}
