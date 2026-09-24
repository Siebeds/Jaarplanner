using Jaarplanner.Application.Planning.AlgemeneFiches;
using Jaarplanner.Application.Schoolcontent.Beheer;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.Infrastructure.Planning;

/// <summary>
/// Planning an algemene fiche in the agenda, over EF Core (owner, 2026-09-11).
/// <para>
/// <b>Which days get a row is decided by the domain</b> (<see cref="AlgemeneFicheplaatsing.Herhalingsdagen"/>): the
/// school year's open weekdays first, then the teacher's chosen weekdays. This service only fetches the calendar and
/// checks the two things only it can see: that the fiche is this class's, and that the window lies in its year.
/// </para>
/// </summary>
public sealed class AlgemeneFicheplaatsingService : IAlgemeneFicheplaatsingService
{
    private readonly AppDbContext _db;

    public AlgemeneFicheplaatsingService(AppDbContext db) => _db = db;

    public async Task<IReadOnlyList<AlgemeneFicheplaatsingWeergave>> HaalVoorBereikAsync(
        Guid klasId,
        DateOnly van,
        DateOnly tot,
        CancellationToken cancellationToken = default)
    {
        if (tot < van)
        {
            throw new SchoolcontentValidatieFout("De laatste dag van het bereik kan niet voor de eerste dag liggen.");
        }

        if (!await _db.Klassen.AnyAsync(k => k.Id == klasId, cancellationToken))
        {
            throw new SchoolcontentNietGevondenFout($"Klas {klasId} is niet gevonden.");
        }

        // Overlap, not containment: a turnles planned september to june must appear on a screen showing one week.
        var plaatsingen = await _db.AlgemeneFicheplaatsingen
            .AsNoTracking()
            .Where(p => p.KlasId == klasId && p.Van <= tot && p.Tot >= van)
            .Include(p => p.Momenten)
            .OrderBy(p => p.Van)
            .ToListAsync(cancellationToken);

        var namen = await _db.AlgemeneFiches
            .AsNoTracking()
            .Where(f => f.KlasId == klasId)
            .ToDictionaryAsync(f => f.Id, f => f.Naam, cancellationToken);

        return plaatsingen
            .Select(p => Weergave(p, namen.GetValueOrDefault(p.AlgemeneFicheId, string.Empty)))
            .ToList();
    }

    public async Task<AlgemeneFicheplaatsingWeergave> PlaatsAsync(
        Guid klasId,
        AlgemeneFicheplaatsingInvoer invoer,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(invoer);

        var klas = await _db.Klassen.FirstOrDefaultAsync(k => k.Id == klasId, cancellationToken)
            ?? throw new SchoolcontentNietGevondenFout($"Klas {klasId} is niet gevonden.");

        var fiche = await _db.AlgemeneFiches.FirstOrDefaultAsync(f => f.Id == invoer.AlgemeneFicheId, cancellationToken)
            ?? throw new SchoolcontentNietGevondenFout($"Algemene fiche {invoer.AlgemeneFicheId} is niet gevonden.");

        if (fiche.KlasId != klasId)
        {
            // Not a 404: the fiche exists, it is another class's. Saying so lets the screen explain itself.
            throw new SchoolcontentValidatieFout("Die fiche hoort bij een andere klas.");
        }

        var schooljaar = await _db.Schooljaren.FirstOrDefaultAsync(j => j.Id == klas.SchooljaarId, cancellationToken)
            ?? throw new SchoolcontentNietGevondenFout($"Schooljaar {klas.SchooljaarId} is niet gevonden.");

        if (invoer.Van < schooljaar.Start || invoer.Tot > schooljaar.Eind)
        {
            throw new SchoolcontentValidatieFout("Die periode valt buiten het schooljaar.");
        }

        AlgemeneFicheplaatsing plaatsing;
        try
        {
            plaatsing = new AlgemeneFicheplaatsing(klasId, fiche.Id, invoer.Van, invoer.Tot);

            var dagen = AlgemeneFicheplaatsing.Herhalingsdagen(
                schooljaar,
                invoer.Van,
                invoer.Tot,
                Weekdagen(invoer.Weekdagen));

            foreach (var dag in dagen)
            {
                plaatsing.PlanIn(dag, invoer.Begin, invoer.Einde);
            }
        }
        catch (ArgumentException fout)
        {
            // The domain says it in Dutch; this only makes the shared handler answer 400 instead of 500.
            throw new SchoolcontentValidatieFout(fout.Message);
        }

        _db.AlgemeneFicheplaatsingen.Add(plaatsing);
        await _db.SaveChangesAsync(cancellationToken);

        return Weergave(plaatsing, fiche.Naam);
    }

