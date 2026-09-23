using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.Application.Kat;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.Infrastructure.Planning;

/// <summary>
/// What already runs in one klas's agenda on a stretch of days: its planned activiteiten, its algemene fiches and its
/// hoeken. Everything the agenda draws as a block.
/// <para>
/// <b>This is not a rule about what may be planned.</b> The agenda lets a teacher put two blocks on the same hour, and
/// nothing here changes that. It answers one question, for the cat: which hour would be free for the activiteit it
/// proposes (FB-070, ADR-0060 G5, D3), and, when she accepts, whether the moment it suggested still is (D4). One place
/// rather than two, so the moment the cat proposes and the moment the acceptance checks cannot mean different things.
/// </para>
/// </summary>
internal static class Klasbezetting
{
    /// <summary>What is taken on each day of <paramref name="van"/>–<paramref name="tot"/>, by day.</summary>
    /// <param name="zonderOpenVoorstellen">
    /// Leave out the open proposals of a weekvoorstel: the ones a new weekvoorstel for these days replaces (FB-027,
    /// ADR-0067 W5). Everyone else counts them as taken, so nothing is proposed over a block on screen.
    /// </param>
    public static async Task<Dictionary<DateOnly, List<Tijdvak>>> HaalAsync(
        AppDbContext context,
        Guid klasId,
        DateOnly van,
        DateOnly tot,
        CancellationToken ct,
        bool zonderOpenVoorstellen = false)
    {
        var activiteiten = await (
                from plaatsing in context.Activiteitplaatsingen.AsNoTracking()
                join jaarplan in context.Jaarplannen.AsNoTracking() on plaatsing.JaarplanId equals jaarplan.Id
                where jaarplan.KlasId == klasId && plaatsing.Datum >= van && plaatsing.Datum <= tot
                    && (!zonderOpenVoorstellen || plaatsing.Status != KoppelingStatus.Voorgesteld)
                select new { plaatsing.Datum, plaatsing.Begin, plaatsing.Einde })
            .ToListAsync(ct);

        var fiches = await (
                from moment in context.AlgemeneFichemomenten.AsNoTracking()
                join plaatsing in context.AlgemeneFicheplaatsingen.AsNoTracking() on moment.PlaatsingId equals plaatsing.Id
                where plaatsing.KlasId == klasId && moment.Datum >= van && moment.Datum <= tot
                select new { moment.Datum, moment.Begin, moment.Einde })
            .ToListAsync(ct);

        var hoeken = await (
                from moment in context.Hoekmomenten.AsNoTracking()
                join plaatsing in context.Hoekplaatsingen.AsNoTracking() on moment.HoekplaatsingId equals plaatsing.Id
                where plaatsing.KlasId == klasId && moment.Datum >= van && moment.Datum <= tot
                select new { moment.Datum, moment.Begin, moment.Einde })
            .ToListAsync(ct);

        return activiteiten.Concat(fiches).Concat(hoeken)
            .GroupBy(m => m.Datum)
            .ToDictionary(g => g.Key, g => g.Select(m => new Tijdvak(m.Begin, m.Einde)).ToList());
    }

    /// <summary>Whether <paramref name="begin"/>–<paramref name="einde"/> on <paramref name="datum"/> is still free.</summary>
    public static async Task<bool> IsVrijAsync(
        AppDbContext context,
        Guid klasId,
        DateOnly datum,
        TimeOnly begin,
        TimeOnly einde,
        CancellationToken ct)
    {
        var bezet = await HaalAsync(context, klasId, datum, datum, ct);
        return !bezet.GetValueOrDefault(datum, []).Any(b => b.Overlapt(begin, einde));
    }
}
