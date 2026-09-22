using Jaarplanner.Application.Planning.Generatie;
using Jaarplanner.Domain.Kat;
using Jaarplanner.Domain.Planning;

namespace Jaarplanner.Application.Kat.Detectoren;

/// <summary>
/// "Plaats subthema ..." (FB-069, ADR-0059 D4): a thema's placement in the klas ends within
/// <see cref="Schooldagenvooraf"/> schooldagen while a subthema of it, at the klas's leeftijd, is not in the agenda.
/// A gepland-gat (Art. XII): the goals are aimed at, but nothing is planned that would cover them.
/// <para>
/// <b>No AI</b> (K1): placements, subthema's and the dekking are all the school's own data.
/// </para>
/// </summary>
public sealed class SubthemaNietGeplandDetector : ISignaaldetector
{
    /// <summary>
    /// How near the end of a thema the warning comes, in schooldagen (ADR-0059 D4). Fixed, not configurable: a knob
    /// nobody turns is a knob that only has to be kept working.
    /// </summary>
    public const int Schooldagenvooraf = 5;

    /// <summary>The keys of this soort's message in <c>nl.json</c>.</summary>
    public static class Sleutels
    {
        public const string Subthema = "subthema";
        public const string Thema = "thema";
        public const string Doelen = "doelen";
        public const string AantalDoelen = "aantalDoelen";
    }

    private readonly IJaarplanLezer _plan;
    private readonly IKatplanbron _bron;

    public SubthemaNietGeplandDetector(IJaarplanLezer plan, IKatplanbron bron)
    {
        _plan = plan;
        _bron = bron;
    }

    public async Task<IReadOnlyList<Signaalvondst>> DetecteerAsync(Katcontext context, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(context);

        if (await _bron.HaalSchooljaarAsync(context.KlasId, ct) is not { } schooljaar)
        {
            return [];
        }

        var kalender = new Themakalender(schooljaar);
        var aflopend = LopenBinnenkortAf(await _plan.HaalJaarplanAsync(context.KlasId, ct), kalender, context.Vandaag);
        if (aflopend.Count == 0)
        {
            return [];
        }

        var subthemas = await _bron.HaalSubthemasAsync(context.KlasId, ct);
        var dekking = await context.HaalDekkingAsync(ct);
        var ongedekt = dekking.Doelen.Where(d => !d.IsGedekt).Select(d => d.Code).ToHashSet(StringComparer.Ordinal);

        var vondsten = new List<Signaalvondst>();
        foreach (var (themaId, themaNaam) in aflopend)
        {
            var open = subthemas.Where(s =>
                s.ThemaId == themaId
                && !s.IsGepland
                // A klas whose leeftijden cannot be derived widens rather than narrows (Art. XIV), the way the
                // dekking does: better a signal about a subthema of another leeftijd than silence about her own.
                && (context.Leeftijden is not { } leeftijden || leeftijden.Contains(s.Leeftijd, StringComparer.Ordinal)));

            foreach (var subthema in open)
            {
                // What it would cover that nothing else does yet. A subthema whose goals are all covered elsewhere is
                // not worth interrupting her for.
                var mist = subthema.Leerplandoelcodes.Where(ongedekt.Contains).Order(StringComparer.Ordinal).ToList();
                if (mist.Count == 0)
                {
                    continue;
                }

                vondsten.Add(new Signaalvondst(
                    Signaalsoort.SubthemaNietGepland,
                    context.KlasId,
                    subthema.SubthemaId.ToString(),
                    context.OntvangerIds,
                    new Dictionary<string, object>(StringComparer.Ordinal)
                    {
                        [Sleutels.Subthema] = subthema.Naam,
                        [Sleutels.Thema] = themaNaam,
                        [Sleutels.Doelen] = mist,
                        [Sleutels.AantalDoelen] = mist.Count,
                    },
                    $"/klassen/{context.KlasId}/agenda"));
            }
        }

        return vondsten;
    }

    /// <summary>
    /// The thema's whose run in this klas ends within <see cref="Schooldagenvooraf"/> schooldagen.
    /// <para>
    /// <b>The end of the run, not of a part.</b> A vacation stores one thema as several placements (ADR-0053), and
    /// the teacher reads the whole run as one thema; warning her when the first part ends would fire in the middle of
    /// a thema that has weeks to go. A stale placement is not a period at all, so it is left out, as the dekking
    /// leaves it out.
    /// </para>
    /// </summary>
    internal static IReadOnlyList<(Guid ThemaId, string ThemaNaam)> LopenBinnenkortAf(
        JaarplanWeergave plan,
        Themakalender kalender,
        DateOnly vandaag) =>
        plan.Plaatsingen
            .Where(p => !p.IsVervallen)
            .GroupBy(p => p.ThemaId)
            .Select(g => new
            {
                ThemaId = g.Key,
                g.First().ThemaNaam,
                Einde = g.Max(p => p.Reeks?.ReeksTot ?? p.Tot),
            })
            .Where(t => t.Einde >= vandaag && kalender.TelSchooldagen(vandaag, t.Einde) <= Schooldagenvooraf)
            .Select(t => (t.ThemaId, t.ThemaNaam))
            .ToList();
}
