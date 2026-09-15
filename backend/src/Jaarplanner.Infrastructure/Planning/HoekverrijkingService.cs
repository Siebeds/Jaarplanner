using Jaarplanner.Application.Planning.Hoeken;
using Jaarplanner.Application.Planning.Weekplanning;
using Jaarplanner.Application.Schoolcontent.Beheer;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.Infrastructure.Planning;

/// <summary>
/// What each hoek of a class holds while a subthema runs, over EF Core (FB-020, ADR-0040).
/// <para>
/// <b>Every check comes before anything is written.</b> The hoeken are read and refused first, then the window is
/// found or stored, then the texts are written in one save. A refusal therefore leaves no half-made state behind,
/// with one deliberate exception: a window stored for a subthema the agenda drew from its activiteiten stays stored if
/// the texts then fail to save. That window is what the agenda already showed, so keeping it changes nothing she sees.
/// </para>
/// <para>
/// <b>Storing a window goes through <see cref="IWeekplanningService.PlaatsSubthemaAsync"/></b>, the route the planner
/// uses, so the checks a window gets (the subthema is for an age this klas teaches, the days are clamped into the
/// school year) are the same ones whichever screen stores it.
/// </para>
/// </summary>
public sealed class HoekverrijkingService : IHoekverrijkingService
{
    private readonly AppDbContext _db;
    private readonly IWeekplanningService _weekplanning;

    public HoekverrijkingService(AppDbContext db, IWeekplanningService weekplanning)
    {
        _db = db;
        _weekplanning = weekplanning;
    }

    public async Task<IReadOnlyList<SubthemaperiodeVerrijkingen>> HaalVoorBereikAsync(
        Guid klasId,
        DateOnly van,
        DateOnly tot,
        CancellationToken cancellationToken = default)
    {
        if (tot < van)
        {
            throw new SchoolcontentValidatieFout("De laatste dag van het bereik kan niet voor de eerste dag liggen.");
        }

        await BevestigKlasAsync(klasId, cancellationToken);

        // Overlap, not containment, as for the hoekplaatsingen: a subthema that began the Friday before still runs.
        var vensters = await VanKlas(klasId)
            .AsNoTracking()
            .Where(p => p.Van <= tot && p.Tot >= van)
            .OrderBy(p => p.Van)
            .ToListAsync(cancellationToken);

        return await WeergaveAsync(vensters, cancellationToken);
    }

    public async Task<SubthemaperiodeVerrijkingen> BewaarAsync(
        Guid klasId,
        HoekverrijkingenInvoer invoer,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(invoer);
        await BevestigKlasAsync(klasId, cancellationToken);

        // One line per hoek. A request naming a hoek twice keeps its last line, as a form sending a field twice would.
        var regels = (invoer.Verrijkingen ?? [])
            .GroupBy(r => r.HoekId)
            .Select(groep => groep.Last())
            .ToList();

        if (regels.Any(r => (r.Tekst?.Trim().Length ?? 0) > IHoekverrijkingService.MaximaleLengte))
        {
            throw new SchoolcontentValidatieFout(
                $"Een verrijking is hoogstens {IHoekverrijkingService.MaximaleLengte} tekens lang. Maak de tekst korter.");
        }

        var hoekIds = regels.Select(r => r.HoekId).ToList();
        var hoeken = await _db.Hoeken
            .AsNoTracking()
            .Where(h => hoekIds.Contains(h.Id))
            .ToListAsync(cancellationToken);

        var ontbrekend = hoekIds.Where(id => hoeken.All(h => h.Id != id)).ToList();
        if (ontbrekend.Count > 0)
        {
            throw new SchoolcontentNietGevondenFout($"Hoek {ontbrekend[0]} is niet gevonden.");
        }

        if (hoeken.Any(h => h.KlasId != klasId))
        {
            // Not a 404, the words PlaatsAsync uses for the same case: the corner exists, in another classroom.
            throw new SchoolcontentValidatieFout("Die hoek hoort bij een andere klas.");
        }

        var venster = invoer.SubthemaperiodeId is { } periodeId
            ? await VensterVanKlasAsync(klasId, periodeId, cancellationToken)
            : await LegVensterVastAsync(klasId, invoer, cancellationToken);

        var bestaand = await _db.Hoekverrijkingen
            .Where(v => v.SubthemaplaatsingId == venster.Id && hoekIds.Contains(v.HoekId))
            .ToListAsync(cancellationToken);

        foreach (var regel in regels)
        {
            var huidige = bestaand.Find(v => v.HoekId == regel.HoekId);

            // Blank means "nothing special in this corner this time", which is an ordinary answer and not a text of
            // nothing. It removes what was there, so emptying the field is how she takes a verrijking back.
            if (string.IsNullOrWhiteSpace(regel.Tekst))
            {
                if (huidige is not null)
                {
                    _db.Hoekverrijkingen.Remove(huidige);
                }
            }
            else if (huidige is null)
            {
                _db.Hoekverrijkingen.Add(new Hoekverrijking(regel.HoekId, venster.Id, regel.Tekst));
            }
            else
            {
                huidige.Wijzig(regel.Tekst);
            }
        }

        await _db.SaveChangesAsync(cancellationToken);

        return (await WeergaveAsync([venster], cancellationToken)).FirstOrDefault()
            ?? throw new SchoolcontentNietGevondenFout($"Subthema {venster.SubthemaId} is niet gevonden.");
    }

