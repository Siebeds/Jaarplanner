using Jaarplanner.Application.Kat;
using Jaarplanner.Application.Schoolcontent.Beheer;
using Jaarplanner.Application.Toegang;
using Jaarplanner.Domain.Kat;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Jaarplanner.Infrastructure.Kat;

/// <summary>
/// What the cat brought one gebruiker (TB-057, ADR-0059 K4, D2, D3).
/// <para>
/// <b>Every row is checked against <see cref="Rechtenmatrix"/>, not against a copy of it.</b> The queries below
/// pre-filter on the rights snapshot so the deurmat does not load every proposal in the school, but the filter never
/// decides: what survives it is put to <see cref="Rechtenmatrix.StaatToe"/> one by one, which is the only place that
/// says yes. A coarse filter that is wrong therefore hides rows; it can never show one.
/// </para>
/// <para>
/// <b>A signal is re-derived before it is shown</b> (D2). The stored row says a thing was noticed and what she did
/// with it; whether it is still true, and what it says, comes from running the detectors again now.
/// </para>
/// </summary>
public sealed class DeurmatService : IDeurmatService
{
    private readonly AppDbContext _context;
    private readonly IRechtenService _rechten;
    private readonly ISignaalopslag _opslag;
    private readonly IKatklassenlezer _klassen;
    private readonly Signaalronde _ronde;
    private readonly TimeProvider _tijd;
    private readonly ILogger<DeurmatService> _logger;

    public DeurmatService(
        AppDbContext context,
        IRechtenService rechten,
        ISignaalopslag opslag,
        IKatklassenlezer klassen,
        Signaalronde ronde,
        TimeProvider tijd,
        ILogger<DeurmatService> logger)
    {
        _context = context;
        _rechten = rechten;
        _opslag = opslag;
        _klassen = klassen;
        _ronde = ronde;
        _tijd = tijd;
        _logger = logger;
    }

    public async Task<Deurmat> HaalAsync(Guid gebruikerId, CancellationToken ct)
    {
        var rechten = await _rechten.HaalRechtenOpAsync(gebruikerId, ct);
        var signalen = await HaalSignalenAsync(gebruikerId, ct);
        var voorstellen = await HaalVoorstellenAsync(rechten, ct);
        return new Deurmat(signalen, voorstellen);
    }

    public async Task MarkeerGezienAsync(Guid gebruikerId, Guid signaalId, CancellationToken ct)
    {
        var signaal = await HaarSignaalAsync(gebruikerId, signaalId, ct);
        signaal.MarkeerGezien(_tijd.GetUtcNow());
        await _opslag.BewaarWijzigingAsync(signaal, ct);
    }

    public async Task StelUitAsync(Guid gebruikerId, Guid signaalId, CancellationToken ct)
    {
        var signaal = await HaarSignaalAsync(gebruikerId, signaalId, ct);
        signaal.StelUit(await VolgendeSchooldagAsync(signaal.KlasId, ct));
        await _opslag.BewaarWijzigingAsync(signaal, ct);
    }

    private async Task<Signaal> HaarSignaalAsync(Guid gebruikerId, Guid signaalId, CancellationToken ct)
    {
        var signaal = await _opslag.HaalAsync(signaalId, ct);

        // A signal addressed to someone else is answered as a missing one: 404 before 403, so the deurmat never
        // reveals that a signal she may not see exists.
        return signaal is not null && signaal.OntvangerId == gebruikerId
            ? signaal
            : throw new SchoolcontentNietGevondenFout($"Signaal {signaalId} bestaat niet.");
    }

    /// <summary>The day a postponed signal comes back: the klas's next schooldag, or tomorrow outside a schooljaar.</summary>
    private async Task<DateOnly> VolgendeSchooldagAsync(Guid klasId, CancellationToken ct)
    {
        var vandaag = Schoolklok.Vandaag(_tijd, _logger);
        var schooljaarId = await _context.Klassen.AsNoTracking()
            .Where(k => k.Id == klasId)
            .Select(k => k.SchooljaarId)
            .FirstOrDefaultAsync(ct);

        // The closures are an owned collection, so they come with the year; loading it without them would yield a
        // year with no vacations and a "next schooldag" in the middle of one.
        var schooljaar = await _context.Schooljaren.AsNoTracking()
            .FirstOrDefaultAsync(j => j.Id == schooljaarId, ct);

        if (schooljaar is null)
        {
            return vandaag.AddDays(1);
        }

        // From tomorrow: Themakalender answers "on or after", and "Later" on a schooldag must not mean "today".
        var kalender = new Themakalender(schooljaar);
        return kalender.VolgendeSchooldag(vandaag.AddDays(1)) ?? vandaag.AddDays(1);
    }

