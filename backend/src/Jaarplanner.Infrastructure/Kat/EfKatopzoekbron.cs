using Jaarplanner.Application.Kat.Chat;
using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.Infrastructure.Kat;

/// <summary>
/// What the cat's chat looks up (FB-031, ADR-0066). Read-only and unfiltered: <see cref="Katopzoeker"/> decides what the
/// gebruiker may see. It reads no pupil data: the ontwikkelingsrapport is nowhere in it.
/// </summary>
public sealed class EfKatopzoekbron : IKatopzoekbron
{
    private readonly AppDbContext _context;

    public EfKatopzoekbron(AppDbContext context) => _context = context;

    public async Task<Katbibliotheek> HaalBibliotheekAsync(CancellationToken cancellationToken = default)
    {
        var themas = await _context.Themas.AsNoTracking()
            .Select(t => new Chatthema(t.Id, t.Naam))
            .ToListAsync(cancellationToken);
        var subthemas = await _context.Subthemas.AsNoTracking()
            .Select(s => new Chatsubthema(s.Id, s.ThemaId, s.Naam, s.Leeftijd))
            .ToListAsync(cancellationToken);
        var activiteiten = await _context.Activiteiten.AsNoTracking()
            .Select(a => new Chatactiviteit(a.Id, a.SubthemaId, a.Naam, a.EigenaarId))
            .ToListAsync(cancellationToken);
        var fiches = await _context.AlgemeneFiches.AsNoTracking()
            .Select(f => new Chatfiche(f.Id, f.KlasId, f.Naam))
            .ToListAsync(cancellationToken);

        var koppelingen = new List<Katkoppeling>();
        koppelingen.AddRange((await _context.Themadoelen.AsNoTracking()
                .Select(d => new { d.ThemaId, d.Koppeling.LeerplandoelCode, d.Koppeling.Status })
                .ToListAsync(cancellationToken))
            .Select(d => new Katkoppeling(Kathouder.Thema, d.ThemaId, d.LeerplandoelCode, Katdoelsoort.Leerplandoel, d.Status)));

        // A minimumdoel themadoel is decided by being there; a suggestion only counts while it waits for a decision:
        // an accepted one is the themadoel above, a rejected one is never named.
        koppelingen.AddRange((await _context.ThemaMinimumdoelen.AsNoTracking()
                .Select(m => new { m.ThemaId, m.MinimumdoelRef })
                .ToListAsync(cancellationToken))
            .Select(m => new Katkoppeling(Kathouder.Thema, m.ThemaId, m.MinimumdoelRef, Katdoelsoort.Minimumdoel, KoppelingStatus.Manueel)));
        koppelingen.AddRange((await _context.Minimumdoelsuggesties.AsNoTracking()
                .Where(s => s.Status == KoppelingStatus.Voorgesteld)
                .Select(s => new { s.ThemaId, s.MinimumdoelRef })
                .ToListAsync(cancellationToken))
            .Select(s => new Katkoppeling(Kathouder.Thema, s.ThemaId, s.MinimumdoelRef, Katdoelsoort.Minimumdoel, KoppelingStatus.Voorgesteld)));

        koppelingen.AddRange((await _context.Subdoelen.AsNoTracking()
                .Select(d => new { d.SubthemaId, d.Koppeling.LeerplandoelCode, d.Koppeling.Status })
                .ToListAsync(cancellationToken))
            .Select(d => new Katkoppeling(Kathouder.Subthema, d.SubthemaId, d.LeerplandoelCode, Katdoelsoort.Leerplandoel, d.Status)));
        koppelingen.AddRange((await _context.Activiteiten.AsNoTracking()
                .SelectMany(a => a.Doelkoppelingen.Select(k => new { ActiviteitId = a.Id, k.LeerplandoelCode, k.Status }))
                .ToListAsync(cancellationToken))
            .Select(k => new Katkoppeling(Kathouder.Activiteit, k.ActiviteitId, k.LeerplandoelCode, Katdoelsoort.Leerplandoel, k.Status)));
        koppelingen.AddRange((await _context.AlgemeneFiches.AsNoTracking()
                .SelectMany(f => f.Doelkoppelingen.Select(k => new { FicheId = f.Id, k.LeerplandoelCode, k.Status }))
                .ToListAsync(cancellationToken))
            .Select(k => new Katkoppeling(Kathouder.AlgemeneFiche, k.FicheId, k.LeerplandoelCode, Katdoelsoort.Leerplandoel, k.Status)));

        return new Katbibliotheek(themas, subthemas, activiteiten, fiches, koppelingen);
    }

    public async Task<IReadOnlyList<Katdoel>> ZoekDoelenAsync(string term, int max, CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(term);
        var gezocht = term.Trim();
        var hoofdletters = gezocht.ToUpperInvariant();

        // A code or a ref names one goal, whatever the case she typed it in.
        var opCode = await _context.Leerplandoelen.AsNoTracking()
            .Where(d => !d.NietMeerInOpstap && d.Code.ToUpper() == hoofdletters)
            .Select(d => new Katdoel(d.Code, Katdoelsoort.Leerplandoel, d.Tekst))
            .ToListAsync(cancellationToken);
        opCode.AddRange(await _context.Minimumdoelen.AsNoTracking()
            .Where(m => !m.NietMeerInOpstap && m.Ref.ToUpper() == hoofdletters)
            .Select(m => new Katdoel(m.Ref, Katdoelsoort.Minimumdoel, m.Omschrijving))
            .ToListAsync(cancellationToken));
        if (opCode.Count > 0)
        {
            return opCode;
        }

        // Otherwise every word of the term in the text, ignoring case. Short words ("de", "en") would match nearly
        // every goal, so only words of three letters or more narrow the search.
        var woorden = gezocht
            .Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries)
            .Select(w => w.Trim('"', '\'', '.', ',', '?', '!', ':', ';', '(', ')'))
            .Where(w => w.Length >= 3)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        if (woorden.Count == 0)
        {
            return [];
        }

