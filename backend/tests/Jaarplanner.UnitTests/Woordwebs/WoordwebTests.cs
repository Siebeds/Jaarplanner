using Jaarplanner.Domain.Schoolcontent;

namespace Jaarplanner.UnitTests.Woordwebs;

/// <summary>
/// The <see cref="Woordweb"/> aggregate (FB-036, ADR-0041): typed words are the teacher's, the AI proposes only once the
/// web holds one of hers, every proposal waits for her decision, and a rejected word never comes back.
/// </summary>
public sealed class WoordwebTests
{
    private static Woordweb NieuwWeb() => new(Guid.NewGuid(), Guid.NewGuid());

    private static Woordweb WebMet(params string[] woorden)
    {
        var web = NieuwWeb();
        web.VoegWoordenToe(woorden);
        return web;
    }

    [Fact]
    public void Een_nieuw_web_is_leeg_en_de_ai_mag_er_nog_niets_aan_toevoegen()
    {
        var web = NieuwWeb();

        Assert.Empty(web.Woorden);
        Assert.False(web.HeeftWoordInWeb);
        Assert.Throws<InvalidOperationException>(() => web.VoegVoorstelToe("wolk", "Past bij het weer."));
        Assert.Throws<InvalidOperationException>(web.VereisWoordInWeb);
    }

    [Fact]
    public void Getypte_woorden_zijn_manueel_en_een_woord_telt_eenmaal_ongeacht_hoofdletters()
    {
        var web = WebMet("Wind", " wind ", "regen", "  ", "REGEN");

        Assert.Equal(["Wind", "regen"], web.Woorden.Select(w => w.Woord));
        Assert.All(web.Woorden, w => Assert.Equal(KoppelingStatus.Manueel, w.Status));
        Assert.All(web.Woorden, w => Assert.Null(w.AiMotivatie));
        Assert.Equal([1, 2], web.Woorden.Select(w => w.Volgnummer));
        Assert.True(web.HeeftWoordInWeb);
    }

    [Fact]
    public void Na_het_eerste_eigen_woord_is_een_ai_woord_een_voorstel_met_motivatie()
    {
        var web = WebMet("wind");

        var voorstel = web.VoegVoorstelToe(" wolk ", " Wolken brengen regen. ");

        Assert.NotNull(voorstel);
        Assert.Equal("wolk", voorstel.Woord);
        Assert.Equal(KoppelingStatus.Voorgesteld, voorstel.Status);
        Assert.Equal("Wolken brengen regen.", voorstel.AiMotivatie);
        Assert.False(voorstel.StaatInWeb);
    }

    [Theory]
    [InlineData("WIND")]
    [InlineData("")]
    [InlineData("   ")]
    public void Een_ai_woord_dat_er_al_is_of_leeg_is_wordt_overgeslagen(string woord)
    {
        var web = WebMet("wind");

        Assert.Null(web.VoegVoorstelToe(woord, "Een reden."));
        Assert.Single(web.Woorden);
    }

    [Fact]
    public void Een_ai_woord_zonder_motivatie_of_te_lang_wordt_overgeslagen()
    {
        var web = WebMet("wind");

        Assert.Null(web.VoegVoorstelToe("wolk", " "));
        Assert.Null(web.VoegVoorstelToe(new string('w', Woordweb.MaxWoordlengte + 1), "Een reden."));
        Assert.Single(web.Woorden);
    }

    [Fact]
    public void Een_aanvaard_woord_staat_in_het_web_en_houdt_zijn_motivatie()
    {
        var web = WebMet("wind");
        var voorstel = web.VoegVoorstelToe("wolk", "Wolken brengen regen.")!;

        web.Beslis(voorstel.Id, KoppelingStatus.Aanvaard);

        Assert.Equal(KoppelingStatus.Aanvaard, voorstel.Status);
        Assert.True(voorstel.StaatInWeb);
        Assert.Equal("Wolken brengen regen.", voorstel.AiMotivatie);
    }

