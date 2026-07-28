using Jaarplanner.Application.Planning;
using Jaarplanner.Domain.Planning;
using Microsoft.Extensions.Options;

namespace Jaarplanner.Infrastructure.Planning;

/// <summary>
/// Configuration-driven <see cref="IPlanningsblokIndeling"/> (ADR-0013 seam, refined by ADR-0020; sibling of
/// <c>GeconfigureerdeDisciplineSelectie</c>).
/// <para>
/// It derives the grid from two inputs and nothing else: the <see cref="Schooljaar"/>'s own teaching
/// stretches (its span minus its vacations) and the target block lengths in
/// <see cref="PlanningsblokOptions"/>. This class contains <b>no</b> compiled-in period length and <b>no</b>
/// calendar unit — no month, no week-of-year, no term name.
/// </para>
/// <para>
/// <b>Even distribution, not greedy chopping.</b> Each teaching stretch is divided into
/// <c>round(stretchdagen / doeldagen)</c> near-equal blocks. The first implementation instead took a full
/// target-length block off the front and left the remainder as its own block, which produced **1-week
/// "themaperioden"** on a real Belgian calendar — outside the 4–6 week range directie ratified on
/// 2026-07-14. Even distribution keeps every block close to the target: on the 2026-2027 calendar it yields
/// 7 themaperioden between 4,4 and 6,0 weeks.
/// </para>
/// <para>
/// <b>Blocks break on vacations.</b> Stretches are chopped independently, so a block never spans a holiday: a
/// themaperiode interrupted by the kerstvakantie would not be one period a teacher can plan a thema into.
/// Consequence: block spans vary, and the grid is pedagogical rather than arithmetic.
/// </para>
/// <para>
/// <b>The fine tier nests inside the coarse one.</b> Subthemaperioden are derived <i>within</i> each
/// themaperiode, never as a second independent chop of the year. An independent chop let a subthemaperiode
/// straddle a themaperiode boundary, which makes "zoom into this period" (E3-08) incoherent and E3-01's
/// "place a thema in a period, its subthema's in that period's subperiods" unimplementable.
/// </para>
/// <para>
/// <b>Known limit (Art. XIV, open).</b> A teaching stretch shorter than roughly two-thirds of the target
/// yields a single block shorter than the ratified range — a 2-week stretch between two closures cannot be
/// made into a 4-week themaperiode. Whether such a stretch should be its own short period, merge into a
/// neighbour across the vacation, or be excluded from planning is a pedagogical question for directie; it is
/// logged as an open decision rather than answered here.
/// </para>
/// </summary>
public sealed class GeconfigureerdePlanningsblokIndeling : IPlanningsblokIndeling
{
    private const int DagenPerWeek = 7;

    private readonly PlanningsblokOptions _opties;

    /// <summary>Constructs the indeling from bound options (DI / options pattern).</summary>
    public GeconfigureerdePlanningsblokIndeling(IOptions<PlanningsblokOptions> opties)
        : this(opties?.Value ?? throw new ArgumentNullException(nameof(opties)))
    {
    }

    /// <summary>
    /// Constructs the indeling directly from options — used by DI (above) and by tests that drive the grain
    /// purely from configuration values, proving the grain is data-driven rather than compiled in.
    /// </summary>
    public GeconfigureerdePlanningsblokIndeling(PlanningsblokOptions opties)
    {
        ArgumentNullException.ThrowIfNull(opties);

        if (opties.ThemaperiodeWeken < 1 || opties.SubthemaperiodeWeken < 1)
        {
            throw new ArgumentException(
                $"Blokindeling vereist een positieve blokduur in weken (gevonden: themaperiode " +
                $"{opties.ThemaperiodeWeken}, subthemaperiode {opties.SubthemaperiodeWeken}). " +
                $"Controleer de configuratiesectie '{PlanningsblokOptions.SectionName}'.",
                nameof(opties));
        }

        if (opties.SubthemaperiodeWeken > opties.ThemaperiodeWeken)
        {
            throw new ArgumentException(
                $"Een subthemaperiode ({opties.SubthemaperiodeWeken} wk) kan niet langer zijn dan een " +
                $"themaperiode ({opties.ThemaperiodeWeken} wk) — de fijne laag verdeelt de grove. " +
                $"Controleer de configuratiesectie '{PlanningsblokOptions.SectionName}'.",
                nameof(opties));
        }

        _opties = opties;
    }

