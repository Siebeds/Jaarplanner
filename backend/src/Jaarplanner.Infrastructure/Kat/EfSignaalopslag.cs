using Jaarplanner.Application.Kat;
using Jaarplanner.Domain.Kat;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.Infrastructure.Kat;

/// <summary>Where the cat's signals live (TB-057).</summary>
public sealed class EfSignaalopslag : ISignaalopslag
{
    private readonly AppDbContext _context;

    public EfSignaalopslag(AppDbContext context) => _context = context;

    public async Task<IReadOnlyList<Signaal>> HaalVoorKlasAsync(Guid klasId, CancellationToken ct) =>
        await _context.Signalen.Where(s => s.KlasId == klasId).ToListAsync(ct);

    public async Task<IReadOnlyList<Signaal>> HaalVoorOntvangerAsync(Guid ontvangerId, CancellationToken ct) =>
        await _context.Signalen.AsNoTracking().Where(s => s.OntvangerId == ontvangerId).ToListAsync(ct);

    public async Task<Signaal?> HaalAsync(Guid signaalId, CancellationToken ct) =>
        await _context.Signalen.FirstOrDefaultAsync(s => s.Id == signaalId, ct);

    public async Task BewaarAsync(IReadOnlyList<Signaal> nieuw, IReadOnlyList<Signaal> verdwenen, CancellationToken ct)
    {
        _context.Signalen.AddRange(nieuw);
        _context.Signalen.RemoveRange(verdwenen);
        await _context.SaveChangesAsync(ct);
    }

    public async Task BewaarWijzigingAsync(Signaal signaal, CancellationToken ct)
    {
        _context.Signalen.Update(signaal);
        await _context.SaveChangesAsync(ct);
    }
}