    [Fact]
    public void Een_geweigerd_woord_wordt_nooit_opnieuw_voorgesteld()
    {
        var web = WebMet("wind");
        var voorstel = web.VoegVoorstelToe("wolk", "Wolken brengen regen.")!;

        web.Beslis(voorstel.Id, KoppelingStatus.Geweigerd);

        Assert.False(voorstel.StaatInWeb);
        Assert.Null(web.VoegVoorstelToe("Wolk", "Nog eens."));
        Assert.Equal(2, web.Woorden.Count);
    }

    [Fact]
    public void Alleen_een_voorstel_wacht_op_een_beslissing_en_alleen_met_aanvaard_of_geweigerd()
    {
        var web = WebMet("wind");
        var eigen = web.Woorden[0];
        var voorstel = web.VoegVoorstelToe("wolk", "Een reden.")!;

        Assert.Throws<InvalidOperationException>(() => web.Beslis(eigen.Id, KoppelingStatus.Aanvaard));
        Assert.Throws<ArgumentException>(() => web.Beslis(voorstel.Id, KoppelingStatus.Manueel));
        Assert.Throws<ArgumentException>(() => web.Beslis(voorstel.Id, KoppelingStatus.Voorgesteld));
        Assert.Throws<InvalidOperationException>(() => web.Beslis(Guid.NewGuid(), KoppelingStatus.Aanvaard));

        web.Beslis(voorstel.Id, KoppelingStatus.Aanvaard);
        Assert.Throws<InvalidOperationException>(() => web.Beslis(voorstel.Id, KoppelingStatus.Geweigerd));
    }

    [Fact]
    public void Een_voorstel_of_geweigerd_woord_dat_de_leerkracht_zelf_typt_wordt_het_hare()
    {
        var web = WebMet("wind");
        var voorstel = web.VoegVoorstelToe("wolk", "Een reden.")!;
        var geweigerd = web.VoegVoorstelToe("bliksem", "Een reden.")!;
        web.Beslis(geweigerd.Id, KoppelingStatus.Geweigerd);

        var toegevoegd = web.VoegWoordenToe(["Wolk", "bliksem"]);

        Assert.Equal(2, toegevoegd.Count);
        Assert.All([voorstel, geweigerd], w =>
        {
            Assert.Equal(KoppelingStatus.Manueel, w.Status);
            Assert.Null(w.AiMotivatie);
        });
        Assert.Equal(3, web.Woorden.Count);
    }

    [Fact]
    public void Een_woord_uit_het_web_halen_kan_maar_een_voorstel_of_geweigerd_woord_niet()
    {
        var web = WebMet("wind", "regen");
        var voorstel = web.VoegVoorstelToe("wolk", "Een reden.")!;

        web.VerwijderWoord(web.Woorden[0].Id);

        Assert.Equal(["regen", "wolk"], web.Woorden.Select(w => w.Woord));
        Assert.Throws<InvalidOperationException>(() => web.VerwijderWoord(voorstel.Id));
        Assert.Throws<InvalidOperationException>(() => web.VerwijderWoord(Guid.NewGuid()));
    }

    [Fact]
    public void Een_uit_het_web_gehaald_woord_mag_de_ai_opnieuw_voorstellen()
    {
        var web = WebMet("wind", "regen");
        web.VerwijderWoord(web.Woorden.Single(w => w.Woord == "regen").Id);

        Assert.NotNull(web.VoegVoorstelToe("regen", "Hoort bij het weer."));
    }

    [Fact]
    public void Een_getypt_woord_langer_dan_de_kolom_wordt_geweigerd()
    {
        var web = NieuwWeb();

        Assert.Throws<ArgumentException>(() => web.VoegWoordenToe([new string('w', Woordweb.MaxWoordlengte + 1)]));
        Assert.Empty(web.Woorden);
    }

    [Fact]
    public void Een_web_hoort_bij_een_subthema_en_een_eigenaar()
    {
        Assert.Throws<ArgumentException>(() => new Woordweb(Guid.Empty, Guid.NewGuid()));
        Assert.Throws<ArgumentException>(() => new Woordweb(Guid.NewGuid(), Guid.Empty));
    }
}
