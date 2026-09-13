using Jaarplanner.Application.Curriculum.Import;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.Infrastructure.OpstapImport;

/// <summary>
/// EF Core implementation of <see cref="IOpstapImportStandQuery"/> (E1-22). Two reads of our own tables, no call to
/// KOV. "The last applied version" is ordered exactly as <see cref="LeerplandoelImportService"/> orders it for the
/// report's <c>vorigeVersie</c>, so the screen and the report can never name two different versions.
/// </summary>
public sealed class OpstapImportStandQuery : IOpstapImportStandQuery
{
    private readonly AppDbContext _context;

    public OpstapImportStandQuery(AppDbContext context) => _context = context;

    /// <inheritdoc />
    public async Task<OpstapImportStand> HaalOpAsync(CancellationToken cancellationToken = default)
    {
        var aantalMinimumdoelen = await _context.Minimumdoelen.AsNoTracking().CountAsync(cancellationToken);

        var laatste = await _context.Opstapversies
            .AsNoTracking()
            .OrderByDescending(v => v.ToegepastOp)
            .ThenByDescending(v => v.Id)
            .Select(v => new OpstapversieWeergave(v.Versie, v.Hash, v.ToegepastOp))
            .FirstOrDefaultAsync(cancellationToken);

        return new OpstapImportStand(aantalMinimumdoelen, laatste);
    }
}
