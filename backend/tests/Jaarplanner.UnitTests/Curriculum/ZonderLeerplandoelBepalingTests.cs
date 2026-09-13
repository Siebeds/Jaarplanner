using Jaarplanner.Application.Curriculum.Import;
using Jaarplanner.Domain.Curriculum;

namespace Jaarplanner.UnitTests.Curriculum;

/// <summary>
/// The reason a minimumdoel has no loaded leerplandoel (E1-22, owner ruling 2026-09-13 "Reden tonen"). The rule says
/// only what the snapshot proves: an importable goal means no reason, a refused G goal beats a skipped set, a skipped set
/// is named, and no goal at all is its own reason.
/// </summary>
public sealed class ZonderLeerplandoelBepalingTests
{
    private static Leerplandoel G(string code, string? minimumdoelRef) =>
        new(code, Doelsoort.Gemeenschappelijk, "L3", "Getallenkennis", "Natuurlijke getallen", "2",
            tekst: "De leerlingen tellen.", minimumdoelRef: minimumdoelRef);

    private static LeerplandoelBronResultaat Bron(IReadOnlyList<Leerplandoel> doelen, IReadOnlyList<MinimumdoelVerwijzing> verwijzingen) =>
        new("1.2", "hash", null, null, [new LeerplandoelBronDiscipline("2", "Wiskunde", doelen, [], [], [])], verwijzingen);

    [Fact]
    public void Elke_reden_zegt_alleen_wat_de_snapshot_bewijst()
    {
        var bron = Bron(
            [G("2.1.GL3.10", "4-2.1.7")],
            [
                new MinimumdoelVerwijzing("6-7.1.6", "Z", Geweigerd: false),
                new MinimumdoelVerwijzing("6-9.9.1", "Z", Geweigerd: false),
                new MinimumdoelVerwijzing("6-9.9.1", "V", Geweigerd: false),
                new MinimumdoelVerwijzing("6-9.9.1", "Z", Geweigerd: false),
                new MinimumdoelVerwijzing("4-9.9.9", "G", Geweigerd: true),
                new MinimumdoelVerwijzing("4-9.9.9", "P", Geweigerd: false),
                new MinimumdoelVerwijzing("4-2.1.7", "Z", Geweigerd: false),
            ]);

        var uitkomst = ZonderLeerplandoelBepaling.Bepaal(["4-2.1.7", "6-7.1.6", "6-9.9.1", "4-9.9.9", "K-1.2.6"], bron);

        // An importable goal concords to it: no reason, whatever else points at it.
        Assert.Equal(new ZonderLeerplandoelBepaling.Uitkomst(null, null), uitkomst["4-2.1.7"]);
        Assert.Equal(new ZonderLeerplandoelBepaling.Uitkomst(ZonderLeerplandoelReden.AlleenOvergeslagenDoelsets, "Z"), uitkomst["6-7.1.6"]);
        // Sets named once each, in order.
        Assert.Equal(new ZonderLeerplandoelBepaling.Uitkomst(ZonderLeerplandoelReden.AlleenOvergeslagenDoelsets, "V,Z"), uitkomst["6-9.9.1"]);
        // A refused G goal would have covered it; that is the reason, not the P goal beside it.
        Assert.Equal(new ZonderLeerplandoelBepaling.Uitkomst(ZonderLeerplandoelReden.DoelNietIngelezen, null), uitkomst["4-9.9.9"]);
        Assert.Equal(new ZonderLeerplandoelBepaling.Uitkomst(ZonderLeerplandoelReden.GeenDoelInOpstap, null), uitkomst["K-1.2.6"]);
    }

    [Fact]
    public void Een_importeerbaar_doel_in_een_discipline_die_niet_ingelezen_wordt_geeft_geen_reden()
    {
        // The goal exists and maps; whether its discipline is imported is a selection, not a fact about the minimumdoel.
        var bron = new LeerplandoelBronResultaat("1.2", "hash", null, null,
            [new LeerplandoelBronDiscipline("9.1", "Veilige en gezonde levensstijl", [G("9-1.1.GL1.1", "6-9.1.1")], [], [], [])]);

        var uitkomst = ZonderLeerplandoelBepaling.Bepaal(["6-9.1.1"], bron);

        Assert.Null(uitkomst["6-9.1.1"].Reden);
    }
}
