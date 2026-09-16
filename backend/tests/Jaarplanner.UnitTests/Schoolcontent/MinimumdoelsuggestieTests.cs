using Jaarplanner.Domain.Schoolcontent;

namespace Jaarplanner.UnitTests.Schoolcontent;

/// <summary>
/// A thema's minimumdoel proposals in the domain (FB-053, ADR-0052): their rank follows the order they are added in, and
/// which minimumdoelen a run may propose (D1).
/// </summary>
public sealed class MinimumdoelsuggestieTests
{
    [Fact]
    public void De_rang_volgt_de_volgorde_van_toevoegen_ook_over_runs_heen()
    {
        var thema = new Thema("Herfst", 4);

        var eerste = thema.VoegDoelsuggestieToe("K-9.1.1", "best passend");
        var tweede = thema.VoegDoelsuggestieToe("K-1.1.1", "tweede");
        thema.WeigerDoelsuggestie(eerste);
        var latereRun = thema.VoegDoelsuggestieToe("K-5.1.1", "een latere run");

        Assert.Equal([1, 2, 3], new[] { eerste.Rang, tweede.Rang, latereRun.Rang });
    }

    [Theory]
    [InlineData("open")]
    [InlineData("geweigerd")]
    [InlineData("themadoel")]
    public void Een_themadoel_of_een_open_of_geweigerd_voorstel_wordt_niet_opnieuw_voorgesteld(string toestand)
    {
        var thema = new Thema("Herfst", 4);
        switch (toestand)
        {
            case "open":
                thema.VoegDoelsuggestieToe("K-1.1.1", "past");
                break;
            case "geweigerd":
                thema.WeigerDoelsuggestie(thema.VoegDoelsuggestieToe("K-1.1.1", "past"));
                break;
            default:
                thema.KoppelMinimumdoel("K-1.1.1");
                break;
        }

        Assert.True(thema.IsUitgeslotenVoorVoorstel("K-1.1.1"));
        Assert.Equal(["K-1.1.1"], thema.NietVoorTeStellenMinimumdoelen());
        Assert.Throws<InvalidOperationException>(() => thema.VoegDoelsuggestieToe("K-1.1.1", "opnieuw"));
    }

    [Fact]
    public void Een_aanvaard_en_later_ontkoppeld_minimumdoel_wordt_op_dezelfde_rij_opnieuw_voorgesteld()
    {
        var thema = new Thema("Herfst", 4);
        var voorstel = thema.VoegDoelsuggestieToe("K-1.1.1", "eerste motivatie");
        var koppeling = thema.AanvaardDoelsuggestie(voorstel)!;

        // Accepted and still a themadoel: excluded.
        Assert.True(thema.IsUitgeslotenVoorVoorstel("K-1.1.1"));

        thema.OntkoppelMinimumdoel(koppeling);
        Assert.False(thema.IsUitgeslotenVoorVoorstel("K-1.1.1"));
        Assert.Empty(thema.NietVoorTeStellenMinimumdoelen());

        thema.VoegDoelsuggestieToe("K-2.1.1", "tussendoor");
        var opnieuw = thema.VoegDoelsuggestieToe("K-1.1.1", "nieuwe motivatie");

        Assert.Same(voorstel, opnieuw);
        Assert.Equal(2, thema.Doelsuggesties.Count);
        Assert.Equal(KoppelingStatus.Voorgesteld, opnieuw.Status);
        Assert.Equal("nieuwe motivatie", opnieuw.AiMotivatie);
        Assert.Equal(3, opnieuw.Rang);

        // And it can be decided again.
        thema.AanvaardDoelsuggestie(opnieuw);
        Assert.Equal("K-1.1.1", Assert.Single(thema.Minimumdoelen).MinimumdoelRef);
    }
}
