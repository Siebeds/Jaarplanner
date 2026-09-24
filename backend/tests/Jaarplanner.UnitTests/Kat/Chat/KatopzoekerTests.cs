using Jaarplanner.Application.Kat.Chat;
using static Jaarplanner.UnitTests.Kat.Chat.Chatschool;

namespace Jaarplanner.UnitTests.Kat.Chat;

/// <summary>
/// The chat's lookups over the tool's own data (FB-031, ADR-0066): the answer, what a decided and a proposed link are,
/// and above all what a gebruiker may not see (Art. VI.1, ADR-0040, ADR-0049 D3). No AI client anywhere.
/// </summary>
public sealed class KatopzoekerTests
{
    private readonly Chatschool _school = new();

    private Task<Katantwoord> Zoek(Katopzoeking opzoeking, Katlezer? lezer = null) =>
        new Katopzoeker(_school).ZoekOpAsync(opzoeking, lezer ?? Leerkracht("K3", K3Blauw));

    [Fact]
    public async Task Zit_een_themadoel_in_het_thema_dan_is_het_ja_met_de_plek()
    {
        var antwoord = await Zoek(new Katopzoeking(Katvraag.DoelInThema, Doel: "md-k-01", Thema: "herfst"));

        Assert.Equal(Katantwoordsoort.DoelInThema, antwoord.Soort);
        Assert.True(antwoord.Ja);
        Assert.Equal(Seizoenen, antwoord.Doel);
        Assert.Equal(new Katnaam(Herfst, "Herfst"), antwoord.Thema);
        var plek = Assert.Single(antwoord.Plekken);
        Assert.Equal(Katpleksoort.Themadoel, plek.Soort);
        Assert.Equal($"/themas/{Herfst}", plek.Verwijzing);
        Assert.Empty(antwoord.Voorstellen);
    }

    [Fact]
    public async Task Een_voorgesteld_themadoel_is_nee_en_wordt_apart_als_voorstel_genoemd()
    {
        var antwoord = await Zoek(new Katopzoeking(Katvraag.DoelInThema, Doel: "MD-K-02", Thema: "Water"));

        Assert.False(antwoord.Ja);
        Assert.Empty(antwoord.Plekken);
        Assert.Equal(Katpleksoort.Themadoel, Assert.Single(antwoord.Voorstellen).Soort);
    }

    [Fact]
    public async Task Een_doel_dat_niet_in_het_thema_zit_is_nee()
    {
        var antwoord = await Zoek(new Katopzoeking(Katvraag.DoelInThema, Doel: "MD-K-01", Thema: "Water"));

        Assert.Equal(Katantwoordsoort.DoelInThema, antwoord.Soort);
        Assert.False(antwoord.Ja);
        Assert.Empty(antwoord.Plekken);
        Assert.Empty(antwoord.Voorstellen);
    }

    [Fact]
    public async Task Een_deel_van_de_naam_geeft_hetzelfde_antwoord_als_de_code()
    {
        var opCode = await Zoek(new Katopzoeking(Katvraag.DoelInThema, Doel: "G-WO-01", Thema: "Herfst"));
        var opNaam = await Zoek(new Katopzoeking(Katvraag.DoelInThema, Doel: "sorteren kleur", Thema: "thema herfst"));

        Assert.True(opNaam.Ja);
        Assert.Equal(opCode.Plekken, opNaam.Plekken);
        Assert.Equal(
            [Katpleksoort.Subdoel, Katpleksoort.Activiteit],
            opNaam.Plekken.Select(p => p.Soort).Order().ToArray());
        var subdoel = opNaam.Plekken.Single(p => p.Soort == Katpleksoort.Subdoel);
        Assert.Equal(("Bladeren", "K3"), (subdoel.Subthema, subdoel.Leeftijd));
        Assert.Equal($"/themas/{Herfst}?subthema={Bladeren}", subdoel.Verwijzing);
    }

