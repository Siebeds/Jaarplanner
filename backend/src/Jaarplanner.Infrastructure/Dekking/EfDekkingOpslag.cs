using Jaarplanner.Application.Dekking;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.Infrastructure.Dekking;

/// <summary>
/// EF Core implementation of <see cref="IDekkingOpslag"/> (E5-01, ADR-0047, Art. VIII layering).
/// <para>
/// <b>Every read is untracked and mutates nothing.</b> Coverage is computed, never stored (Art. V.1), and the
/// curriculum it reads is read-only reference data (Art. III.1).
/// </para>
/// <para>
/// <b>One query per layer, not one query for all of them.</b> A single <c>Concat</c> of navigations across the thema
/// tree does not translate on PostgreSQL (it did on the in-memory provider, which hid the defect until a real database
/// ran it, E2-06). The cost is a handful of statements over a primary-school dataset.
/// </para>
/// </summary>
public sealed class EfDekkingOpslag : IDekkingOpslag
{
    private readonly AppDbContext _context;

    public EfDekkingOpslag(AppDbContext context)
    {
        _context = context;
    }

    /// <inheritdoc />
    public async Task<IReadOnlyList<DekkendeKoppeling>> HaalDekkendeKoppelingenAsync(
        IReadOnlyCollection<Guid> themaIds,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(themaIds);

        if (themaIds.Count == 0)
        {
            // No placed thema means nothing to read, and it keeps an empty IN () list out of the SQL.
            return [];
        }

        var ids = themaIds.Distinct().ToList();

        // Accepted doelsuggesties only: a themadoel that links a leerplandoel counts nowhere (ADR-0047 D5), and the
        // subthema layers have their own route through their subthema's placement.
        var suggesties = await _context.Themas
            .AsNoTracking()
            .Where(t => ids.Contains(t.Id))
            .SelectMany(t => t.Doelsuggesties
                .Where(k => k.Status == KoppelingStatus.Aanvaard || k.Status == KoppelingStatus.Manueel)
                .Select(k => new DekkendeKoppeling(k.LeerplandoelCode, t.Naam)))
            .ToListAsync(cancellationToken);

        return suggesties.Distinct().ToList();
    }

    /// <inheritdoc />
    public async Task<IReadOnlyList<Subthemakoppeling>> HaalSubthemakoppelingenAsync(
        Guid klasId,
        CancellationToken cancellationToken = default)
    {
        // Null means "cannot tell which ages this class teaches": every subthema then counts, as the leerplandoel scope
        // widens for such a class rather than narrowing to nothing.
        var codes = (await Klasleeftijden.VoorKlasAsync(_context, klasId, cancellationToken)).Waarden;
        var geplaatst = await GeplaatsteSubthemaIdsAsync(klasId, cancellationToken);

        var subdoelen = await _context.Themas
            .AsNoTracking()
            .SelectMany(t => t.Subthemas
                .Where(st => codes == null || codes.Contains(st.Leeftijd))
                .SelectMany(st => st.Subdoelen
                    .Where(sd => sd.Koppeling.Status == KoppelingStatus.Aanvaard
                        || sd.Koppeling.Status == KoppelingStatus.Manueel)
                    .Select(sd => new Rij(sd.Koppeling.LeerplandoelCode, t.Naam, st.Id, st.Naam))))
            .ToListAsync(cancellationToken);

        var activiteiten = await _context.Themas
            .AsNoTracking()
            .SelectMany(t => t.Subthemas
                .Where(st => codes == null || codes.Contains(st.Leeftijd))
                .SelectMany(st => st.Activiteiten
                    .SelectMany(a => a.Doelkoppelingen
                        .Where(k => k.Status == KoppelingStatus.Aanvaard
                            || k.Status == KoppelingStatus.Manueel)
                        .Select(k => new Rij(k.LeerplandoelCode, t.Naam, st.Id, st.Naam)))))
            .ToListAsync(cancellationToken);

        return subdoelen
            .Concat(activiteiten)
            .Select(r => new Subthemakoppeling(r.Code, r.ThemaNaam, r.SubthemaNaam, geplaatst.Contains(r.SubthemaId)))
            .Distinct()
            .ToList();
    }

    private sealed record Rij(string Code, string ThemaNaam, Guid SubthemaId, string SubthemaNaam);

    /// <summary>The subthema's placed in this class's agenda: a <c>Subthemaplaatsing</c> in one of its jaarplannen.</summary>
    private async Task<HashSet<Guid>> GeplaatsteSubthemaIdsAsync(Guid klasId, CancellationToken cancellationToken)
    {
        var jaarplanIds = await _context.Jaarplannen
            .AsNoTracking()
            .Where(j => j.KlasId == klasId)
            .Select(j => j.Id)
            .ToListAsync(cancellationToken);

        if (jaarplanIds.Count == 0)
        {
            return [];
        }

        var ids = await _context.Subthemaplaatsingen
            .AsNoTracking()
            .Where(p => jaarplanIds.Contains(p.JaarplanId))
            .Select(p => p.SubthemaId)
            .Distinct()
            .ToListAsync(cancellationToken);

        return ids.ToHashSet();
    }

