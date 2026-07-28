using Jaarplanner.Application.Curriculum;
using Jaarplanner.Domain.Curriculum;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.Infrastructure.Persistence;

/// <summary>
/// EF Core implementation of <see cref="IConcordantieQuery"/> over <see cref="AppDbContext"/>.
/// <para>
/// The concordance is the shared key <see cref="Leerplandoel.MinimumdoelRef"/> ↔
/// <see cref="Minimumdoel.Ref"/> (Excel D, Art. VII.1); it is modelled in E1-01 as a nullable
/// FK on <see cref="Leerplandoel"/>, which the database enforces. That means a leerplandoel with
/// a ref that matches no minimumdoel cannot persist a link — the partial/orphaned-ref case never
/// produces phantom coverage (Art. III.5, V.6). Both lookup directions are pure reads.
/// </para>
/// </summary>
public sealed class ConcordantieQuery : IConcordantieQuery
{
    private readonly AppDbContext _context;

    public ConcordantieQuery(AppDbContext context)
    {
        _context = context;
    }

    /// <inheritdoc />
    public async Task<IReadOnlyList<Leerplandoel>> LeerplandoelenVoorMinimumdoelAsync(
        string minimumdoelRef,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(minimumdoelRef))
        {
            return [];
        }

        var sleutel = minimumdoelRef.Trim();

        return await _context.Leerplandoelen
            .AsNoTracking()
            .Where(l => l.MinimumdoelRef == sleutel)
            .OrderBy(l => l.Code)
            .ToListAsync(cancellationToken);
    }

    /// <inheritdoc />
    public async Task<Minimumdoel?> MinimumdoelVoorLeerplandoelAsync(
        string leerplandoelCode,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(leerplandoelCode))
        {
            return null;
        }

        var code = leerplandoelCode.Trim();

        var minimumdoelRef = await _context.Leerplandoelen
            .AsNoTracking()
            .Where(l => l.Code == code)
            .Select(l => l.MinimumdoelRef)
            .FirstOrDefaultAsync(cancellationToken);

        if (string.IsNullOrWhiteSpace(minimumdoelRef))
        {
            return null;
        }

        // The FK guarantees a non-null ref resolves to a real minimumdoel; the join is explicit
        // here so an unmatched ref (were the FK ever relaxed) still returns null, not a phantom.
        return await _context.Minimumdoelen
            .AsNoTracking()
            .FirstOrDefaultAsync(m => m.Ref == minimumdoelRef, cancellationToken);
    }
}
