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

    public async Task<Klasplanning?> VoorKlasAsync(Guid klasId, CancellationToken cancellationToken = default) =>
        await _context.Klassen.AsNoTracking().AnyAsync(k => k.Id == klasId, cancellationToken)
            ? new Klasplanning(klasId)
            : null;

    public Task<Klasplanning?> VoorHoekAsync(Guid hoekId, CancellationToken cancellationToken = default) =>
        PlanningVanAsync(_context.Hoeken.AsNoTracking().Where(h => h.Id == hoekId).Select(h => h.KlasId), cancellationToken);

    public Task<Klasplanning?> VoorHoekplaatsingAsync(Guid plaatsingId, CancellationToken cancellationToken = default) =>
        PlanningVanAsync(
            _context.Hoekplaatsingen.AsNoTracking().Where(p => p.Id == plaatsingId).Select(p => p.KlasId), cancellationToken);

    public Task<Klasplanning?> VoorAlgemeneFicheAsync(Guid ficheId, CancellationToken cancellationToken = default) =>
        PlanningVanAsync(_context.AlgemeneFiches.AsNoTracking().Where(f => f.Id == ficheId).Select(f => f.KlasId), cancellationToken);

    public Task<Klasplanning?> VoorAlgemeneFicheplaatsingAsync(Guid plaatsingId, CancellationToken cancellationToken = default) =>
        PlanningVanAsync(
            _context.AlgemeneFicheplaatsingen.AsNoTracking().Where(p => p.Id == plaatsingId).Select(p => p.KlasId),
            cancellationToken);

    /// <summary>The klas of the one row the query selects, as a planning resource, or <c>null</c> when there is none.</summary>
    private static async Task<Klasplanning?> PlanningVanAsync(IQueryable<Guid> klasIds, CancellationToken cancellationToken)
    {
        var gevonden = await klasIds.Select(id => (Guid?)id).SingleOrDefaultAsync(cancellationToken);
        return gevonden is { } klasId ? new Klasplanning(klasId) : null;
    }
}
