using Jaarplanner.Application.Dekking;
using Jaarplanner.Application.Planning.Generatie;
using Jaarplanner.Domain.Kat;

namespace Jaarplanner.Application.Kat.Detectoren;

/// <summary>
/// "This minimumdoel is not going to be gedekt" (FB-069, ADR-0059 D4): it is in the klas's dekkingsprognose and not
/// gedekt, while the free lesweken left in the schooljaar are fewer than the shortest thema that carries it as a
/// themadoel needs. The teacher is told the doel, that thema and how many lesweken are still free.
/// <para>
/// <b>No AI</b> (K1): every figure here is counted from the klas's own plan and the school's thema's.
/// </para>
/// </summary>
public sealed class MinimumdoelInGevaarDetector : ISignaaldetector
{
    /// <summary>The keys of this soort's message in <c>nl.json</c>.</summary>
    public static class Sleutels
    {
        public const string DoelRef = "doelRef";
        public const string DoelTekst = "doelTekst";
        public const string Thema = "thema";
        public const string ThemaLesweken = "themaLesweken";
        public const string VrijeLesweken = "vrijeLesweken";
    }

    private readonly IJaarplanLezer _plan;
    private readonly IKatplanbron _bron;

    public MinimumdoelInGevaarDetector(IJaarplanLezer plan, IKatplanbron bron)
    {
        _plan = plan;
        _bron = bron;
    }

    public async Task<IReadOnlyList<Signaalvondst>> DetecteerAsync(Katcontext context, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(context);

        var dekking = await context.HaalDekkingAsync(ct);
        var bedreigd = dekking.Minimumdoelen.Where(m => m.Stap == Dekkingsstap.Prognose).ToList();
        if (bedreigd.Count == 0)
        {
            return [];
        }

        var vrij = TelVrijeLesweken(await _plan.HaalJaarplanAsync(context.KlasId, ct), context.Vandaag);
        var dragersPerDoel = (await _bron.HaalThemadragersAsync(ct))
            .GroupBy(d => d.MinimumdoelRef, StringComparer.Ordinal)
            .ToDictionary(g => g.Key, g => g.ToList(), StringComparer.Ordinal);

        var vondsten = new List<Signaalvondst>();
        foreach (var doel in bedreigd)
        {
            // The cheapest way to still cover it: the shortest thema that carries it. A doel in the prognose through
            // something other than a themadoel has no thema to place, and nothing here can help her, so it is silent.
            if (!dragersPerDoel.TryGetValue(doel.Ref, out var dragers) || dragers.Count == 0)
            {
                continue;
            }

            var kortste = dragers.MinBy(d => d.DuurWeken)!;
            if (vrij >= kortste.DuurWeken)
            {
                continue;
            }

            vondsten.Add(new Signaalvondst(
                Signaalsoort.MinimumdoelInGevaar,
                context.KlasId,
                doel.Ref,
                context.OntvangerIds,
                new Dictionary<string, object>(StringComparer.Ordinal)
                {
                    [Sleutels.DoelRef] = doel.Ref,
                    [Sleutels.DoelTekst] = doel.Omschrijving,
                    [Sleutels.Thema] = kortste.ThemaNaam,
                    [Sleutels.ThemaLesweken] = kortste.DuurWeken,
                    [Sleutels.VrijeLesweken] = vrij,
                },
                $"/klassen/{context.KlasId}/jaarplan"));
        }

        return vondsten;
    }

    /// <summary>
    /// The lesweken left in the schooljaar that nothing is aimed at yet: from this week on, every lesweek without a
    /// themaplaatsing.
    /// <para>
    /// <b>A proposed placement occupies its week too.</b> The plan screen already calls such a week "met thema", and
    /// the prognose this doel sits in counts proposed placements as well, so counting them free here would let the cat
    /// contradict both.
    /// </para>
    /// </summary>
    internal static int TelVrijeLesweken(JaarplanWeergave plan, DateOnly vandaag)
    {
        var dezeWeek = Domain.Planning.Themakalender.Maandag(vandaag);
        return plan.Lesweken.Count(w => w.Maandag >= dezeWeek && !w.HeeftThema);
    }
}
