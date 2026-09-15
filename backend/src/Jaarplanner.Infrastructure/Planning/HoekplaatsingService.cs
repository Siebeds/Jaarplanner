using Jaarplanner.Application.Planning.Hoeken;
using Jaarplanner.Application.Schoolcontent.Beheer;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.Infrastructure.Planning;

/// <summary>
/// Placing a hoek on the agenda, over EF Core (owner, meeting 2026-08-30).
/// <para>
/// <b>The one piece of real logic is which days get a timetable row.</b> A hoek that runs from 13:30 to 14:20
/// runs then on every day the class is actually in front of the teacher, so the service asks the
/// <c>Schooljaar</c> for its open weekdays and writes one <c>Hoekmoment</c> per day. It does not write one per
/// calendar day: a row on a Saturday, or on the Monday of the herfstvakantie, is a lesson that does not happen.
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
            .Include(p => p.Momenten)
            .OrderBy(p => p.Van)
            .ToListAsync(cancellationToken);

        // The names, in one extra query rather than a join per row. A class has a handful of corners.
        var namen = await _db.Hoeken
            .AsNoTracking()
            .Where(h => h.KlasId == klasId)
            .ToDictionaryAsync(h => h.Id, h => h.Naam, cancellationToken);

        return plaatsingen
            .Select(p => Weergave(p, namen.GetValueOrDefault(p.HoekId, string.Empty)))
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
            // Not a 404: the hoek exists, it is just in another classroom. Saying so lets the screen explain itself
            // instead of claiming the corner was deleted.
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

            // Every placement gets its rows (owner, 2026-09-11: "elke hoek moet een tijdstip krijgen"), so a window
            // without a single teaching day in it would make a corner with nowhere to appear. Checked after the
            // window itself, so a window that runs backwards is told that rather than this.
            var dagen = schooljaar.OpenWeekdagen(invoer.Van, invoer.Tot);
            if (dagen.Count == 0)
            {
                throw new SchoolcontentValidatieFout(
                    "In die periode valt geen enkele schooldag, dus de hoek kan er nergens staan. Kies andere dagen.");
            }

            foreach (var dag in dagen)
            {
                plaatsing.PlanIn(dag, invoer.Begin, invoer.Einde);
            }
        }
        catch (ArgumentException fout)
        {
            throw new SchoolcontentValidatieFout(fout.Message);
        }

        _db.Hoekplaatsingen.Add(plaatsing);
        await _db.SaveChangesAsync(cancellationToken);

        return Weergave(plaatsing, hoek.Naam);
    }

    public async Task VerwijderAsync(Guid plaatsingId, CancellationToken cancellationToken = default)
    {
        // The rows are LOADED so EF deletes them itself, rather than left to the database's own ON DELETE CASCADE.
        // Both would work against PostgreSQL; only this one works everywhere, and the difference showed up
        // immediately: the in-memory provider does not enforce a cascade, so the first version left the
        // uurroosterrijen behind and its own test caught it. Depending on the provider to finish a delete is
        // depending on the provider to define what the delete means.
        var plaatsing = await _db.Hoekplaatsingen
            .Include(p => p.Momenten)
            .FirstOrDefaultAsync(p => p.Id == plaatsingId, cancellationToken)
            ?? throw new SchoolcontentNietGevondenFout($"Hoekplaatsing {plaatsingId} is niet gevonden.");

        // Nothing is refused here: unlike an activiteit on a Tuesday, none of this is a record of teaching that
        // happened. The corner's verrijkingen are not touched: they belong to the hoek and the subthema (FB-020).
        _db.Hoekplaatsingen.Remove(plaatsing);
        await _db.SaveChangesAsync(cancellationToken);
    }

    public async Task<HoekplaatsingWeergave> VerplaatsMomentAsync(
        Guid plaatsingId,
        Guid momentId,
        DateOnly datum,
        TimeOnly begin,
        TimeOnly einde,
        CancellationToken cancellationToken = default)
    {
        var plaatsing = await VoorWijzigingAsync(plaatsingId, cancellationToken);

        // The school year decides which days are open, as it does in PlaatsAsync. No Include for the closures: they
        // are owned by the Schooljaar and load with it.
        var klas = await _db.Klassen.FirstOrDefaultAsync(k => k.Id == plaatsing.KlasId, cancellationToken)
            ?? throw new SchoolcontentNietGevondenFout($"Klas {plaatsing.KlasId} is niet gevonden.");
        var schooljaar = await _db.Schooljaren.FirstOrDefaultAsync(j => j.Id == klas.SchooljaarId, cancellationToken)
            ?? throw new SchoolcontentNietGevondenFout($"Schooljaar {klas.SchooljaarId} is niet gevonden.");

        // The domain owns the day, time and uniqueness rules and says them in Dutch; this only turns them into
        // the app's own fault type so the shared handler answers 400 instead of 500.
        bool gevonden;
        try
        {
            gevonden = plaatsing.VerplaatsMoment(momentId, datum, begin, einde, schooljaar);
        }
        catch (ArgumentException fout)
        {
            throw new SchoolcontentValidatieFout(fout.Message);
        }

        if (!gevonden)
        {
            throw new SchoolcontentNietGevondenFout($"Hoekmoment {momentId} is niet gevonden.");
        }

        return await BewaarAsync(plaatsing, cancellationToken);
    }

    public async Task<HoekplaatsingWeergave> ZetUrenAsync(
        Guid plaatsingId,
        TimeOnly begin,
        TimeOnly einde,
        CancellationToken cancellationToken = default)
    {
        var plaatsing = await VoorWijzigingAsync(plaatsingId, cancellationToken);

        try
        {
            plaatsing.ZetUren(begin, einde);
        }
        catch (ArgumentException fout)
        {
            throw new SchoolcontentValidatieFout(fout.Message);
        }

        return await BewaarAsync(plaatsing, cancellationToken);
    }

    /// <summary>
    /// One placement, with its timetable rows loaded, ready to be changed. The aggregate checks its invariants over
    /// the rows it holds, so a half-loaded graph would let a check pass on a row it could not see.
    /// </summary>
    private async Task<Hoekplaatsing> VoorWijzigingAsync(Guid plaatsingId, CancellationToken cancellationToken) =>
        await _db.Hoekplaatsingen
            .Include(p => p.Momenten)
            .FirstOrDefaultAsync(p => p.Id == plaatsingId, cancellationToken)
        ?? throw new SchoolcontentNietGevondenFout($"Hoekplaatsing {plaatsingId} is niet gevonden.");

    /// <summary>Saves a changed placement and answers with it, name and all.</summary>
    private async Task<HoekplaatsingWeergave> BewaarAsync(
        Hoekplaatsing plaatsing,
        CancellationToken cancellationToken)
    {
        await _db.SaveChangesAsync(cancellationToken);

        var naam = await _db.Hoeken
            .Where(h => h.Id == plaatsing.HoekId)
            .Select(h => h.Naam)
            .FirstOrDefaultAsync(cancellationToken)
            ?? throw new SchoolcontentNietGevondenFout($"Hoek {plaatsing.HoekId} is niet gevonden.");

        return Weergave(plaatsing, naam);
    }

    /// <summary>
    /// One placement as the agenda reads it.
    /// <para>
    /// Ordered by day and then by start time, so two appearances on one day come back in the order they are
    /// taught rather than in insertion order, which after a move is no longer the same thing.
    /// </para>
    /// </summary>
    private static HoekplaatsingWeergave Weergave(Hoekplaatsing plaatsing, string hoekNaam) =>
        new(
            plaatsing.Id,
            plaatsing.HoekId,
            hoekNaam,
            plaatsing.Van,
            plaatsing.Tot,
            plaatsing.Momenten
                .OrderBy(m => m.Datum)
                .ThenBy(m => m.Begin)
                .Select(m => new HoekmomentWeergave(m.Id, m.Datum, m.Begin, m.Einde))
                .ToList());

    private async Task BevestigKlasAsync(Guid klasId, CancellationToken cancellationToken)
    {
        if (!await _db.Klassen.AnyAsync(k => k.Id == klasId, cancellationToken))
        {
            throw new SchoolcontentNietGevondenFout($"Klas {klasId} is niet gevonden.");
        }
    }
}
