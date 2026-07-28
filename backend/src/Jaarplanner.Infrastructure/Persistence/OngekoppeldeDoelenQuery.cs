using Jaarplanner.Application.Curriculum;
using Jaarplanner.Domain.Schoolcontent;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.Infrastructure.Persistence;

/// <summary>
/// EF Core implementation of <see cref="IOngekoppeldeDoelenQuery"/> over <see cref="AppDbContext"/>
/// (E2-06, FR-4.4).
/// <para>
/// "Gekoppeld" follows the coverage semantics of Art. V: a leerplandoel is linked when it carries a
/// <see cref="DoelKoppeling"/> with status <see cref="KoppelingStatus.Aanvaard"/> or
/// <see cref="KoppelingStatus.Manueel"/>. Those links live in four owned tables — accepted/adjusted
/// thema-doelsuggesties (<see cref="Thema.Doelsuggesties"/>), curated <c>themadoelen</c>,
/// <c>subdoelen</c> and activiteit links — so the set of linked codes is the union across all four.
/// <c>voorgesteld</c>/<c>geweigerd</c> links are excluded, so a doel that only has an open suggestion
/// stays in the gap list (agrees with dekking, Art. V).
/// </para>
/// <para>
/// The query runs in two round-trips, not N+1: first it materialises the (small) distinct set of linked
/// codes, then it selects the leerplandoelen whose code is not in that set. Both are pure reads over
/// read-only reference data (Art. III.1). Because the set is recomputed on every call, the result
/// reflects the current link state — accepting/rejecting a suggestion or adding a manual link changes it
/// immediately (FR-4.4 "updates as links change").
/// </para>
/// </summary>
public sealed class OngekoppeldeDoelenQuery : IOngekoppeldeDoelenQuery
{
    private readonly AppDbContext _context;

    public OngekoppeldeDoelenQuery(AppDbContext context)
    {
        _context = context;
    }

    /// <inheritdoc />
    public async Task<IReadOnlyList<OngekoppeldDoelWeergave>> HaalOngekoppeldeDoelenAsync(
        CancellationToken cancellationToken = default)
    {
        // The codes carrying a real link (status aanvaard/manueel) across the four owned link tables.
        var themaSuggestieCodes = _context.Themas
            .SelectMany(t => t.Doelsuggesties)
            .Where(k => k.Status == KoppelingStatus.Aanvaard || k.Status == KoppelingStatus.Manueel)
            .Select(k => k.LeerplandoelCode);

        var themadoelCodes = _context.Themadoelen
            .Where(td => td.Koppeling.Status == KoppelingStatus.Aanvaard
                || td.Koppeling.Status == KoppelingStatus.Manueel)
            .Select(td => td.Koppeling.LeerplandoelCode);

        var subdoelCodes = _context.Subdoelen
            .Where(sd => sd.Koppeling.Status == KoppelingStatus.Aanvaard
                || sd.Koppeling.Status == KoppelingStatus.Manueel)
            .Select(sd => sd.Koppeling.LeerplandoelCode);

        var activiteitCodes = _context.Activiteiten
            .SelectMany(a => a.Doelkoppelingen)
            .Where(k => k.Status == KoppelingStatus.Aanvaard || k.Status == KoppelingStatus.Manueel)
            .Select(k => k.LeerplandoelCode);

        var gekoppeldeCodes = await themaSuggestieCodes
            .Concat(themadoelCodes)
            .Concat(subdoelCodes)
            .Concat(activiteitCodes)
            .Distinct()
            .ToListAsync(cancellationToken);

        return await _context.Leerplandoelen
            .AsNoTracking()
            .Where(l => !gekoppeldeCodes.Contains(l.Code))
            .OrderBy(l => l.Domein)
            .ThenBy(l => l.Subdomein)
            .ThenBy(l => l.Code)
            .Select(l => new OngekoppeldDoelWeergave(
                l.Code,
                l.Doelsoort,
                l.JaarFase,
                l.Domein,
                l.Subdomein,
                l.Tekst))
            .ToListAsync(cancellationToken);
    }
}