    [Fact]
    public async Task Passen_meerdere_doelen_dan_vraagt_hij_welk_en_kiest_hij_er_zelf_geen()
    {
        var antwoord = await Zoek(new Katopzoeking(Katvraag.DoelInThema, Doel: "hoeveelheden", Thema: "Herfst"));

        Assert.Equal(Katantwoordsoort.Kies, antwoord.Soort);
        Assert.Equal(Katonderwerp.Doel, antwoord.Keuze!.Wat);
        Assert.Equal(["G-WI-02", "G-WI-03"], antwoord.Keuze.Kandidaten.Select(k => k.Id).Order().ToArray());
        Assert.Null(antwoord.Ja);
        Assert.NotNull(antwoord.Opzoeking);

        // Picking one runs the same lookup with that goal's code.
        var gekozen = await Zoek(antwoord.Opzoeking! with { Doel = "G-WI-03" });
        Assert.Equal(Katantwoordsoort.DoelInThema, gekozen.Soort);
        Assert.Equal(Tellen, gekozen.Doel);
    }

    [Fact]
    public async Task Een_lange_doeltekst_wordt_als_kandidaat_ingekort_op_een_regel()
    {
        var lang = "Hoeveelheden meten:\n- " + string.Join(" ", Enumerable.Repeat("met natuurlijke getallen", 20));
        _school.Doelen.Add(new Katdoel("G-WI-09", Katdoelsoort.Leerplandoel, lang));

        var antwoord = await Zoek(new Katopzoeking(Katvraag.WaarGebruikt, Doel: "hoeveelheden"));

        var kandidaat = antwoord.Keuze!.Kandidaten.Single(k => k.Id == "G-WI-09");
        Assert.True(kandidaat.Detail!.Length <= Katopzoeker.MaxDetailLengte);
        Assert.EndsWith("…", kandidaat.Detail);
        Assert.StartsWith("Hoeveelheden meten: - met natuurlijke", kandidaat.Detail);
    }

    [Fact]
    public async Task Een_onbestaand_doel_of_thema_wordt_niet_gevonden()
    {
        var geenDoel = await Zoek(new Katopzoeking(Katvraag.DoelInThema, Doel: "ZZ-99", Thema: "Herfst"));
        var geenThema = await Zoek(new Katopzoeking(Katvraag.DoelInThema, Doel: "MD-K-01", Thema: "Ruimtevaart"));

        Assert.Equal(new Katniets(Katonderwerp.Doel, "ZZ-99"), geenDoel.NietGevonden);
        Assert.Equal(new Katniets(Katonderwerp.Thema, "Ruimtevaart"), geenThema.NietGevonden);
        Assert.All(new[] { geenDoel, geenThema }, a => Assert.Equal(Katantwoordsoort.NietGevonden, a.Soort));
    }

    [Fact]
    public async Task Waar_gebruikt_noemt_inhoud_fiches_en_agenda_van_de_klassen_die_ze_mag_inkijken()
    {
        var antwoord = await Zoek(new Katopzoeking(Katvraag.WaarGebruikt, Doel: "G-WI-03"), Leerkracht("K3", K3Blauw));

        Assert.Equal(Katantwoordsoort.WaarGebruikt, antwoord.Soort);

        // The rejected subdoel in Regen is never named; the fiche of K3 Groen is not hers to read.
        var fiche = Assert.Single(antwoord.Plekken);
        Assert.Equal((Katpleksoort.AlgemeneFiche, "Onthaal", "K3 Blauw"), (fiche.Soort, fiche.Fiche, fiche.Klas));
        Assert.Empty(antwoord.Voorstellen);

        var agenda = Assert.Single(antwoord.Agenda);
        Assert.Equal((K3Blauw, Katagendasoort.AlgemeneFiche, "Onthaal"), (agenda.KlasId, agenda.Soort, agenda.Naam));
        Assert.Equal("/agenda/dag/2026-09-01", agenda.Verwijzing);
        Assert.Equal([K3Blauw], _school.GevraagdeAgenda!);
    }

    [Fact]
    public async Task De_eigen_activiteit_van_een_collega_ziet_alleen_wie_haar_leeftijd_heeft()
    {
        var k2 = await Zoek(new Katopzoeking(Katvraag.WaarGebruikt, Doel: "G-WI-02"), Leerkracht("K2"));
        var k3 = await Zoek(new Katopzoeking(Katvraag.WaarGebruikt, Doel: "G-WI-02"), Leerkracht("K3"));
        var admin = await Zoek(new Katopzoeking(Katvraag.WaarGebruikt, Doel: "G-WI-02"), Admin());

        Assert.Equal(["Regenmeter maken"], k2.Plekken.Select(p => p.Activiteit!).ToArray());
        Assert.Equal(["Plassen springen", "Regenmeter maken"], k3.Plekken.Select(p => p.Activiteit!).ToArray());
        Assert.Equal(k3.Plekken, admin.Plekken);

        // The K2 subdoel is a proposal, and is named apart for everyone.
        Assert.All(new[] { k2, k3 }, a => Assert.Equal(("Bladeren", "K2"), (a.Voorstellen.Single().Subthema, a.Voorstellen.Single().Leeftijd)));
    }