    public async Task VerwijderAsync(Guid plaatsingId, CancellationToken cancellationToken = default)
    {
        // The occurrences are loaded so EF deletes them itself: the in-memory provider does not enforce a cascade,
        // which is how HoekplaatsingService found out that a delete depending on the provider is not a definition.
        var plaatsing = await _db.AlgemeneFicheplaatsingen
            .Include(p => p.Momenten)
            .FirstOrDefaultAsync(p => p.Id == plaatsingId, cancellationToken)
            ?? throw new SchoolcontentNietGevondenFout($"Plaatsing {plaatsingId} is niet gevonden.");

        _db.AlgemeneFicheplaatsingen.Remove(plaatsing);
        await _db.SaveChangesAsync(cancellationToken);
    }

    public async Task VerwijderMomentAsync(Guid plaatsingId, Guid momentId, CancellationToken cancellationToken = default)
    {
        var plaatsing = await _db.AlgemeneFicheplaatsingen
            .Include(p => p.Momenten)
            .FirstOrDefaultAsync(p => p.Id == plaatsingId, cancellationToken)
            ?? throw new SchoolcontentNietGevondenFout($"Plaatsing {plaatsingId} is niet gevonden.");

        if (!plaatsing.VerwijderMoment(momentId))
        {
            throw new SchoolcontentNietGevondenFout($"Moment {momentId} is niet gevonden.");
        }

        // The last day takes the placement along. Dekking asks whether a placement row exists (EfDekkingOpslag), so an
        // empty one would keep the fiche's goals counting from a period the agenda draws on no day at all.
        if (plaatsing.Momenten.Count == 0)
        {
            _db.AlgemeneFicheplaatsingen.Remove(plaatsing);
        }

        await _db.SaveChangesAsync(cancellationToken);
    }

    public async Task<AlgemeneFicheplaatsingWeergave> VerplaatsMomentAsync(
        Guid plaatsingId,
        Guid momentId,
        DateOnly datum,
        TimeOnly begin,
        TimeOnly einde,
        CancellationToken cancellationToken = default)
    {
        var plaatsing = await _db.AlgemeneFicheplaatsingen
            .Include(p => p.Momenten)
            .FirstOrDefaultAsync(p => p.Id == plaatsingId, cancellationToken)
            ?? throw new SchoolcontentNietGevondenFout($"Plaatsing {plaatsingId} is niet gevonden.");

        // The school year decides which days are open, as it does in PlaatsAsync.
        var klas = await _db.Klassen.FirstOrDefaultAsync(k => k.Id == plaatsing.KlasId, cancellationToken)
            ?? throw new SchoolcontentNietGevondenFout($"Klas {plaatsing.KlasId} is niet gevonden.");
        var schooljaar = await _db.Schooljaren.FirstOrDefaultAsync(j => j.Id == klas.SchooljaarId, cancellationToken)
            ?? throw new SchoolcontentNietGevondenFout($"Schooljaar {klas.SchooljaarId} is niet gevonden.");

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
            throw new SchoolcontentNietGevondenFout($"Moment {momentId} is niet gevonden.");
        }