    public async Task<int> TelVoorSubthemaAsync(Guid subthemaId, CancellationToken cancellationToken = default) =>
        await _db.Hoekverrijkingen.CountAsync(
            v => _db.Subthemaplaatsingen.Any(p => p.Id == v.SubthemaplaatsingId && p.SubthemaId == subthemaId),
            cancellationToken);

    /// <summary>The windows in the plan of one klas. A klas has one plan, but nothing here needs to assume it.</summary>
    private IQueryable<Subthemaplaatsing> VanKlas(Guid klasId) =>
        _db.Subthemaplaatsingen.Where(p => _db.Jaarplannen.Any(j => j.Id == p.JaarplanId && j.KlasId == klasId));

    /// <summary>
    /// A stored window, found only inside this klas's plan. A window of another klas is "not found" rather than
    /// refused: the route names a klas, and nothing outside its plan is reachable through it.
    /// </summary>
    private async Task<Subthemaplaatsing> VensterVanKlasAsync(Guid klasId, Guid periodeId, CancellationToken cancellationToken) =>
        await VanKlas(klasId).FirstOrDefaultAsync(p => p.Id == periodeId, cancellationToken)
        ?? throw new SchoolcontentNietGevondenFout($"Subthemaperiode {periodeId} is niet gevonden.");

    /// <summary>
    /// The window for a subthema the agenda drew from its activiteiten alone, stored now as the agenda drew it (owner,
    /// 2026-09-15).
    /// <para>
    /// <b>An existing window of the same subthema over any of these days is used, never moved.</b> Storing through
    /// <c>PlaatsSubthema</c> MOVES an overlapping window to the new days, which is right for the planner, where she is
    /// saying "these days instead", and wrong here, where she only wrote about a corner: a window that reaches into
    /// this stretch from the previous themaperiode would jump, with every verrijking on it. So it is looked for first.
    /// </para>
    /// </summary>
    private async Task<Subthemaplaatsing> LegVensterVastAsync(
        Guid klasId,
        HoekverrijkingenInvoer invoer,
        CancellationToken cancellationToken)
    {
        if (invoer.SubthemaId is not { } subthemaId || invoer.Van is not { } van || invoer.Tot is not { } tot)
        {
            throw new SchoolcontentValidatieFout("Kies het subthema en de dagen waarvoor je de verrijkingen bewaart.");
        }

        if (tot < van)
        {
            throw new SchoolcontentValidatieFout("De laatste dag van een subthemaperiode kan niet voor de eerste dag liggen.");
        }

        var bestaand = await ZoekVensterAsync(klasId, subthemaId, van, tot, cancellationToken);
        if (bestaand is not null)
        {
            return bestaand;
        }

        await _weekplanning.PlaatsSubthemaAsync(klasId, subthemaId, van, tot, cancellationToken);

        // Read back over the same days. The planner route clamps them into the school year, so the stored window may be
        // shorter than asked, but it shares a day with what was asked, and it is the only window of this subthema that
        // does: an overlapping one would have been found above.
        return await ZoekVensterAsync(klasId, subthemaId, van, tot, cancellationToken)
            ?? throw new InvalidOperationException(
                $"The window for subthema {subthemaId} in klas {klasId} was stored but cannot be read back.");
    }

    private async Task<Subthemaplaatsing?> ZoekVensterAsync(
        Guid klasId,
        Guid subthemaId,
        DateOnly van,
        DateOnly tot,
        CancellationToken cancellationToken) =>
        await VanKlas(klasId)
            .Where(p => p.SubthemaId == subthemaId && p.Van <= tot && p.Tot >= van)
            .OrderBy(p => p.Van)
            .FirstOrDefaultAsync(cancellationToken);

    /// <summary>
    /// The windows with their subthema's name and their verrijkingen. A window whose subthema cannot be resolved is
    /// dropped rather than listed nameless, as the weekplanning drops it; unreachable while the FK cascades.
    /// </summary>
    private async Task<List<SubthemaperiodeVerrijkingen>> WeergaveAsync(
        IReadOnlyList<Subthemaplaatsing> vensters,
        CancellationToken cancellationToken)
    {
        var vensterIds = vensters.Select(v => v.Id).ToList();
        var verrijkingen = await _db.Hoekverrijkingen
            .AsNoTracking()
            .Where(v => vensterIds.Contains(v.SubthemaplaatsingId))
            .ToListAsync(cancellationToken);

        var subthemaIds = vensters.Select(v => v.SubthemaId).Distinct().ToList();
        var namen = await _db.Subthemas
            .AsNoTracking()
            .Where(s => subthemaIds.Contains(s.Id))
            .ToDictionaryAsync(s => s.Id, s => s.Naam, cancellationToken);

        return vensters
            .Where(v => namen.ContainsKey(v.SubthemaId))
            .Select(v => new SubthemaperiodeVerrijkingen(
                v.Id,
                v.SubthemaId,
                namen[v.SubthemaId],
                v.Van,
                v.Tot,
                verrijkingen
                    .Where(r => r.SubthemaplaatsingId == v.Id)
                    .Select(r => new HoekverrijkingWeergave(r.Id, r.HoekId, r.Tekst))
                    .ToList()))
            .ToList();
    }

    private async Task BevestigKlasAsync(Guid klasId, CancellationToken cancellationToken)
    {
        if (!await _db.Klassen.AnyAsync(k => k.Id == klasId, cancellationToken))
        {
            throw new SchoolcontentNietGevondenFout($"Klas {klasId} is niet gevonden.");
        }
    }
}