    [Fact]
    public async Task De_agenda_toont_alleen_de_klassen_die_ze_mag_inkijken()
    {
        var blauw = await Zoek(new Katopzoeking(Katvraag.WaarGebruikt, Doel: "G-WI-02"), Leerkracht("K3", K3Blauw));
        var admin = await Zoek(new Katopzoeking(Katvraag.WaarGebruikt, Doel: "G-WI-02"), Admin());

        // Her collega's own activiteit is planned in her klas: the agenda of her klas shows it.
        var plek = Assert.Single(blauw.Agenda);
        Assert.Equal(("K3 Blauw", "Plassen springen", new DateOnly(2026, 10, 7)), (plek.Klas, plek.Naam, plek.Van));
        Assert.Equal(1, blauw.AgendaTotaal);

        Assert.Equal(["K3 Blauw", "K3 Groen"], admin.Agenda.Select(p => p.Klas).ToArray());
    }

    [Fact]
    public async Task Zonder_klas_om_in_te_kijken_vraagt_hij_de_agenda_niet_op()
    {
        var antwoord = await Zoek(new Katopzoeking(Katvraag.WaarGebruikt, Doel: "G-WI-03"), Leerkracht("K2"));

        Assert.Empty(antwoord.Plekken);
        Assert.Empty(antwoord.Agenda);
        Assert.Null(_school.GevraagdeAgenda);
    }

    [Fact]
    public async Task Een_voorgestelde_themaplaatsing_staat_als_voorstel_in_de_agenda()
    {
        var antwoord = await Zoek(new Katopzoeking(Katvraag.WaarGebruikt, Doel: "MD-K-01"), Admin());

        Assert.Equal(
            [("K3 Blauw", false), ("K3 Groen", true)],
            antwoord.Agenda.Select(p => (p.Klas, p.Voorstel)).ToArray());
        Assert.All(antwoord.Agenda, p => Assert.Equal(Katagendasoort.Thema, p.Soort));
    }

    [Fact]
    public async Task De_agenda_is_begrensd_en_zegt_hoeveel_er_zijn()
    {
        _school.Agenda = _school.Agenda with
        {
            Activiteiten = Enumerable.Range(0, 50)
                .Select(i => new Katactiviteitplaatsing(K3Blauw, Regenmeter, new DateOnly(2026, 9, 1).AddDays(i), false))
                .ToList(),
        };

        var antwoord = await Zoek(new Katopzoeking(Katvraag.WaarGebruikt, Doel: "G-WI-02"), Leerkracht("K3", K3Blauw));

        Assert.Equal(Katantwoord.MaxAgendaplekken, antwoord.Agenda.Count);
        Assert.Equal(50, antwoord.AgendaTotaal);
    }

    [Fact]
    public async Task Doelen_van_een_thema_zijn_themadoelen_en_subdoelen_met_hun_tekst()
    {
        var antwoord = await Zoek(new Katopzoeking(Katvraag.DoelenVanThema, Thema: "Herfst"));

        Assert.Equal(Katantwoordsoort.DoelenVanThema, antwoord.Soort);
        Assert.Equal(
            [(Katpleksoort.Themadoel, Seizoenen), (Katpleksoort.Subdoel, Sorteren)],
            antwoord.Plekken.Select(p => (p.Soort, p.Doel!)).ToArray());
        Assert.Equal(Meten, Assert.Single(antwoord.Voorstellen).Doel);
    }

    [Fact]
    public async Task De_doelen_van_een_subthema_zijn_zijn_subdoelen_op_elke_leeftijd_met_die_naam()
    {
        var antwoord = await Zoek(new Katopzoeking(Katvraag.DoelenVanSubthema, Subthema: "bladeren"));

        Assert.Equal(Katantwoordsoort.DoelenVanSubthema, antwoord.Soort);
        Assert.Equal("Bladeren", antwoord.Subthema);
        var plek = Assert.Single(antwoord.Plekken);
        Assert.Equal((Katpleksoort.Subdoel, "K3", Sorteren), (plek.Soort, plek.Leeftijd, plek.Doel!));
        var voorstel = Assert.Single(antwoord.Voorstellen);
        Assert.Equal(("K2", Meten), (voorstel.Leeftijd, voorstel.Doel!));
    }

