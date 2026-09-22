using Jaarplanner.Application.Dekking;
using Jaarplanner.Application.Kat.Detectoren;
using Jaarplanner.Domain.Kat;

namespace Jaarplanner.UnitTests.Kat;

/// <summary>
/// "This minimumdoel is not going to be gedekt" (FB-069, ADR-0059 D4). Without a database and without an AI client.
/// </summary>
public sealed class MinimumdoelInGevaarDetectorTests
{
    private static readonly Guid Water = Guid.Parse("aaaaaaaa-0000-0000-0000-000000000001");
    private static readonly Guid Herfst = Guid.Parse("aaaaaaaa-0000-0000-0000-000000000002");

    // A Tuesday, so "this week" is the Monday before it.
    private static readonly DateOnly Vandaag = new(2026, 9, 22);

    private static readonly DateOnly DezeMaandag = new(2026, 9, 21);

    private static MinimumdoelInGevaarDetector Detector(
        int vrijeLesweken,
        params Jaarplanner.Application.Kat.Themadrager[] dragers) =>
        new(
            new NepJaarplanlezer(Detectorbouw.Plan(Weken(vrijeLesweken))),
            new NepKatplanbron { Dragers = [.. dragers] });

    /// <summary>This week and the ones after it, all free, plus a free week that is already past.</summary>
    private static IEnumerable<(DateOnly, bool)> Weken(int vrij)
    {
        yield return (DezeMaandag.AddDays(-7), false);
        for (var i = 0; i < vrij; i++)
        {
            yield return (DezeMaandag.AddDays(7 * i), false);
        }
    }

    [Fact]
    public async Task Een_doel_dat_niet_meer_past_levert_een_melding_met_het_doel_het_thema_en_de_vrije_lesweken()
    {
        var detector = Detector(vrijeLesweken: 3, new Jaarplanner.Application.Kat.Themadrager("K-12", Water, "Water", 4));
        var context = Detectorbouw.Context(
            Detectorbouw.Dekking([Detectorbouw.Minimumdoel("K-12", Dekkingsstap.Prognose)]),
            Vandaag);

        var vondst = Assert.Single(await detector.DetecteerAsync(context, CancellationToken.None));

        Assert.Equal(Signaalsoort.MinimumdoelInGevaar, vondst.Soort);
        Assert.Equal("K-12", vondst.Sleutel);
        Assert.Equal("K-12", vondst.Gegevens[MinimumdoelInGevaarDetector.Sleutels.DoelRef]);
        Assert.Equal("Water", vondst.Gegevens[MinimumdoelInGevaarDetector.Sleutels.Thema]);
        Assert.Equal(4, vondst.Gegevens[MinimumdoelInGevaarDetector.Sleutels.ThemaLesweken]);
        Assert.Equal(3, vondst.Gegevens[MinimumdoelInGevaarDetector.Sleutels.VrijeLesweken]);
    }

    [Fact]
    public async Task Hetzelfde_doel_met_genoeg_vrije_lesweken_levert_geen_melding()
    {
        var detector = Detector(vrijeLesweken: 5, new Jaarplanner.Application.Kat.Themadrager("K-12", Water, "Water", 4));
        var context = Detectorbouw.Context(
            Detectorbouw.Dekking([Detectorbouw.Minimumdoel("K-12", Dekkingsstap.Prognose)]),
            Vandaag);

        Assert.Empty(await detector.DetecteerAsync(context, CancellationToken.None));
    }

    [Fact]
    public async Task Precies_genoeg_vrije_lesweken_levert_geen_melding()
    {
        // Four weeks free for a four-week thema still fits, so the cat stays quiet.
        var detector = Detector(vrijeLesweken: 4, new Jaarplanner.Application.Kat.Themadrager("K-12", Water, "Water", 4));
        var context = Detectorbouw.Context(
            Detectorbouw.Dekking([Detectorbouw.Minimumdoel("K-12", Dekkingsstap.Prognose)]),
            Vandaag);

        Assert.Empty(await detector.DetecteerAsync(context, CancellationToken.None));
    }

    [Fact]
    public async Task Het_kortste_dragende_thema_beslist()
    {
        var detector = Detector(
            vrijeLesweken: 3,
            new Jaarplanner.Application.Kat.Themadrager("K-12", Water, "Water", 4),
            new Jaarplanner.Application.Kat.Themadrager("K-12", Herfst, "Herfst", 2));
        var context = Detectorbouw.Context(
            Detectorbouw.Dekking([Detectorbouw.Minimumdoel("K-12", Dekkingsstap.Prognose)]),
            Vandaag);

        // Herfst still fits in three weeks, so the doel is not in danger at all.
        Assert.Empty(await detector.DetecteerAsync(context, CancellationToken.None));
    }

    [Fact]
    public async Task Een_gedekt_doel_levert_geen_melding()
    {
        var detector = Detector(vrijeLesweken: 0, new Jaarplanner.Application.Kat.Themadrager("K-12", Water, "Water", 4));
        var context = Detectorbouw.Context(
            Detectorbouw.Dekking([Detectorbouw.Minimumdoel("K-12", Dekkingsstap.Gedekt)]),
            Vandaag);

        Assert.Empty(await detector.DetecteerAsync(context, CancellationToken.None));
    }

    [Fact]
    public async Task Een_doel_dat_geen_enkel_thema_draagt_levert_geen_melding()
    {
        // Nothing to place, so nothing to tell her. That gap is the hiatenanalyse of FB-054, not this signal.
        var detector = Detector(vrijeLesweken: 0);
        var context = Detectorbouw.Context(
            Detectorbouw.Dekking([Detectorbouw.Minimumdoel("K-12", Dekkingsstap.Prognose)]),
            Vandaag);

        Assert.Empty(await detector.DetecteerAsync(context, CancellationToken.None));
    }

    [Fact]
    public void Een_lesweek_die_al_voorbij_is_telt_niet_als_vrij()
    {
        var plan = Detectorbouw.Plan([
            (DezeMaandag.AddDays(-14), false),
            (DezeMaandag.AddDays(-7), false),
            (DezeMaandag, false),
            (DezeMaandag.AddDays(7), true),
            (DezeMaandag.AddDays(14), false),
        ]);

        Assert.Equal(2, MinimumdoelInGevaarDetector.TelVrijeLesweken(plan, Vandaag));
    }

    [Fact]
    public void Een_week_met_een_voorgesteld_thema_telt_niet_als_vrij()
    {
        // The plan screen already calls such a week "met thema", and the prognose the doel sits in counts a proposed
        // placement too; counting it free here would let the cat contradict both.
        var plan = Detectorbouw.Plan([(DezeMaandag, true), (DezeMaandag.AddDays(7), false)]);

        Assert.Equal(1, MinimumdoelInGevaarDetector.TelVrijeLesweken(plan, Vandaag));
    }
}
