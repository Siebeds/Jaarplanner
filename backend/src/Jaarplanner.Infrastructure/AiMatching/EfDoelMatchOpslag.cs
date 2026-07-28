using Jaarplanner.Application.AiMatching;
using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.Infrastructure.AiMatching;

/// <summary>
/// EF Core implementation of <see cref="IDoelMatchOpslag"/> over <see cref="AppDbContext"/> (E2-04).
/// It loads the thema tracked (with its themadoelen + existing suggestions so the flow stays
/// idempotent), commits the added <c>voorgesteld</c> suggestions as a single unit of work, and
/// exposes the read query for the persisted suggestions per thema (FR-4.1/4.2). It never mutates
/// read-only curriculum data (Art. III.1).
/// </summary>
public sealed class EfDoelMatchOpslag : IDoelMatchOpslag
{
    private readonly AppDbContext _context;

    public EfDoelMatchOpslag(AppDbContext context) => _context = context;

    /// <inheritdoc />
    public async Task<Thema?> LaadThemaAsync(Guid themaId, CancellationToken cancellationToken = default) =>
        await _context.Themas
            .Include(t => t.Themadoelen)
            .Include(t => t.Doelsuggesties)
            .FirstOrDefaultAsync(t => t.Id == themaId, cancellationToken);

    /// <inheritdoc />
    public Task BewaarAsync(CancellationToken cancellationToken = default) =>
        _context.SaveChangesAsync(cancellationToken);

    /// <inheritdoc />
    public async Task<IReadOnlyList<DoelMatchSuggestieWeergave>> HaalSuggestiesVoorThemaAsync(
        Guid themaId,
        CancellationToken cancellationToken = default)
    {
        var thema = await _context.Themas
            .AsNoTracking()
            .Include(t => t.Doelsuggesties)
            .FirstOrDefaultAsync(t => t.Id == themaId, cancellationToken);

        if (thema is null)
        {
            return [];
        }

        return thema.Doelsuggesties
            .Select(k => new DoelMatchSuggestieWeergave(
                k.Id, k.LeerplandoelCode, k.Status.ToString(), k.AiMotivatie))
            .ToList();
    }
}