    /// <summary>
    /// Whether a soort is the cat's own bookkeeping rather than something it tells her.
    /// <para>
    /// <see cref="Signaalsoort.Aanbodgat"/> is the one: its row exists so the tick asks the AI once per thema
    /// placement (ADR-0060 G3), and what the cat brings for it are the activiteitvoorstellen below. Showing the signal
    /// too would say "this discipline has a gap" even when the AI found nothing that fits, which FR-14.8 and G4
    /// answer with silence.
    /// </para>
    /// </summary>
    private static bool IsStilleSoort(Signaalsoort soort) => soort == Signaalsoort.Aanbodgat;

    private async Task<IReadOnlyList<Deurmatsignaal>> HaalSignalenAsync(Guid gebruikerId, CancellationToken ct)
    {
        var opgeslagen = await _opslag.HaalVoorOntvangerAsync(gebruikerId, ct);
        var vandaag = Schoolklok.Vandaag(_tijd, _logger);
        var zichtbaar = opgeslagen.Where(s => s.IsZichtbaarOp(vandaag) && !IsStilleSoort(s.Soort)).ToList();
        if (zichtbaar.Count == 0)
        {
            return [];
        }

        var klasIds = zichtbaar.Select(s => s.KlasId).ToHashSet();
        var watchlist = (await _klassen.HaalKlassenAsync(ct)).Where(k => klasIds.Contains(k.KlasId)).ToList();
        var namen = await _context.Klassen.AsNoTracking()
            .Where(k => klasIds.Contains(k.Id))
            .ToDictionaryAsync(k => k.Id, k => k.Naam, ct);

        // Re-derive, per klas, what is true now. A stored signal whose finding is gone is not shown; the next tick
        // removes the row (D2).
        var vers = new Dictionary<(Signaalsoort, Guid, string), Signaalvondst>();
        foreach (var klas in watchlist)
        {
            foreach (var vondst in await _ronde.DetecteerAsync(klas, vandaag, ct))
            {
                vers[vondst.Kenmerk] = vondst;
            }
        }

        return zichtbaar
            .Select(s => (Signaal: s, Vondst: vers.GetValueOrDefault((s.Soort, s.KlasId, s.Sleutel))))
            .Where(p => p.Vondst is not null && p.Vondst.OntvangerIds.Contains(gebruikerId))
            .OrderByDescending(p => p.Signaal.Aangemaakt)
            .Select(p => new Deurmatsignaal(
                p.Signaal.Id,
                p.Signaal.Soort,
                p.Signaal.KlasId,
                namen.GetValueOrDefault(p.Signaal.KlasId, string.Empty),
                p.Vondst!.Gegevens,
                p.Vondst.Verwijzing,
                p.Signaal.Aangemaakt,
                p.Signaal.GezienOp is not null))
            .ToList();
    }

    private async Task<IReadOnlyList<Deurmatvoorstel>> HaalVoorstellenAsync(Rechten rechten, CancellationToken ct)
    {
        var voorstellen = new List<Deurmatvoorstel>();
        voorstellen.AddRange(await HaalActiviteitvoorstellenAsync(rechten, ct));
        voorstellen.AddRange(await HaalSubdoelvoorstellenAsync(rechten, ct));
        voorstellen.AddRange(await HaalSubthemavoorstellenAsync(rechten, ct));
        voorstellen.AddRange(await HaalMinimumdoelsuggestiesAsync(rechten, ct));
        return voorstellen;
    }

