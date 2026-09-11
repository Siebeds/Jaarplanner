using Jaarplanner.Application.Schoolcontent.Beheer;
using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.Infrastructure.SchoolcontentBeheer;

/// <summary>
/// CRUD for a class's algemene fiches and their goal links (owner, 2026-09-11), over EF Core.
/// <para>
/// <b>Two guards carry the weight here.</b> The delete guard, because <c>algemene_ficheplaatsingen</c> has a Restrict
/// FK to the fiche and a teacher deleting a planned fiche would otherwise get a raw 23503; and the code check on a new
/// link, because a leerplandoel's code is its identity (Art. III.5) and an unknown one is refused, never created.
/// </para>
/// </summary>
public sealed class AlgemeneFicheBeheerService : IAlgemeneFicheBeheerService
{
    private readonly AppDbContext _db;

    public AlgemeneFicheBeheerService(AppDbContext db) => _db = db;

    public async Task<IReadOnlyList<AlgemeneFicheWeergave>> HaalFichesOpAsync(
        Guid klasId,
        CancellationToken cancellationToken = default)
    {
        await BevestigKlasAsync(klasId, cancellationToken);

        var fiches = await _db.AlgemeneFiches
            .AsNoTracking()
            .Where(f => f.KlasId == klasId)
            .OrderBy(f => f.Naam)
            .ToListAsync(cancellationToken);

        return await WeergavenAsync(fiches, cancellationToken);
    }

    public async Task<AlgemeneFicheWeergave> MaakFicheAsync(
        Guid klasId,
        AlgemeneFicheInvoer invoer,
        CancellationToken cancellationToken = default)
    {
        await BevestigKlasAsync(klasId, cancellationToken);
        var naam = Keur(invoer);
        await BewaakNaamAsync(klasId, naam, null, cancellationToken);

        var fiche = new AlgemeneFiche(klasId, naam, invoer.Omschrijving);
        _db.AlgemeneFiches.Add(fiche);
        await _db.SaveChangesAsync(cancellationToken);

        return (await WeergavenAsync([fiche], cancellationToken))[0];
    }

    public async Task<AlgemeneFicheWeergave> WijzigFicheAsync(
        Guid ficheId,
        AlgemeneFicheInvoer invoer,
        CancellationToken cancellationToken = default)
    {
        var fiche = await HaalOpAsync(ficheId, cancellationToken);
        var naam = Keur(invoer);
        await BewaakNaamAsync(fiche.KlasId, naam, ficheId, cancellationToken);

        fiche.Wijzig(naam, invoer.Omschrijving);
        await _db.SaveChangesAsync(cancellationToken);

        return (await WeergavenAsync([fiche], cancellationToken))[0];
    }

    public async Task VerwijderFicheAsync(Guid ficheId, CancellationToken cancellationToken = default)
    {
        var fiche = await HaalOpAsync(ficheId, cancellationToken);

        var gepland = await _db.AlgemeneFicheplaatsingen.CountAsync(p => p.AlgemeneFicheId == ficheId, cancellationToken);
        if (gepland > 0)
        {
            // The count and the way out, in one sentence, like the hoek's refusal beside it.
            throw new SchoolcontentValidatieFout(
                gepland == 1
                    ? $"'{fiche.Naam}' staat nog 1 keer in de agenda en kan niet verwijderd worden. Haal die fiche eerst uit de agenda."
                    : $"'{fiche.Naam}' staat nog {gepland} keer in de agenda en kan niet verwijderd worden. Haal die fiches eerst uit de agenda.");
        }

        _db.AlgemeneFiches.Remove(fiche);
        await _db.SaveChangesAsync(cancellationToken);
    }

    public async Task<AlgemeneFicheWeergave> KoppelAanDoelAsync(
        Guid ficheId,
        string leerplandoelCode,
        CancellationToken cancellationToken = default)
    {
        var fiche = await HaalOpAsync(ficheId, cancellationToken);

        if (string.IsNullOrWhiteSpace(leerplandoelCode))
        {
            throw new SchoolcontentValidatieFout("Een leerdoelcode is verplicht.");
        }

        var code = leerplandoelCode.Trim();
        if (!await _db.Leerplandoelen.AsNoTracking().AnyAsync(l => l.Code == code, cancellationToken))
        {
            // Refused rather than created (Art. III.5). Said without the article number: the teacher linking a goal
            // cannot act on one.
            throw new SchoolcontentValidatieFout($"Er is geen leerdoel met code '{code}'.");
        }

        try
        {
            fiche.KoppelAanDoel(code);
        }
        catch (ArgumentException fout)
        {
            throw new SchoolcontentValidatieFout(fout.Message);
        }

        await _db.SaveChangesAsync(cancellationToken);
        return (await WeergavenAsync([fiche], cancellationToken))[0];
    }

