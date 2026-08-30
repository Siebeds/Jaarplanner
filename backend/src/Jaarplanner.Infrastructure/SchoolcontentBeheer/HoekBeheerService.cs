using Jaarplanner.Application.Schoolcontent.Beheer;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.Infrastructure.SchoolcontentBeheer;

/// <summary>
/// CRUD for a class's corners (owner, meeting 2026-08-30), over EF Core.
/// <para>
/// <b>The delete guard is the only interesting thing in here, and it is not optional.</b>
/// <c>hoekplaatsingen</c> has a <c>Restrict</c> foreign key to <c>hoeken</c>, so without a check in front of it
/// a teacher deleting a placed corner gets a raw 23503 as an unhandled 500, on an ordinary action, with no route
/// out. This repository has shipped exactly that once before, with a comment claiming a Dutch refusal that did
/// not exist. So the count is read first and the refusal is a sentence she can act on (Art. II.3).
/// </para>
/// </summary>
public sealed class HoekBeheerService : IHoekBeheerService
{
    private readonly AppDbContext _db;

    public HoekBeheerService(AppDbContext db) => _db = db;

    public async Task<IReadOnlyList<HoekWeergave>> HaalHoekenOpAsync(
        Guid klasId,
        CancellationToken cancellationToken = default)
    {
        await BevestigKlasAsync(klasId, cancellationToken);

        return await LeesAsync(h => h.KlasId == klasId, cancellationToken);
    }

    public async Task<HoekWeergave> MaakHoekAsync(
        Guid klasId,
        HoekInvoer invoer,
        CancellationToken cancellationToken = default)
    {
        await BevestigKlasAsync(klasId, cancellationToken);
        var naam = Keur(invoer);
        await BewaakNaamAsync(klasId, naam, null, cancellationToken);

        var hoek = new Hoek(klasId, naam, invoer.Omschrijving);
        _db.Hoeken.Add(hoek);
        await _db.SaveChangesAsync(cancellationToken);

        // Freshly created, so it is placed nowhere. Said as a literal rather than re-queried.
        return new HoekWeergave(hoek.Id, hoek.KlasId, hoek.Naam, hoek.Omschrijving, 0);
    }

    public async Task<HoekWeergave> WijzigHoekAsync(
        Guid hoekId,
        HoekInvoer invoer,
        CancellationToken cancellationToken = default)
    {
        var hoek = await HaalOpAsync(hoekId, cancellationToken);
        var naam = Keur(invoer);
        await BewaakNaamAsync(hoek.KlasId, naam, hoekId, cancellationToken);

        hoek.Wijzig(naam, invoer.Omschrijving);
        await _db.SaveChangesAsync(cancellationToken);

        var aantal = await _db.Hoekplaatsingen.CountAsync(p => p.HoekId == hoekId, cancellationToken);
        return new HoekWeergave(hoek.Id, hoek.KlasId, hoek.Naam, hoek.Omschrijving, aantal);
    }

    public async Task VerwijderHoekAsync(Guid hoekId, CancellationToken cancellationToken = default)
    {
        var hoek = await HaalOpAsync(hoekId, cancellationToken);

        var geplaatst = await _db.Hoekplaatsingen.CountAsync(p => p.HoekId == hoekId, cancellationToken);
        if (geplaatst > 0)
        {
            // The count and the way out, in one sentence. "Deze hoek is in gebruik" without saying where would
            // leave her hunting through a school year for it.
            throw new SchoolcontentValidatieFout(
                geplaatst == 1
                    ? $"'{hoek.Naam}' staat nog 1 keer in de agenda en kan niet verwijderd worden. Haal die hoek eerst uit de agenda."
                    : $"'{hoek.Naam}' staat nog {geplaatst} keer in de agenda en kan niet verwijderd worden. Haal die hoeken eerst uit de agenda.");
        }

        _db.Hoeken.Remove(hoek);
        await _db.SaveChangesAsync(cancellationToken);
    }