    [Fact]
    public async Task Een_geweigerd_subdoel_hoort_niet_bij_de_doelen_van_het_subthema()
    {
        var antwoord = await Zoek(new Katopzoeking(Katvraag.DoelenVanSubthema, Subthema: "Regen"));

        Assert.Equal(Katantwoordsoort.DoelenVanSubthema, antwoord.Soort);
        Assert.Empty(antwoord.Plekken);
        Assert.Empty(antwoord.Voorstellen);
    }

    [Fact]
    public async Task Een_subthema_dat_niet_bestaat_wordt_niet_gevonden()
    {
        var antwoord = await Zoek(new Katopzoeking(Katvraag.DoelenVanSubthema, Subthema: "Sneeuw"));

        Assert.Equal(Katantwoordsoort.NietGevonden, antwoord.Soort);
        Assert.Equal(new Katniets(Katonderwerp.Subthema, "Sneeuw"), antwoord.NietGevonden);
    }

    [Fact]
    public async Task Een_activiteit_in_een_ander_subthema_is_nee_en_hij_zegt_waar_ze_wel_hoort()
    {
        var antwoord = await Zoek(new Katopzoeking(Katvraag.ActiviteitInSubthema, Activiteit: "bladeren sorteren", Subthema: "Regen"));

        Assert.Equal(Katantwoordsoort.ActiviteitInSubthema, antwoord.Soort);
        Assert.False(antwoord.Ja);
        Assert.Equal("Regen", antwoord.Subthema);
        var plek = Assert.Single(antwoord.Plekken);
        Assert.Equal(("Bladeren", "K3", "Herfst"), (plek.Subthema, plek.Leeftijd, plek.Thema));
    }

    [Fact]
    public async Task Een_subthema_met_dezelfde_naam_op_een_andere_leeftijd_is_hetzelfde_subthema()
    {
        var antwoord = await Zoek(new Katopzoeking(Katvraag.ActiviteitInSubthema, Activiteit: "Bladeren sorteren", Subthema: "bladeren"));

        Assert.True(antwoord.Ja);
    }

    [Fact]
    public async Task Een_eigen_activiteit_die_ze_niet_mag_lezen_bestaat_niet_voor_haar()
    {
        var k2 = await Zoek(new Katopzoeking(Katvraag.SubthemaVanActiviteit, Activiteit: "Plassen springen"), Leerkracht("K2"));
        var k3 = await Zoek(new Katopzoeking(Katvraag.SubthemaVanActiviteit, Activiteit: "Plassen springen"), Leerkracht("K3"));

        Assert.Equal(Katantwoordsoort.NietGevonden, k2.Soort);
        Assert.Equal(Katonderwerp.Activiteit, k2.NietGevonden!.Wat);
        Assert.Equal(Katantwoordsoort.SubthemaVanActiviteit, k3.Soort);
        Assert.Equal("Regen", Assert.Single(k3.Plekken).Subthema);
    }

    [Fact]
    public async Task Passen_meerdere_activiteiten_dan_vraagt_hij_welke()
    {
        var antwoord = await Zoek(new Katopzoeking(Katvraag.SubthemaVanActiviteit, Activiteit: "en"), Admin());

        Assert.Equal(Katantwoordsoort.Kies, antwoord.Soort);
        Assert.Equal(3, antwoord.Keuze!.Kandidaten.Count);

        var gekozen = await Zoek(antwoord.Opzoeking! with { Activiteit = antwoord.Keuze.Kandidaten[0].Id }, Admin());
        Assert.Equal(Katantwoordsoort.SubthemaVanActiviteit, gekozen.Soort);
    }

    [Fact]
    public async Task Een_thema_gekozen_op_zijn_id_wordt_exact_gevonden()
    {
        var antwoord = await Zoek(new Katopzoeking(Katvraag.DoelenVanThema, Thema: Water.ToString()));

        Assert.Equal(new Katnaam(Water, "Water"), antwoord.Thema);
    }

    [Fact]
    public async Task Een_onvolledige_opzoeking_mislukt_zonder_iets_te_lezen()
    {
        var antwoord = await Zoek(new Katopzoeking(Katvraag.DoelInThema, Doel: "MD-K-01"));

        Assert.Equal(Katantwoordsoort.Mislukt, antwoord.Soort);
    }
}