    /// <inheritdoc />
    public async Task<IReadOnlyList<KandidaatKoppeling>> HaalKandidaatKoppelingenAsync(
        Guid klasId,
        CancellationToken cancellationToken = default)
    {
        var codes = (await Klasleeftijden.VoorKlasAsync(_context, klasId, cancellationToken)).Waarden;

        var suggesties = await _context.Themas
            .AsNoTracking()
            .SelectMany(t => t.Doelsuggesties
                .Where(k => k.Status != KoppelingStatus.Geweigerd)
                .Select(k => new KandidaatKoppeling(
                    k.LeerplandoelCode,
                    t.Id,
                    t.Naam,
                    k.Status == KoppelingStatus.Aanvaard || k.Status == KoppelingStatus.Manueel,
                    true)))
            .ToListAsync(cancellationToken);

        var subdoelen = await _context.Themas
            .AsNoTracking()
            .SelectMany(t => t.Subthemas
                .Where(st => codes == null || codes.Contains(st.Leeftijd))
                .SelectMany(st => st.Subdoelen
                    .Where(sd => sd.Koppeling.Status != KoppelingStatus.Geweigerd)
                    .Select(sd => new KandidaatKoppeling(
                        sd.Koppeling.LeerplandoelCode,
                        t.Id,
                        t.Naam,
                        sd.Koppeling.Status == KoppelingStatus.Aanvaard
                            || sd.Koppeling.Status == KoppelingStatus.Manueel,
                        false))))
            .ToListAsync(cancellationToken);

        var activiteiten = await _context.Themas
            .AsNoTracking()
            .SelectMany(t => t.Subthemas
                .Where(st => codes == null || codes.Contains(st.Leeftijd))
                .SelectMany(st => st.Activiteiten
                    .SelectMany(a => a.Doelkoppelingen
                        .Where(k => k.Status != KoppelingStatus.Geweigerd)
                        .Select(k => new KandidaatKoppeling(
                            k.LeerplandoelCode,
                            t.Id,
                            t.Naam,
                            k.Status == KoppelingStatus.Aanvaard || k.Status == KoppelingStatus.Manueel,
                            false)))))
            .ToListAsync(cancellationToken);

        return suggesties
            .Concat(subdoelen)
            .Concat(activiteiten)
            .Distinct()
            .ToList();
    }

    /// <inheritdoc />
    public async Task<IReadOnlyList<DekkendeFichekoppeling>> HaalFichekoppelingenAsync(
        Guid klasId,
        CancellationToken cancellationToken = default)
    {
        // "Planned" is the existence of any occurrence window in the class's own agenda (ADR-0029).
        var rijen = await _context.AlgemeneFiches
            .AsNoTracking()
            .Where(f => f.KlasId == klasId
                && _context.AlgemeneFicheplaatsingen.Any(p => p.AlgemeneFicheId == f.Id && p.KlasId == klasId))
            .SelectMany(f => f.Doelkoppelingen
                .Where(k => k.Status == KoppelingStatus.Aanvaard || k.Status == KoppelingStatus.Manueel)
                .Select(k => new DekkendeFichekoppeling(k.LeerplandoelCode, f.Naam)))
            .ToListAsync(cancellationToken);

        return rijen.Distinct().ToList();
    }

    /// <inheritdoc />
    public async Task<IReadOnlyList<Themaminimumdoelkoppeling>> HaalThemaMinimumdoelenAsync(
        CancellationToken cancellationToken = default)
    {
        var rijen = await _context.Themas
            .AsNoTracking()
            .SelectMany(t => t.Minimumdoelen.Select(m => new Themaminimumdoelkoppeling(m.MinimumdoelRef, t.Id, t.Naam)))
            .ToListAsync(cancellationToken);

        return rijen.Distinct().ToList();
    }

    /// <inheritdoc />
    public async Task<IReadOnlyList<Minimumdoel>> HaalMinimumdoelenAsync(
        IReadOnlyCollection<string>? mijlpalen = null,
        CancellationToken cancellationToken = default)
    {
        var query = _context.Minimumdoelen.AsNoTracking();
        if (mijlpalen is not null)
        {
            var lijst = mijlpalen.ToList();
            query = query.Where(m => lijst.Contains(m.Leeftijd));
        }

        return await query.ToListAsync(cancellationToken);
    }

    /// <inheritdoc />
    public async Task<IReadOnlyList<Leerplandoel>> HaalLeerplandoelenAsync(
        IReadOnlyCollection<string>? jaarFasen = null,
        CancellationToken cancellationToken = default)
    {
        var query = _context.Leerplandoelen.AsNoTracking();

        if (jaarFasen is { Count: > 0 })
        {
            var fasen = jaarFasen.ToList();
            query = query.Where(l => fasen.Contains(l.JaarFase));
        }

        return await query.ToListAsync(cancellationToken);
    }

    /// <inheritdoc />
    public Task<int> TelAlleLeerplandoelenAsync(CancellationToken cancellationToken = default) =>
        _context.Leerplandoelen.AsNoTracking().CountAsync(cancellationToken);

    /// <inheritdoc />
    public async Task<IReadOnlyDictionary<string, string>> HaalDisciplinenamenAsync(
        CancellationToken cancellationToken = default) =>
        await _context.Disciplines
            .AsNoTracking()
            .Select(d => new { d.Nummer, d.Naam })
            .ToDictionaryAsync(d => d.Nummer, d => d.Naam, StringComparer.Ordinal, cancellationToken);

    /// <inheritdoc />
    public async Task<Klasscope?> HaalKlasscopeAsync(Guid klasId, CancellationToken cancellationToken = default)
    {
        return await _context.Klassen
            .AsNoTracking()
            .Where(k => k.Id == klasId)
            .Select(k => (Klasscope?)new Klasscope(k.Leerjaar, k.Jaarfase))
            .FirstOrDefaultAsync(cancellationToken);
    }
}
