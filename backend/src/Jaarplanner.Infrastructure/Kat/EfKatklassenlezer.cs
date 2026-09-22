using Jaarplanner.Application.Kat;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Jaarplanner.Infrastructure.Kat;

/// <summary>
/// The klassen the cat watches (TB-057): those of a schooljaar that has not ended on the school's clock, with the
/// leerkrachten their klastoewijzingen name (ADR-0059 D5). A klas of a finished schooljaar is left alone, the same
/// way the rights on its shared content have lapsed (ADR-0030 R20).
/// </summary>
public sealed class EfKatklassenlezer : IKatklassenlezer
{
    private readonly AppDbContext _context;
    private readonly TimeProvider _tijd;
    private readonly ILogger<EfKatklassenlezer> _logger;

    public EfKatklassenlezer(AppDbContext context, TimeProvider tijd, ILogger<EfKatklassenlezer> logger)
    {
        _context = context;
        _tijd = tijd;
        _logger = logger;
    }

    public async Task<IReadOnlyList<Katklas>> HaalKlassenAsync(CancellationToken ct)
    {
        var vandaag = Schoolklok.Vandaag(_tijd, _logger);

        var klassen = await (
                from klas in _context.Klassen.AsNoTracking()
                join schooljaar in _context.Schooljaren on klas.SchooljaarId equals schooljaar.Id
                where schooljaar.Eind >= vandaag
                select new { klas.Id, klas.Jaarfase })
            .ToListAsync(ct);

        var klasIds = klassen.Select(k => k.Id).ToList();
        var leerkrachten = await _context.Klastoewijzingen.AsNoTracking()
            .Where(t => klasIds.Contains(t.KlasId))
            .Select(t => new { t.KlasId, t.GebruikerId })
            .ToListAsync(ct);

        var perKlas = leerkrachten
            .GroupBy(t => t.KlasId)
            .ToDictionary(g => g.Key, g => (IReadOnlyList<Guid>)g.Select(t => t.GebruikerId).Distinct().ToList());

        return klassen
            .Select(k => new Katklas(k.Id, k.Jaarfase, perKlas.TryGetValue(k.Id, out var ids) ? ids : []))
            .ToList();
    }
}
