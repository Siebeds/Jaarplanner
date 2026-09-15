using Jaarplanner.Application.Toegang;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Jaarplanner.Infrastructure.Toegang;

/// <summary>
/// EF Core implementation of <see cref="IRechtenService"/>: loads a gebruiker's rights facts in three reads and hands
/// them to <see cref="Rechtenberekening"/> with today's date on the school's clock (<see cref="Schoolklok"/>).
/// <para>
/// <b>Remembered for this instance only</b>, which is one request (scoped). One request may ask several matrix rows,
/// and each would otherwise read the same rows again; the next request reads afresh, so a right directie changes
/// applies at once, as ADR-0031 wanted when it kept rights out of the cookie. A request that changes a right and then
/// asks for it must not use this instance's earlier answer; none does today.
/// </para>
/// </summary>
public sealed class RechtenService : IRechtenService
{
    private readonly AppDbContext _context;
    private readonly TimeProvider _tijd;
    private readonly ILogger<RechtenService> _logger;
    private readonly Dictionary<Guid, Rechten> _gelezen = [];

    /// <param name="logger">Where <see cref="Schoolklok"/> reports a host without the school's time zone.</param>
    public RechtenService(AppDbContext context, TimeProvider tijd, ILogger<RechtenService> logger)
    {
        _context = context;
        _tijd = tijd;
        _logger = logger;
    }

    public async Task<Rechten> HaalRechtenOpAsync(Guid gebruikerId, CancellationToken cancellationToken = default)
    {
        if (_gelezen.TryGetValue(gebruikerId, out var bekend))
        {
            return bekend;
        }

        var gebruiker = await _context.Gebruikers
            .AsNoTracking()
            .Where(g => g.Id == gebruikerId)
            .Select(g => new { g.IsDirectie, g.HeeftThemabeheer, g.HeeftLeerlingzorg })
            .SingleOrDefaultAsync(cancellationToken);

        if (gebruiker is null)
        {
            return Rechten.Geen(gebruikerId);
        }

        var klastoewijzingen = await (
                from toewijzing in _context.Klastoewijzingen.AsNoTracking()
                where toewijzing.GebruikerId == gebruikerId
                join klas in _context.Klassen on toewijzing.KlasId equals klas.Id
                join schooljaar in _context.Schooljaren on klas.SchooljaarId equals schooljaar.Id
                select new KlastoewijzingFeit(klas.Id, klas.Jaarfase, schooljaar.Eind))
            .ToListAsync(cancellationToken);

        var aanstellingen = await (
                from aanstelling in _context.Hoofdleerkrachtaanstellingen.AsNoTracking()
                where aanstelling.GebruikerId == gebruikerId
                join schooljaar in _context.Schooljaren on aanstelling.SchooljaarId equals schooljaar.Id
                select new AanstellingFeit(aanstelling.Jaarfase, schooljaar.Eind))
            .ToListAsync(cancellationToken);

        var rechten = Rechtenberekening.Bereken(
            gebruikerId,
            gebruiker.IsDirectie,
            gebruiker.HeeftThemabeheer,
            klastoewijzingen,
            aanstellingen,
            Schoolklok.Vandaag(_tijd, _logger),
            gebruiker.HeeftLeerlingzorg);

        _gelezen[gebruikerId] = rechten;
        return rechten;
    }
}
