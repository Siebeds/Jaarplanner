using Jaarplanner.Application.Toegang;
using Jaarplanner.Domain.Schoolcontent;
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
    private readonly TimeProvider _tijd;

    public EfRechtenbronnen(AppDbContext context, TimeProvider tijd)
    {
        _context = context;
        _tijd = tijd;
    }

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
                    activiteit.EigenaarId,
                    HeeftDoelkoppelingen = activiteit.Doelkoppelingen.Any(),
                })
            .SingleOrDefaultAsync(cancellationToken);

        return gevonden is null
            ? null
            : new Activiteitbron(
                activiteitId, gevonden.Leeftijd, gevonden.MakerId, gevonden.HeeftDoelkoppelingen, gevonden.EigenaarId);
    }

    /// <summary>
    /// A thema and whether anything under it is someone else's (I26): every subthema, subdoel and activiteit under it
    /// counts, unless the thema's own wizard run created it <b>and that run is still open</b>. After the run, its items
    /// are ordinary shared content (I23), so they count too. The run is the one that built this thema (one per thema).
    /// <para>
    /// An activiteit the open run created that carries a goal link is reported by its leeftijd rather than decided here
    /// (Q4 (a)): whether it still counts as the run's depends on the caller's goal-link right there, which only the
    /// matrix may answer. This resolver knows no caller.
    /// </para>
    /// </summary>
    public async Task<Themabron?> VoorThemaAsync(Guid themaId, CancellationToken cancellationToken = default)
    {
        if (!await _context.Themas.AsNoTracking().AnyAsync(t => t.Id == themaId, cancellationToken))
        {
            return null;
        }

        var subthemaIds = await _context.Subthemas.AsNoTracking()
            .Where(s => s.ThemaId == themaId).Select(s => s.Id).ToListAsync(cancellationToken);
        var subdoelIds = await _context.Subdoelen.AsNoTracking()
            .Where(sd => subthemaIds.Contains(sd.SubthemaId)).Select(sd => sd.Id).ToListAsync(cancellationToken);
        var activiteitIds = await _context.Activiteiten.AsNoTracking()
            .Where(a => subthemaIds.Contains(a.SubthemaId)).Select(a => a.Id).ToListAsync(cancellationToken);

        var run = await _context.Wizardruns.AsNoTracking().FirstOrDefaultAsync(r => r.ThemaId == themaId, cancellationToken);
        var openRun = run is not null && run.IsOpen(_tijd.GetUtcNow()) ? run : null;
        bool VanDeOpenRun(Wizarditemsoort soort, Guid id) => openRun?.HeeftAangemaakt(soort, id) == true;

        // ADR-0043 D5: a woordweb is someone's personal content, and it goes with its subthema. This resolver knows no
        // caller, so any woordweb under the thema counts, whoever made it: the fail-closed reading.
        var andermans = subthemaIds.Any(id => !VanDeOpenRun(Wizarditemsoort.Subthema, id))
            || subdoelIds.Any(id => !VanDeOpenRun(Wizarditemsoort.Subdoel, id))
            || activiteitIds.Any(id => !VanDeOpenRun(Wizarditemsoort.Activiteit, id))
            || await _context.Woordwebs.AsNoTracking().AnyAsync(w => subthemaIds.Contains(w.SubthemaId), cancellationToken);

        // Q4 (a): the run's own activiteiten that carry a goal link, by leeftijd. Someone else's already count above.
        var gekoppeld = await (
                from activiteit in _context.Activiteiten.AsNoTracking()
                join subthema in _context.Subthemas on activiteit.SubthemaId equals subthema.Id
                where subthema.ThemaId == themaId && activiteit.Doelkoppelingen.Any()
                select new { activiteit.Id, subthema.Leeftijd })
            .ToListAsync(cancellationToken);
        var gekoppeldeLeeftijden = gekoppeld
            .Where(a => VanDeOpenRun(Wizarditemsoort.Activiteit, a.Id))
            .Select(a => a.Leeftijd)
            .Distinct(StringComparer.Ordinal)
            .ToList();

        return new Themabron(themaId, andermans, gekoppeldeLeeftijden);
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

    /// <summary>The klas with its stated jaarfase, read as two columns: the matrix maps it to leeftijden (FB-013).</summary>
    public async Task<Klasinzage?> VoorKlasinzageAsync(Guid klasId, CancellationToken cancellationToken = default)
    {
        var gevonden = await _context.Klassen
            .AsNoTracking()
            .Where(k => k.Id == klasId)
            .Select(k => new { k.Id, k.Jaarfase })
            .SingleOrDefaultAsync(cancellationToken);

        return gevonden is null ? null : Klasinzage.Voor(gevonden.Id, gevonden.Jaarfase);
    }

    public async Task<Rapportklas?> VoorRapportklasAsync(Guid klasId, CancellationToken cancellationToken = default) =>
        await _context.Klassen.AsNoTracking().AnyAsync(k => k.Id == klasId, cancellationToken)
            ? new Rapportklas(klasId)
            : null;

    /// <summary>The leerling's klas, read as an id only: a rights check has no business loading a child's name.</summary>
    public async Task<Rapportklas?> VoorLeerlingAsync(Guid leerlingId, CancellationToken cancellationToken = default)
    {
        var gevonden = await _context.Leerlingen
            .AsNoTracking()
            .Where(l => l.Id == leerlingId)
            .Select(l => (Guid?)l.KlasId)
            .SingleOrDefaultAsync(cancellationToken);

        return gevonden is { } klasId ? new Rapportklas(klasId) : null;
    }

    /// <summary>The woordweb's owner, read as an id only (FB-036).</summary>
    /// <summary>
    /// A proposal for an existing subthema answers with that subthema's leeftijd <b>now</b>, not the one copied when it was
    /// proposed: the subthema may have been moved since, and deciding writes a subdoel at its current leeftijd.
    /// </summary>
    public async Task<Leeftijdsinhoud?> VoorSubdoelvoorstelAsync(Guid subdoelvoorstelId, CancellationToken cancellationToken = default)
    {
        var gevonden = await (
                from voorstel in _context.Subdoelvoorstellen.AsNoTracking()
                where voorstel.Id == subdoelvoorstelId
                join subthema in _context.Subthemas on voorstel.SubthemaId equals (Guid?)subthema.Id into subthemas
                from subthema in subthemas.DefaultIfEmpty()
                select new { voorstel.Leeftijd, SubthemaLeeftijd = subthema == null ? null : subthema.Leeftijd })
            .SingleOrDefaultAsync(cancellationToken);

        return gevonden is null ? null : new Leeftijdsinhoud(gevonden.SubthemaLeeftijd ?? gevonden.Leeftijd);
    }

    public async Task<Leeftijdsinhoud?> VoorSubthemavoorstelAsync(Guid subthemavoorstelId, CancellationToken cancellationToken = default)
    {
        var leeftijd = await _context.Subthemavoorstellen
            .AsNoTracking()
            .Where(v => v.Id == subthemavoorstelId)
            .Select(v => v.Leeftijd)
            .SingleOrDefaultAsync(cancellationToken);

        return leeftijd is null ? null : new Leeftijdsinhoud(leeftijd);
    }

    public async Task<Leeftijdsinhoud?> VoorActiviteitvoorstelAsync(Guid activiteitvoorstelId, CancellationToken cancellationToken = default)
    {
        var leeftijd = await (
                from voorstel in _context.Activiteitvoorstellen.AsNoTracking()
                where voorstel.Id == activiteitvoorstelId
                join subthema in _context.Subthemas on voorstel.SubthemaId equals subthema.Id
                select subthema.Leeftijd)
            .SingleOrDefaultAsync(cancellationToken);

        return leeftijd is null ? null : new Leeftijdsinhoud(leeftijd);
    }

    public async Task<Woordwebbron?> VoorWoordwebAsync(Guid woordwebId, CancellationToken cancellationToken = default)
    {
        var eigenaar = await _context.Woordwebs
            .AsNoTracking()
            .Where(w => w.Id == woordwebId)
            .Select(w => (Guid?)w.EigenaarId)
            .SingleOrDefaultAsync(cancellationToken);

        return eigenaar is { } eigenaarId ? new Woordwebbron(woordwebId, eigenaarId) : null;
    }

    /// <summary>The klas of the one row the query selects, as a planning resource, or <c>null</c> when there is none.</summary>
    private static async Task<Klasplanning?> PlanningVanAsync(IQueryable<Guid> klasIds, CancellationToken cancellationToken)
    {
        var gevonden = await klasIds.Select(id => (Guid?)id).SingleOrDefaultAsync(cancellationToken);
        return gevonden is { } klasId ? new Klasplanning(klasId) : null;
    }
}