        var leerplandoelen = _context.Leerplandoelen.AsNoTracking().Where(d => !d.NietMeerInOpstap);
        var minimumdoelen = _context.Minimumdoelen.AsNoTracking().Where(m => !m.NietMeerInOpstap);
        foreach (var woord in woorden)
        {
            var patroon = "%" + EscapeLike(woord) + "%";
            leerplandoelen = leerplandoelen.Where(d => EF.Functions.ILike(d.Tekst, patroon, "\\"));
            minimumdoelen = minimumdoelen.Where(m => EF.Functions.ILike(m.Omschrijving, patroon, "\\"));
        }

        var gevonden = await minimumdoelen
            .OrderBy(m => m.Ref)
            .Take(max)
            .Select(m => new Katdoel(m.Ref, Katdoelsoort.Minimumdoel, m.Omschrijving))
            .ToListAsync(cancellationToken);
        gevonden.AddRange(await leerplandoelen
            .OrderBy(d => d.Code)
            .Take(max)
            .Select(d => new Katdoel(d.Code, Katdoelsoort.Leerplandoel, d.Tekst))
            .ToListAsync(cancellationToken));

        return gevonden.Take(max).ToList();
    }

    public async Task<IReadOnlyList<Katdoel>> HaalDoelenAsync(IReadOnlyCollection<string> codes, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(codes);
        if (codes.Count == 0)
        {
            return [];
        }

        var lijst = codes.ToList();
        var doelen = await _context.Leerplandoelen.AsNoTracking()
            .Where(d => lijst.Contains(d.Code))
            .Select(d => new Katdoel(d.Code, Katdoelsoort.Leerplandoel, d.Tekst))
            .ToListAsync(cancellationToken);
        doelen.AddRange(await _context.Minimumdoelen.AsNoTracking()
            .Where(m => lijst.Contains(m.Ref))
            .Select(m => new Katdoel(m.Ref, Katdoelsoort.Minimumdoel, m.Omschrijving))
            .ToListAsync(cancellationToken));
        return doelen;
    }

    public async Task<Katagenda> HaalAgendaAsync(IReadOnlyCollection<Guid> klasIds, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(klasIds);
        if (klasIds.Count == 0)
        {
            return Katagenda.Leeg;
        }

        var klassen = klasIds.ToList();

        // The thema placements are owned by the jaarplan, so they come with it. A rejected one is not in the agenda.
        var jaarplannen = await _context.Jaarplannen.AsNoTracking()
            .Where(j => klassen.Contains(j.KlasId))
            .ToListAsync(cancellationToken);
        var klasVan = jaarplannen.ToDictionary(j => j.Id, j => j.KlasId);
        var jaarplanIds = klasVan.Keys.ToList();

        var themas = jaarplannen
            .SelectMany(j => j.Plaatsingen.Where(p => p.IsGepland).Select(p => new Katthemaplaatsing(
                j.KlasId, p.ThemaId, p.Van, p.Tot, p.Status == KoppelingStatus.Voorgesteld)))
            .ToList();
        var subthemas = (await _context.Subthemaplaatsingen.AsNoTracking()
                .Where(p => jaarplanIds.Contains(p.JaarplanId))
                .Select(p => new { p.JaarplanId, p.SubthemaId, p.Van, p.Tot })
                .ToListAsync(cancellationToken))
            .Select(p => new Katsubthemaplaatsing(klasVan[p.JaarplanId], p.SubthemaId, p.Van, p.Tot))
            .ToList();
        var activiteiten = (await _context.Activiteitplaatsingen.AsNoTracking()
                .Where(p => jaarplanIds.Contains(p.JaarplanId))
                .Select(p => new { p.JaarplanId, p.ActiviteitId, p.Datum, p.Status })
                .ToListAsync(cancellationToken))
            .Select(p => new Katactiviteitplaatsing(klasVan[p.JaarplanId], p.ActiviteitId, p.Datum, p.Status == KoppelingStatus.Voorgesteld))
            .ToList();
        var fiches = await _context.AlgemeneFicheplaatsingen.AsNoTracking()
            .Where(p => klassen.Contains(p.KlasId))
            .Select(p => new Katficheplaatsing(p.KlasId, p.AlgemeneFicheId, p.Van, p.Tot))
            .ToListAsync(cancellationToken);

        return new Katagenda(themas, subthemas, activiteiten, fiches);
    }

    private static string EscapeLike(string waarde) =>
        waarde.Replace("\\", "\\\\", StringComparison.Ordinal)
            .Replace("%", "\\%", StringComparison.Ordinal)
            .Replace("_", "\\_", StringComparison.Ordinal);
}