    /// <inheritdoc />
    public IReadOnlyList<Planningsblok> Blokken(Schooljaar schooljaar, Planningsblokniveau niveau)
    {
        ArgumentNullException.ThrowIfNull(schooljaar);

        var themaperiodes = Themaperiodes(schooljaar);
        if (niveau == Planningsblokniveau.Themaperiode)
        {
            return themaperiodes;
        }

        if (niveau != Planningsblokniveau.Subthemaperiode)
        {
            throw new ArgumentOutOfRangeException(nameof(niveau), niveau, "Onbekend planningsblokniveau.");
        }

        // The fine tier subdivides each coarse block, so every subthemaperiode belongs to exactly one
        // themaperiode and none straddles a boundary.
        var doelDagen = _opties.SubthemaperiodeWeken * DagenPerWeek;
        var fijn = new List<Planningsblok>();
        var ordinaal = 1;

        foreach (var themaperiode in themaperiodes)
        {
            foreach (var (start, eind) in VerdeelGelijkmatig(themaperiode.Start, themaperiode.Eind, doelDagen))
            {
                fijn.Add(new Planningsblok(
                    Planningsblokniveau.Subthemaperiode,
                    ordinaal++,
                    start,
                    eind,
                    ouderOrdinaal: themaperiode.Ordinaal));
            }
        }

        return fijn;
    }

    /// <inheritdoc />
    public string Omschrijving =>
        $"themaperiode {_opties.ThemaperiodeWeken} wk, subthemaperiode {_opties.SubthemaperiodeWeken} wk " +
        "(blokken breken op schoolvakanties en worden gelijkmatig over elke lesperiode verdeeld; " +
        "subthemaperiodes verdelen telkens één themaperiode)";

    private IReadOnlyList<Planningsblok> Themaperiodes(Schooljaar schooljaar)
    {
        var doelDagen = _opties.ThemaperiodeWeken * DagenPerWeek;
        var blokken = new List<Planningsblok>();
        var ordinaal = 1;

        foreach (var (periodeStart, periodeEind) in schooljaar.Lesperiodes())
        {
            foreach (var (start, eind) in VerdeelGelijkmatig(periodeStart, periodeEind, doelDagen))
            {
                blokken.Add(new Planningsblok(Planningsblokniveau.Themaperiode, ordinaal++, start, eind));
            }
        }

        return blokken;
    }

    /// <summary>
    /// Divides an inclusive date range into <c>round(dagen / doelDagen)</c> near-equal parts (at least one),
    /// distributing any remainder one day at a time over the leading parts.
    /// <para>
    /// Choosing the <i>count</i> first and then splitting evenly is what keeps every block near the target.
    /// Taking target-length bites off the front instead leaves a short tail whose length is an accident of the
    /// stretch's arithmetic — the defect this replaced.
    /// </para>
    /// </summary>
    private static IEnumerable<(DateOnly Start, DateOnly Eind)> VerdeelGelijkmatig(
        DateOnly start,
        DateOnly eind,
        int doelDagen)
    {
        var dagen = eind.DayNumber - start.DayNumber + 1;
        var aantal = Math.Max(1, (int)Math.Round(dagen / (double)doelDagen, MidpointRounding.AwayFromZero));

        var basis = dagen / aantal;
        var extra = dagen % aantal;
        var cursor = start;

        for (var i = 0; i < aantal; i++)
        {
            var lengte = basis + (i < extra ? 1 : 0);
            var blokEind = cursor.AddDays(lengte - 1);
            yield return (cursor, blokEind);
            cursor = blokEind.AddDays(1);
        }
    }
}
