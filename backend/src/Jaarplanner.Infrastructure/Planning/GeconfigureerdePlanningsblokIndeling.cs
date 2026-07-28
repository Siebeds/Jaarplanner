using Jaarplanner.Application.Planning;
using Jaarplanner.Domain.Planning;
using Microsoft.Extensions.Options;

namespace Jaarplanner.Infrastructure.Planning;

/// <summary>
/// Configuration-driven <see cref="IPlanningsblokIndeling"/> (ADR-0013 seam; sibling of
/// <c>GeconfigureerdeDisciplineSelectie</c>).
/// <para>
/// It derives the grid from two inputs and nothing else: the <see cref="Schooljaar"/>'s own teaching
/// stretches (its span minus its vacations) and the block lengths in <see cref="PlanningsblokOptions"/>.
/// This class contains <b>no</b> compiled-in period length and <b>no</b> calendar unit — no month, no
/// week-of-year, no term name. Changing the grain is a config edit.
/// </para>
/// <para>
/// <b>Blocks break on vacations.</b> Each teaching stretch is chopped independently, so a block never spans
/// a holiday: a themaperiode interrupted by the kerstvakantie would not be one period a teacher can plan a
/// thema into. A stretch's short remainder is absorbed into its preceding block rather than left as a stub
/// (<see cref="PlanningsblokOptions.MinimumBlokDagen"/>), which is why block spans vary — the grid is
/// pedagogical, not arithmetic.
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

        _opties = opties;
    }

    /// <inheritdoc />
    public IReadOnlyList<Planningsblok> Blokken(Schooljaar schooljaar, Planningsblokniveau niveau)
    {
        ArgumentNullException.ThrowIfNull(schooljaar);

        var blokDagen = WekenVoor(niveau) * DagenPerWeek;
        var minimum = Math.Max(1, _opties.MinimumBlokDagen);

        var blokken = new List<Planningsblok>();
        var ordinaal = 1;

        // Each teaching stretch is chopped independently, so no block spans a vacation.
        foreach (var (periodeStart, periodeEind) in schooljaar.Lesperiodes())
        {
            var cursor = periodeStart;

            while (cursor <= periodeEind)
            {
                var eind = cursor.AddDays(blokDagen - 1);
                if (eind > periodeEind)
                {
                    eind = periodeEind;
                }

                // Absorb a too-short tail into the previous block of this stretch rather than emitting a stub.
                var restDagen = eind.DayNumber - cursor.DayNumber + 1;
                if (restDagen < minimum && blokken.Count > 0 && blokken[^1].Eind == cursor.AddDays(-1))
                {
                    var vorige = blokken[^1];
                    blokken[^1] = new Planningsblok(vorige.Niveau, vorige.Ordinaal, vorige.Start, eind);
                    break;
                }

                blokken.Add(new Planningsblok(niveau, ordinaal++, cursor, eind));
                cursor = eind.AddDays(1);
            }
        }

        return blokken;
    }

    /// <inheritdoc />
    public string Omschrijving =>
        $"themaperiode {_opties.ThemaperiodeWeken} wk, subthemaperiode {_opties.SubthemaperiodeWeken} wk " +
        $"(blokken breken op schoolvakanties; restduur < {Math.Max(1, _opties.MinimumBlokDagen)} dagen wordt opgenomen in het vorige blok)";

    private int WekenVoor(Planningsblokniveau niveau) =>
        niveau switch
        {
            Planningsblokniveau.Themaperiode => _opties.ThemaperiodeWeken,
            Planningsblokniveau.Subthemaperiode => _opties.SubthemaperiodeWeken,
            _ => throw new ArgumentOutOfRangeException(nameof(niveau), niveau, "Onbekend planningsblokniveau."),
        };
}
