using Jaarplanner.Application.Dekking;
using Jaarplanner.Application.Kat;

namespace Jaarplanner.UnitTests.Kat;

/// <summary>
/// Which discipline a klas hardly touches (FB-070, ADR-0060 G2). <b>Without an AI client</b>: the choice of discipline
/// is the half of this feature that must be reproducible, which is FB-070's last acceptance criterion.
/// </summary>
public sealed class AanbodgatTests
{
    [Fact]
    public void De_discipline_met_het_grootste_aandeel_in_het_gat_wint()
    {
        // Wiskunde: 1 of 4 nergens. Natuur: 2 of 3. Natuur has fewer goals in the gap in absolute terms and still wins,
        // because "low" is a share (G2).
        var gat = Aanbodgatbepaling.Grootste(Detectorbouw.Dekking(doelen:
        [
            Detectorbouw.Leerplandoel("W-01", Dekkingsstap.Geen, "2", "Wiskunde"),
            Detectorbouw.Leerplandoel("W-02", Dekkingsstap.Gedekt, "2", "Wiskunde"),
            Detectorbouw.Leerplandoel("W-03", Dekkingsstap.Gedekt, "2", "Wiskunde"),
            Detectorbouw.Leerplandoel("W-04", Dekkingsstap.Prognose, "2", "Wiskunde"),
            Detectorbouw.Leerplandoel("N-01", Dekkingsstap.Geen, "9", "Natuur"),
            Detectorbouw.Leerplandoel("N-02", Dekkingsstap.Geen, "9", "Natuur"),
            Detectorbouw.Leerplandoel("N-03", Dekkingsstap.Gedekt, "9", "Natuur"),
        ]));

        Assert.NotNull(gat);
        Assert.Equal("9", gat.DisciplineNummer);
        Assert.Equal("Natuur", gat.DisciplineNaam);
        Assert.Equal(["N-01", "N-02"], gat.Codes);
        Assert.Equal(3, gat.AantalInBereik);
    }

    [Fact]
    public void Een_doel_in_de_prognose_hoort_niet_in_het_gat()
    {
        // G2: a goal a subthema aims at is a gepland-gat, which the cat answers with "plaats subthema ..." (FB-069),
        // not with activiteiten. Only Dekkingsstap.Geen is an aanbod-gat.
        var gat = Aanbodgatbepaling.Grootste(Detectorbouw.Dekking(doelen:
        [
            Detectorbouw.Leerplandoel("N-01", Dekkingsstap.Prognose),
            Detectorbouw.Leerplandoel("N-02", Dekkingsstap.Gedekt),
        ]));

        Assert.Null(gat);
    }

    [Fact]
    public void Zonder_doelen_is_er_geen_gat()
    {
        Assert.Null(Aanbodgatbepaling.Grootste(Detectorbouw.Dekking()));
    }

    [Fact]
    public void Bij_een_gelijk_aandeel_wint_het_grootste_aantal_en_daarna_het_laagste_nummer()
    {
        // Three disciplines, each entirely in the gap. "2" has two goals, "3" and "9" one each: the count decides
        // first, then the number, so a tick and the read after it name the same discipline.
        var gat = Aanbodgatbepaling.Grootste(Detectorbouw.Dekking(doelen:
        [
            Detectorbouw.Leerplandoel("M-01", Dekkingsstap.Geen, "3", "Muzische vorming"),
            Detectorbouw.Leerplandoel("W-01", Dekkingsstap.Geen, "2", "Wiskunde"),
            Detectorbouw.Leerplandoel("W-02", Dekkingsstap.Geen, "2", "Wiskunde"),
            Detectorbouw.Leerplandoel("N-01", Dekkingsstap.Geen, "9", "Natuur"),
        ]));

        Assert.NotNull(gat);
        Assert.Equal("2", gat.DisciplineNummer);
        Assert.Equal(1, gat.Aandeel);
    }

    [Fact]
    public void Een_discipline_zonder_naam_houdt_haar_nummer()
    {
        var gat = Aanbodgatbepaling.Grootste(Detectorbouw.Dekking(doelen:
        [
            Detectorbouw.Leerplandoel("N-01", Dekkingsstap.Geen, "9", disciplineNaam: null),
        ]));

        Assert.NotNull(gat);
        Assert.Equal("9", gat.DisciplineNummer);
        Assert.Null(gat.DisciplineNaam);
    }
}