        await _db.SaveChangesAsync(cancellationToken);

        return Weergave(plaatsing, await FicheNaamAsync(plaatsing, cancellationToken));
    }

    public async Task<AlgemeneFicheplaatsingWeergave> ZetUrenAsync(
        Guid plaatsingId,
        TimeOnly begin,
        TimeOnly einde,
        CancellationToken cancellationToken = default)
    {
        var plaatsing = await _db.AlgemeneFicheplaatsingen
            .Include(p => p.Momenten)
            .FirstOrDefaultAsync(p => p.Id == plaatsingId, cancellationToken)
            ?? throw new SchoolcontentNietGevondenFout($"Plaatsing {plaatsingId} is niet gevonden.");

        try
        {
            plaatsing.ZetUren(begin, einde);
        }
        catch (ArgumentException fout)
        {
            throw new SchoolcontentValidatieFout(fout.Message);
        }

        await _db.SaveChangesAsync(cancellationToken);

        return Weergave(plaatsing, await FicheNaamAsync(plaatsing, cancellationToken));
    }

    public async Task<AlgemeneFicheplaatsingWeergave> ZetMomenttekstAsync(
        Guid plaatsingId,
        Guid momentId,
        string? tekst,
        CancellationToken cancellationToken = default)
    {
        var plaatsing = await _db.AlgemeneFicheplaatsingen
            .Include(p => p.Momenten)
            .FirstOrDefaultAsync(p => p.Id == plaatsingId, cancellationToken)
            ?? throw new SchoolcontentNietGevondenFout($"Plaatsing {plaatsingId} is niet gevonden.");

        bool gevonden;
        try
        {
            gevonden = plaatsing.ZetTekst(momentId, tekst);
        }
        catch (ArgumentException fout)
        {
            throw new SchoolcontentValidatieFout(fout.Message);
        }

        if (!gevonden)
        {
            throw new SchoolcontentNietGevondenFout($"Moment {momentId} is niet gevonden.");
        }

        await _db.SaveChangesAsync(cancellationToken);

        return Weergave(plaatsing, await FicheNaamAsync(plaatsing, cancellationToken));
    }

    private async Task<string> FicheNaamAsync(AlgemeneFicheplaatsing plaatsing, CancellationToken cancellationToken) =>
        await _db.AlgemeneFiches
            .Where(f => f.Id == plaatsing.AlgemeneFicheId)
            .Select(f => f.Naam)
            .FirstOrDefaultAsync(cancellationToken) ?? string.Empty;

    /// <summary>
    /// ISO weekday numbers to <see cref="DayOfWeek"/>. An unknown number is refused here rather than cast, because a
    /// cast of 9 is a DayOfWeek nobody can name; a weekend number passes through so the domain can refuse it with the
    /// sentence it owns.
    /// </summary>
    private static IReadOnlyCollection<DayOfWeek> Weekdagen(IReadOnlyList<int>? nummers)
    {
        if (nummers is null)
        {
            return [];
        }

        if (nummers.Any(n => n is < 1 or > 7))
        {
            throw new SchoolcontentValidatieFout("Onbekende weekdag.");
        }

        return nummers.Select(n => n == 7 ? DayOfWeek.Sunday : (DayOfWeek)n).Distinct().ToList();
    }

    private static AlgemeneFicheplaatsingWeergave Weergave(AlgemeneFicheplaatsing plaatsing, string naam) =>
        new(
            plaatsing.Id,
            plaatsing.AlgemeneFicheId,
            naam,
            plaatsing.Van,
            plaatsing.Tot,
            plaatsing.Momenten
                .OrderBy(m => m.Datum)
                .ThenBy(m => m.Begin)
                .Select(m => new AlgemeneFichemomentWeergave(m.Id, m.Datum, m.Begin, m.Einde, m.Tekst))
                .ToList());
}
