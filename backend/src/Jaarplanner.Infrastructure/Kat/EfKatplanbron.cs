using Jaarplanner.Application.Kat;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.Infrastructure.Kat;

/// <summary>
/// What the cat's dekking detectors read beyond the dekking itself (FB-069). Read-only throughout: nothing here
/// tracks an entity, because a detector must not be able to change what it is judging.
/// </summary>
public sealed class EfKatplanbron : IKatplanbron
{
    private readonly AppDbContext _context;

    public EfKatplanbron(AppDbContext context) => _context = context;

    public async Task<IReadOnlyList<Themadrager>> HaalThemadragersAsync(CancellationToken ct) =>
        await _context.Themas.AsNoTracking()
            .SelectMany(t => t.Minimumdoelen.Select(m => new Themadrager(m.MinimumdoelRef, t.Id, t.Naam, t.DuurWeken)))
            .ToListAsync(ct);

    public async Task<IReadOnlyList<Katsubthema>> HaalSubthemasAsync(Guid klasId, CancellationToken ct)
    {
        var gepland = await GeplaatsteSubthemaIdsAsync(klasId, ct);

        // Only decided goal links count, as the dekking counts them: a proposal nobody has accepted covers nothing
        // (Art. IV.1, Art. V.1).
        var subthemas = await _context.Subthemas.AsNoTracking()
            .Select(s => new
            {
                s.Id,
                s.ThemaId,
                s.Naam,
                s.Leeftijd,
                Codes = s.Subdoelen
                    .Where(d => d.Koppeling.Status == KoppelingStatus.Aanvaard || d.Koppeling.Status == KoppelingStatus.Manueel)
                    .Select(d => d.Koppeling.LeerplandoelCode)
                    .ToList(),
            })
            .ToListAsync(ct);

        return subthemas
            .Select(s => new Katsubthema(
                s.Id,
                s.ThemaId,
                s.Naam,
                s.Leeftijd,
                gepland.Contains(s.Id),
                s.Codes.Distinct(StringComparer.Ordinal).ToList()))
            .ToList();
    }

    public async Task<Schooljaar?> HaalSchooljaarAsync(Guid klasId, CancellationToken ct)
    {
        var schooljaarId = await _context.Klassen.AsNoTracking()
            .Where(k => k.Id == klasId)
            .Select(k => k.SchooljaarId)
            .FirstOrDefaultAsync(ct);

        // The closures are an owned collection, so they come with the year and need no Include.
        return await _context.Schooljaren.AsNoTracking().FirstOrDefaultAsync(j => j.Id == schooljaarId, ct);
    }

    /// <summary>
    /// The subthema's in this klas's agenda: a <c>Subthemaplaatsing</c> in one of its jaarplannen. The same question
    /// <c>EfDekkingOpslag</c> asks to decide <c>IsIngepland</c>, asked the same way, so the cat and the dekking
    /// cannot come to disagree about what "gepland" means.
    /// </summary>
    private async Task<HashSet<Guid>> GeplaatsteSubthemaIdsAsync(Guid klasId, CancellationToken ct)
    {
        var jaarplanIds = await _context.Jaarplannen.AsNoTracking()
            .Where(j => j.KlasId == klasId)
            .Select(j => j.Id)
            .ToListAsync(ct);

        if (jaarplanIds.Count == 0)
        {
            return [];
        }

        var ids = await _context.Subthemaplaatsingen.AsNoTracking()
            .Where(p => jaarplanIds.Contains(p.JaarplanId))
            .Select(p => p.SubthemaId)
            .Distinct()
            .ToListAsync(ct);

        return ids.ToHashSet();
    }
}
