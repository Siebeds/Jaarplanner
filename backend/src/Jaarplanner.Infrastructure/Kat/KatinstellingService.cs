using Jaarplanner.Application.Kat;
using Jaarplanner.Domain.Kat;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.Infrastructure.Kat;

/// <summary>Whether the school shows Chuck, over EF Core (FB-071, ADR-0064). One row, created on the first change.</summary>
public sealed class KatinstellingService : IKatinstellingService
{
    private readonly AppDbContext _db;

    public KatinstellingService(AppDbContext db) => _db = db;

    public async Task<KatinstellingWeergave> HaalOpAsync(CancellationToken cancellationToken = default)
    {
        var rij = await _db.Katinstellingen.AsNoTracking()
            .FirstOrDefaultAsync(k => k.Id == Katinstelling.EnigeId, cancellationToken);
        return new KatinstellingWeergave(rij?.IsZichtbaar ?? false);
    }

    public async Task<KatinstellingWeergave> ZetAsync(
        KatinstellingWeergave invoer,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(invoer);

        var rij = await _db.Katinstellingen.FirstOrDefaultAsync(k => k.Id == Katinstelling.EnigeId, cancellationToken);
        if (rij is null)
        {
            _db.Katinstellingen.Add(new Katinstelling(invoer.IsZichtbaar));
        }
        else
        {
            rij.Zet(invoer.IsZichtbaar);
        }

        await _db.SaveChangesAsync(cancellationToken);
        return new KatinstellingWeergave(invoer.IsZichtbaar);
    }
}
