using Jaarplanner.Application.Toegang;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.Infrastructure.Toegang;

/// <summary>
/// EF Core implementation of <see cref="IRechtenbronnen"/>: one projection per resource, read-only, so a rights check
/// never materialises (or could mutate) the aggregate it guards.
/// </summary>
public sealed class EfRechtenbronnen : IRechtenbronnen
{
    private readonly AppDbContext _context;

    public EfRechtenbronnen(AppDbContext context) => _context = context;

    public async Task<Leeftijdsinhoud?> VoorSubthemaAsync(Guid subthemaId, CancellationToken cancellationToken = default)
    {
        var leeftijd = await _context.Subthemas
            .AsNoTracking()
            .Where(s => s.Id == subthemaId)
            .Select(s => s.Leeftijd)
            .SingleOrDefaultAsync(cancellationToken);

        return leeftijd is null ? null : new Leeftijdsinhoud(leeftijd);
    }

    public async Task<Activiteitbron?> VoorActiviteitAsync(Guid activiteitId, CancellationToken cancellationToken = default)
    {
        var gevonden = await (
                from activiteit in _context.Activiteiten.AsNoTracking()
                where activiteit.Id == activiteitId
                join subthema in _context.Subthemas on activiteit.SubthemaId equals subthema.Id
                select new
                {
                    subthema.Leeftijd,
                    activiteit.MakerId,
                    HeeftDoelkoppelingen = activiteit.Doelkoppelingen.Any(),
                })
            .SingleOrDefaultAsync(cancellationToken);

        return gevonden is null
            ? null
            : new Activiteitbron(activiteitId, gevonden.Leeftijd, gevonden.MakerId, gevonden.HeeftDoelkoppelingen);
    }
}