    public async Task<HoekOvername> NeemHoekenOverAsync(
        Guid klasId,
        Guid vanKlasId,
        CancellationToken cancellationToken = default)
    {
        if (klasId == vanKlasId)
        {
            throw new SchoolcontentValidatieFout("Kies een andere klas om hoeken van over te nemen.");
        }

        await BevestigKlasAsync(klasId, cancellationToken);
        await BevestigKlasAsync(vanKlasId, cancellationToken);

        var bron = await _db.Hoeken
            .Where(h => h.KlasId == vanKlasId)
            .OrderBy(h => h.Naam)
            .ToListAsync(cancellationToken);

        // Compared case-insensitively, because "Boekenhoek" and "boekenhoek" are one corner to a teacher and two
        // rows to the unique index. Done in memory over one class's corners, which is a handful of rows, rather
        // than as a translated predicate: `StringComparer.OrdinalIgnoreCase` in LINQ becomes a case-SENSITIVE
        // SQL comparison, which is the trap `KlasBeheerService` records paying for.
        var bestaand = await _db.Hoeken
            .Where(h => h.KlasId == klasId)
            .Select(h => h.Naam)
            .ToListAsync(cancellationToken);
        var aanwezig = new HashSet<string>(bestaand, StringComparer.OrdinalIgnoreCase);

        var overgenomen = new List<HoekWeergave>();
        var overgeslagen = new List<string>();

        foreach (var hoek in bron)
        {
            if (!aanwezig.Add(hoek.Naam))
            {
                overgeslagen.Add(hoek.Naam);
                continue;
            }

            var kopie = hoek.KopieerNaar(klasId);
            _db.Hoeken.Add(kopie);
            overgenomen.Add(new HoekWeergave(kopie.Id, kopie.KlasId, kopie.Naam, kopie.Omschrijving, 0));
        }

        await _db.SaveChangesAsync(cancellationToken);

        return new HoekOvername(overgenomen, overgeslagen);
    }

    /// <summary>The corners matching <paramref name="filter"/>, each with the number of times it is placed.</summary>
    private async Task<IReadOnlyList<HoekWeergave>> LeesAsync(
        System.Linq.Expressions.Expression<Func<Hoek, bool>> filter,
        CancellationToken cancellationToken) =>
        await _db.Hoeken
            .Where(filter)
            .OrderBy(h => h.Naam)
            .Select(h => new HoekWeergave(
                h.Id,
                h.KlasId,
                h.Naam,
                h.Omschrijving,
                _db.Hoekplaatsingen.Count(p => p.HoekId == h.Id)))
            .ToListAsync(cancellationToken);

    private async Task<Hoek> HaalOpAsync(Guid hoekId, CancellationToken cancellationToken) =>
        await _db.Hoeken.FirstOrDefaultAsync(h => h.Id == hoekId, cancellationToken)
        ?? throw new SchoolcontentNietGevondenFout($"Hoek {hoekId} is niet gevonden.");

    private async Task BevestigKlasAsync(Guid klasId, CancellationToken cancellationToken)
    {
        if (!await _db.Klassen.AnyAsync(k => k.Id == klasId, cancellationToken))
        {
            // A 404 rather than an empty list: "this class has no corners" and "this class does not exist" are
            // different facts, and a picker reading the first hides its own control.
            throw new SchoolcontentNietGevondenFout($"Klas {klasId} is niet gevonden.");
        }
    }

    private static string Keur(HoekInvoer invoer)
    {
        if (invoer is null || string.IsNullOrWhiteSpace(invoer.Naam))
        {
            throw new SchoolcontentValidatieFout("Een hoek heeft een naam nodig.");
        }

        return invoer.Naam.Trim();
    }

    /// <summary>
    /// One name per class, checked here so the unique index never has to surface as a 500.
    /// <para>
    /// <c>lower(naam) = lower(@naam)</c>, which is the same choice <c>KlasBeheerService</c> made and for the same
    /// two reasons: a .NET <c>OrdinalIgnoreCase</c> comparer inside a LINQ predicate translates to a
    /// case-SENSITIVE SQL comparison, and <c>EF.Functions.ILike</c> is Npgsql-only, so it would make this method
    /// unreachable from the in-memory provider the service tests run on.
    /// </para>
    /// </summary>
    private async Task BewaakNaamAsync(Guid klasId, string naam, Guid? negeer, CancellationToken cancellationToken)
    {
        var genormaliseerd = naam.ToLower();

        var botst = await _db.Hoeken
            .Where(h => h.KlasId == klasId && (negeer == null || h.Id != negeer))
            .AnyAsync(h => h.Naam.ToLower() == genormaliseerd, cancellationToken);

        if (botst)
        {
            throw new SchoolcontentValidatieFout($"Deze klas heeft al een hoek met de naam '{naam}'.");
        }
    }
}
