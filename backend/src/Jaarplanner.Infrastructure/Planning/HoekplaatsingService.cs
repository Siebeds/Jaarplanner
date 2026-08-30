using Jaarplanner.Application.Planning.Hoeken;
using Jaarplanner.Application.Schoolcontent.Beheer;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.Infrastructure.Planning;

/// <summary>
/// Placing a hoek on the agenda, over EF Core (owner, meeting 2026-08-30).
/// <para>
/// <b>The one piece of real logic is which days get a timetable row.</b> A hoek that takes the third lesuur takes
/// it on every day the class is actually in front of the teacher, so the service asks the <c>Schooljaar</c> for
/// its open weekdays and writes one <c>Hoekmoment</c> per day. It does not write one per calendar day: a row on a
/// Saturday, or on the Monday of the herfstvakantie, is a lesson that does not happen.
/// </para>
/// <para>
/// <b>The hoek must belong to the klas being planned.</b> That check lives here because this is the layer that
/// can read both rows; the domain stores an honest key and does not go looking.
/// </para>
/// </summary>
public sealed class HoekplaatsingService : IHoekplaatsingService
{
    private readonly AppDbContext _db;

    public HoekplaatsingService(AppDbContext db) => _db = db;

    public async Task<IReadOnlyList<HoekplaatsingWeergave>> HaalVoorBereikAsync(
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

        // Overlap, not containment: a hoek running september to june must appear on a screen showing one week of
        // november. Asking for placements that START in the range would draw nothing on almost every screen.
        var plaatsingen = await _db.Hoekplaatsingen
            .AsNoTracking()
            .Where(p => p.KlasId == klasId && p.Van <= tot && p.Tot >= van)
            .Include(p => p.Verrijkingen)
            .Include(p => p.Momenten)
            .OrderBy(p => p.Van)
            .ToListAsync(cancellationToken);

        // The names, in one extra query rather than a join per row. A class has a handful of corners.
        var namen = await _db.Hoeken
            .AsNoTracking()
            .Where(h => h.KlasId == klasId)
            .ToDictionaryAsync(h => h.Id, h => h.Naam, cancellationToken);

        return plaatsingen
            .Select(p => new HoekplaatsingWeergave(
                p.Id,
                p.HoekId,
                namen.GetValueOrDefault(p.HoekId, string.Empty),
                p.Van,
                p.Tot,
                p.Verrijkingen
                    .OrderBy(v => v.Van)
                    .Select(v => new HoekverrijkingWeergave(v.Id, v.Van, v.Tot, v.Tekst))
                    .ToList(),
                p.Momenten
                    .OrderBy(m => m.Datum)
                    .ThenBy(m => m.Volgorde)
                    .Select(m => new HoekmomentWeergave(m.Id, m.Datum, m.Volgorde))
                    .ToList()))
            .ToList();
    }

    public async Task<HoekplaatsingWeergave> PlaatsAsync(
        Guid klasId,
        HoekplaatsingInvoer invoer,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(invoer);

        var klas = await _db.Klassen.FirstOrDefaultAsync(k => k.Id == klasId, cancellationToken)
            ?? throw new SchoolcontentNietGevondenFout($"Klas {klasId} is niet gevonden.");

        var hoek = await _db.Hoeken.FirstOrDefaultAsync(h => h.Id == invoer.HoekId, cancellationToken)
            ?? throw new SchoolcontentNietGevondenFout($"Hoek {invoer.HoekId} is niet gevonden.");

        if (hoek.KlasId != klasId)
        {
            // Not a 404: the hoek exists, it is just in another classroom. Saying so lets the screen explain
            // itself instead of claiming the corner was deleted.
            throw new SchoolcontentValidatieFout("Die hoek hoort bij een andere klas.");
        }

        // No `Include` for the closures: they are an OWNED collection (`SchooljaarConfiguration.OwnsMany`), so
        // EF loads them with the owner and an Include on the projected `Sluitingen` property is rejected outright,
        // because that property is a computed sort over the backing field rather than a navigation.
        var schooljaar = await _db.Schooljaren
            .FirstOrDefaultAsync(j => j.Id == klas.SchooljaarId, cancellationToken)
            ?? throw new SchoolcontentNietGevondenFout($"Schooljaar {klas.SchooljaarId} is niet gevonden.");

        if (invoer.Van < schooljaar.Start || invoer.Tot > schooljaar.Eind)
        {
            throw new SchoolcontentValidatieFout("Die periode valt buiten het schooljaar.");
        }

        // The domain owns the window rule and says it in Dutch; this only turns it into the app's own fault type
        // so the shared handler answers 400 instead of 500.
        Hoekplaatsing plaatsing;
        try
        {
            plaatsing = new Hoekplaatsing(klasId, hoek.Id, invoer.Van, invoer.Tot);

            if (!string.IsNullOrWhiteSpace(invoer.Verrijking))
            {
                // Over the WHOLE window. The sheet asks for one enrichment because that is what a teacher has in
                // mind while dragging; splitting it into sub-windows is what the detail screen is for.
                plaatsing.VoegVerrijkingToe(invoer.Van, invoer.Tot, invoer.Verrijking);
            }

            if (invoer.Lesuur is { } lesuur)
            {
                foreach (var dag in schooljaar.OpenWeekdagen(invoer.Van, invoer.Tot))
                {
                    plaatsing.PlanIn(dag, lesuur);
                }
            }
        }
        catch (ArgumentException fout)
        {
            throw new SchoolcontentValidatieFout(fout.Message);
        }

        _db.Hoekplaatsingen.Add(plaatsing);
        await _db.SaveChangesAsync(cancellationToken);

        return new HoekplaatsingWeergave(
            plaatsing.Id,
            plaatsing.HoekId,
            hoek.Naam,
            plaatsing.Van,
            plaatsing.Tot,
            plaatsing.Verrijkingen.Select(v => new HoekverrijkingWeergave(v.Id, v.Van, v.Tot, v.Tekst)).ToList(),
            plaatsing.Momenten
                .OrderBy(m => m.Datum)
                .Select(m => new HoekmomentWeergave(m.Id, m.Datum, m.Volgorde))
                .ToList());
    }

    public async Task VerwijderAsync(Guid plaatsingId, CancellationToken cancellationToken = default)
    {
        // The children are LOADED so EF deletes them itself, rather than left to the database's own ON DELETE
        // CASCADE. Both would work against PostgreSQL; only this one works everywhere, and the difference showed
        // up immediately: the in-memory provider does not enforce a cascade, so the first version left the
        // verrijkingen and the uurroosterrijen behind and its own test caught it. Depending on the provider to
        // finish a delete is depending on the provider to define what the delete means.
        var plaatsing = await _db.Hoekplaatsingen
            .Include(p => p.Verrijkingen)
            .Include(p => p.Momenten)
            .FirstOrDefaultAsync(p => p.Id == plaatsingId, cancellationToken)
            ?? throw new SchoolcontentNietGevondenFout($"Hoekplaatsing {plaatsingId} is niet gevonden.");

        // Nothing is refused here: unlike an activiteit on a Tuesday, none of this is a record of teaching that
        // happened, and the teacher deleting the run is deleting what she put in it.
        _db.Hoekplaatsingen.Remove(plaatsing);
        await _db.SaveChangesAsync(cancellationToken);
    }

    private async Task BevestigKlasAsync(Guid klasId, CancellationToken cancellationToken)
    {
        if (!await _db.Klassen.AnyAsync(k => k.Id == klasId, cancellationToken))
        {
            throw new SchoolcontentNietGevondenFout($"Klas {klasId} is niet gevonden.");
        }
    }
}