    private async Task<IEnumerable<Deurmatvoorstel>> HaalActiviteitvoorstellenAsync(Rechten rechten, CancellationToken ct)
    {
        var eigenKlassen = rechten.EigenKlasIds;
        var kandidaten = await (
                from voorstel in _context.Activiteitvoorstellen.AsNoTracking()
                where voorstel.Status == KoppelingStatus.Voorgesteld
                      && (rechten.IsAdmin
                          || voorstel.GebruikerId == rechten.GebruikerId
                          || (voorstel.KlasId != null && eigenKlassen.Contains(voorstel.KlasId.Value)))
                join subthema in _context.Subthemas on voorstel.SubthemaId equals subthema.Id
                select new
                {
                    voorstel.Id,
                    voorstel.Naam,
                    voorstel.AiMotivatie,
                    voorstel.GebruikerId,
                    voorstel.KlasId,
                    subthema.Leeftijd,
                    voorstel.SubthemaId,
                    subthema.ThemaId,
                    voorstel.Datum,
                    voorstel.Begin,
                    voorstel.Einde,
                })
            .ToListAsync(ct);

        var klasIds = kandidaten.Where(k => k.KlasId is not null).Select(k => k.KlasId!.Value).ToHashSet();
        var klasnamen = klasIds.Count == 0
            ? []
            : await _context.Klassen.AsNoTracking()
                .Where(k => klasIds.Contains(k.Id))
                .ToDictionaryAsync(k => k.Id, k => k.Naam, ct);

        return kandidaten
            .Where(k => Rechtenmatrix.StaatToe(
                rechten,
                Rechtenmatrix.ActiviteitvoorstelBeslissen,
                new Activiteitvoorstelbron(k.Id, k.Leeftijd, k.GebruikerId, k.KlasId)))
            .Select(k => new Deurmatvoorstel(
                Deurmatvoorstelsoort.Activiteitvoorstel,
                k.Id,
                k.Naam,
                // One the cat brought is decided where the cat shows it (FB-071): it belongs to a klas and a day, not
                // to its subthema, which would show it without either. A subthema is a chapter of its thema's page,
                // opened by the query.
                k.KlasId is null ? $"/themas/{k.ThemaId}?subthema={k.SubthemaId}" : null,
                k.AiMotivatie,
                k.KlasId is { } klasId ? klasnamen.GetValueOrDefault(klasId) : null,
                k.KlasId is null ? null : k.Datum,
                k.KlasId is null ? null : k.Begin,
                k.KlasId is null ? null : k.Einde));
    }

    private async Task<IEnumerable<Deurmatvoorstel>> HaalSubdoelvoorstellenAsync(Rechten rechten, CancellationToken ct)
    {
        var kandidaten = await _context.Subdoelvoorstellen.AsNoTracking()
            .Where(v => v.Status == KoppelingStatus.Voorgesteld
                        && (rechten.IsAdmin || rechten.HoofdleerkrachtLeeftijden.Contains(v.Leeftijd)))
            .Select(v => new { v.Id, v.LeerplandoelCode, v.AiMotivatie, v.Leeftijd, v.ThemaId })
            .ToListAsync(ct);

        return kandidaten
            .Where(k => Rechtenmatrix.StaatToe(rechten, Rechtenmatrix.SubdoelplaatsingBeslissen, new Leeftijdsinhoud(k.Leeftijd)))
            .Select(k => new Deurmatvoorstel(
                Deurmatvoorstelsoort.Subdoelvoorstel,
                k.Id,
                k.LeerplandoelCode,
                $"/themas/{k.ThemaId}",
                k.AiMotivatie));
    }

    private async Task<IEnumerable<Deurmatvoorstel>> HaalSubthemavoorstellenAsync(Rechten rechten, CancellationToken ct)
    {
        var kandidaten = await _context.Subthemavoorstellen.AsNoTracking()
            .Where(v => v.Status == KoppelingStatus.Voorgesteld
                        && (rechten.IsAdmin || rechten.HoofdleerkrachtLeeftijden.Contains(v.Leeftijd)))
            .Select(v => new { v.Id, v.Naam, v.AiMotivatie, v.Leeftijd, v.ThemaId })
            .ToListAsync(ct);

        return kandidaten
            .Where(k => Rechtenmatrix.StaatToe(rechten, Rechtenmatrix.SubdoelplaatsingBeslissen, new Leeftijdsinhoud(k.Leeftijd)))
            .Select(k => new Deurmatvoorstel(
                Deurmatvoorstelsoort.Subthemavoorstel,
                k.Id,
                k.Naam,
                $"/themas/{k.ThemaId}",
                k.AiMotivatie));
    }

    private async Task<IEnumerable<Deurmatvoorstel>> HaalMinimumdoelsuggestiesAsync(Rechten rechten, CancellationToken ct)
    {
        // A resource-free row: nobody but themabeheer and admin passes it, so nobody else is queried for.
        if (!Rechtenmatrix.StaatToe(rechten, Rechtenmatrix.DoelsuggestiesBeoordelen, bron: null))
        {
            return [];
        }

        var kandidaten = await _context.Minimumdoelsuggesties.AsNoTracking()
            .Where(s => s.Status == KoppelingStatus.Voorgesteld)
            .OrderBy(s => s.Rang)
            .Select(s => new { s.Id, s.MinimumdoelRef, s.AiMotivatie, s.ThemaId })
            .ToListAsync(ct);

        return kandidaten.Select(k => new Deurmatvoorstel(
            Deurmatvoorstelsoort.Minimumdoelsuggestie,
            k.Id,
            k.MinimumdoelRef,
            $"/themas/{k.ThemaId}",
            k.AiMotivatie));
    }
}