    public async Task<AlgemeneFicheWeergave> OntkoppelDoelAsync(
        Guid ficheId,
        Guid koppelingId,
        CancellationToken cancellationToken = default)
    {
        var fiche = await HaalOpAsync(ficheId, cancellationToken);

        if (!fiche.Ontkoppel(koppelingId))
        {
            throw new SchoolcontentNietGevondenFout(
                "Deze koppeling is er niet meer. Vernieuw de pagina om te zien wat er nu staat.");
        }

        await _db.SaveChangesAsync(cancellationToken);
        return (await WeergavenAsync([fiche], cancellationToken))[0];
    }

    /// <summary>
    /// The given fiches as the screens read them: each with its placement count and its goals, in two extra queries
    /// for the whole list rather than two per fiche.
    /// </summary>
    private async Task<IReadOnlyList<AlgemeneFicheWeergave>> WeergavenAsync(
        IReadOnlyList<AlgemeneFiche> fiches,
        CancellationToken cancellationToken)
    {
        if (fiches.Count == 0)
        {
            return [];
        }

        var ids = fiches.Select(f => f.Id).ToList();
        var aantallen = await _db.AlgemeneFicheplaatsingen
            .AsNoTracking()
            .Where(p => ids.Contains(p.AlgemeneFicheId))
            .GroupBy(p => p.AlgemeneFicheId)
            .Select(g => new { g.Key, Aantal = g.Count() })
            .ToDictionaryAsync(g => g.Key, g => g.Aantal, cancellationToken);

        var codes = fiches.SelectMany(f => f.Doelkoppelingen).Select(k => k.LeerplandoelCode).Distinct().ToList();
        var doelen = codes.Count == 0
            ? []
            : await _db.Leerplandoelen
                .AsNoTracking()
                .Where(l => codes.Contains(l.Code))
                .ToDictionaryAsync(l => l.Code, cancellationToken);

        return fiches
            .Select(f => new AlgemeneFicheWeergave(
                f.Id,
                f.KlasId,
                f.Naam,
                f.Omschrijving,
                aantallen.GetValueOrDefault(f.Id),
                f.Doelkoppelingen
                    // The FK makes a missing leerplandoel impossible for a persisted link; the filter only keeps a
                    // half-saved graph from throwing inside a projection.
                    .Where(k => doelen.ContainsKey(k.LeerplandoelCode))
                    .OrderBy(k => k.LeerplandoelCode, StringComparer.Ordinal)
                    .Select(k =>
                    {
                        var doel = doelen[k.LeerplandoelCode];
                        return new AlgemeneFichedoelWeergave(k.Id, doel.Code, doel.Doelsoort, doel.JaarFase, doel.Tekst);
                    })
                    .ToList()))
            .ToList();
    }

    private async Task<AlgemeneFiche> HaalOpAsync(Guid ficheId, CancellationToken cancellationToken) =>
        await _db.AlgemeneFiches.FirstOrDefaultAsync(f => f.Id == ficheId, cancellationToken)
        ?? throw new SchoolcontentNietGevondenFout($"Algemene fiche {ficheId} is niet gevonden.");

    private async Task BevestigKlasAsync(Guid klasId, CancellationToken cancellationToken)
    {
        if (!await _db.Klassen.AnyAsync(k => k.Id == klasId, cancellationToken))
        {
            throw new SchoolcontentNietGevondenFout($"Klas {klasId} is niet gevonden.");
        }
    }

    private static string Keur(AlgemeneFicheInvoer invoer)
    {
        if (invoer is null || string.IsNullOrWhiteSpace(invoer.Naam))
        {
            throw new SchoolcontentValidatieFout("Een algemene fiche heeft een naam nodig.");
        }

        return invoer.Naam.Trim();
    }

    /// <summary>
    /// One name per class, checked here so the unique index never surfaces as a 500. <c>ToLower</c> on both sides for
    /// the reason <c>HoekBeheerService</c> records: an ordinal-ignore-case comparer translates to a case-SENSITIVE SQL
    /// comparison.
    /// </summary>
    private async Task BewaakNaamAsync(Guid klasId, string naam, Guid? negeer, CancellationToken cancellationToken)
    {
        var genormaliseerd = naam.ToLower();

        var botst = await _db.AlgemeneFiches
            .Where(f => f.KlasId == klasId && (negeer == null || f.Id != negeer))
            .AnyAsync(f => f.Naam.ToLower() == genormaliseerd, cancellationToken);

        if (botst)
        {
            throw new SchoolcontentValidatieFout($"Deze klas heeft al een algemene fiche met de naam '{naam}'.");
        }
    }
}
