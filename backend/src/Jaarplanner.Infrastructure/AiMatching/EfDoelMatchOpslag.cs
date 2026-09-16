using Jaarplanner.Application.AiMatching;
using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.Infrastructure.AiMatching;

/// <summary>
/// EF Core implementation of <see cref="IDoelMatchOpslag"/> over <see cref="AppDbContext"/> (FB-053). It loads the thema
/// tracked with what a run and a decision need, commits them as one unit of work, and reads the stored proposals with
/// their minimumdoel's text. It never writes curriculum data (Art. III.1).
/// </summary>
public sealed class EfDoelMatchOpslag : IDoelMatchOpslag
{
    private readonly AppDbContext _context;

    public EfDoelMatchOpslag(AppDbContext context) => _context = context;

    /// <inheritdoc />
    /// <remarks>
    /// With its proposals, its subthema's with their onderzoeksvragen and activiteiten (the prompt writes all three and
    /// the run takes its default leeftijden from them), and its minimumdoelen, which are auto-included. One query per
    /// collection, since several collections in one join multiply into a cartesian result.
    /// </remarks>
    public async Task<Thema?> LaadThemaAsync(Guid themaId, CancellationToken cancellationToken = default) =>
        await _context.Themas
            .Include(t => t.Doelsuggesties)
            .Include(t => t.Subthemas).ThenInclude(s => s.Onderzoeksvragen)
            .Include(t => t.Subthemas).ThenInclude(s => s.Activiteiten)
            .AsSplitQuery()
            .FirstOrDefaultAsync(t => t.Id == themaId, cancellationToken);

    /// <inheritdoc />
    public Task BewaarAsync(CancellationToken cancellationToken = default) =>
        _context.SaveChangesAsync(cancellationToken);

    /// <inheritdoc />
    public async Task<IReadOnlyList<DoelMatchSuggestieWeergave>> HaalSuggestiesVoorThemaAsync(
        Guid themaId,
        CancellationToken cancellationToken = default)
    {
        // Left join on the read-only minimumdoel, so a ref that no longer resolves still shows, without its text.
        var rijen = await (
                from s in _context.Minimumdoelsuggesties.AsNoTracking()
                where s.ThemaId == themaId
                join m in _context.Minimumdoelen.AsNoTracking() on s.MinimumdoelRef equals m.Ref into doelen
                from m in doelen.DefaultIfEmpty()
                select new { s.Id, s.MinimumdoelRef, s.Status, s.AiMotivatie, Omschrijving = (string?)m.Omschrijving, Mijlpaal = (string?)m.Leeftijd })
            .ToListAsync(cancellationToken);

        return rijen
            .OrderBy(r => r.MinimumdoelRef, StringComparer.Ordinal)
            .Select(r => new DoelMatchSuggestieWeergave(r.Id, r.MinimumdoelRef, r.Status.ToString(), r.AiMotivatie, r.Omschrijving, r.Mijlpaal))
            .ToList();
    }
}
