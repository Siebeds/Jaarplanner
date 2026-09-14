using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.Domain.Toegang;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.IntegrationTests.Postgres;

/// <summary>
/// Directie's beheer of gebruikers and rights (E6-04, FA FR-12.2, Art. VI.1, ADR-0030 §3 row "Gebruikers … beheren",
/// directie only) against real PostgreSQL: who may call it, what the overview shows, the invitation, the rights,
/// klastoewijzingen and appointments, removal with its cascades, and the last-directie guard (ADR-0031 decision 7),
/// including the lock that stops two directieleden demoting each other at once.
/// <para>
/// On Postgres because the guard's lock, the cascades, SET NULL on the maker and the unique indexes are database
/// behaviour the in-memory provider does not have. The default test identity is directie without a row (see
/// <see cref="TestAuthenticatie"/>), so it never counts as one of the directieleden the guard counts.
/// </para>
/// </summary>
public sealed class GebruikerbeheerEndpointsTests : IAsyncLifetime
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private PostgresTestDatabase _db = null!;
    private PostgresApiFactory _factory = null!;

    public async Task InitializeAsync()
    {
        if (!PostgresTestDatabase.IsBeschikbaar)
        {
            return;
        }

        _db = await PostgresTestDatabase.MaakAsync("gebruikerbeheer");
        _factory = new PostgresApiFactory(_db.ConnectionString);
    }

    public async Task DisposeAsync()
    {
        if (_factory is not null)
        {
            await _factory.DisposeAsync();
        }

        if (_db is not null)
        {
            await _db.DisposeAsync();
        }
    }

    // A margin of weeks on either side, so the school's clock (Brussels) and this UTC date never straddle a boundary.
    private static DateOnly Vandaag => DateOnly.FromDateTime(DateTime.UtcNow);

    // --- Who may: directie only (ADR-0030 §3). ---

    [PostgresTheory]
    [InlineData("themabeheer")]
    [InlineData("hoofdleerkracht")]
    [InlineData("leerkracht")]
    [InlineData("alles behalve directie")]
    [InlineData("geen recht")]
    public async Task Wie_geen_directie_is_krijgt_403_op_elke_route_en_verandert_niets(string soort)
    {
        var jaar = await BewaarSchooljaarAsync(Vandaag.AddDays(-30), Vandaag.AddDays(200), "K3");
        var klasId = jaar.Klassen.Single().Id;
        var beller = await BewaarGebruikerAsync(themabeheer: soort is "themabeheer" or "alles behalve directie");
        if (soort is "hoofdleerkracht" or "alles behalve directie")
        {
            await StelAanAsync(beller.Id, jaar.Id, "K3");
        }

        if (soort is "leerkracht" or "alles behalve directie")
        {
            await WijsToeAsync(beller.Id, klasId);
        }

        var doel = await BewaarGebruikerAsync(directie: true);
        using var client = _factory.MaakClientVoor(beller.Id);

        foreach (var (methode, url, inhoud) in Routes(doel.Id, klasId, jaar.Id))
        {
            using var verzoek = new HttpRequestMessage(methode, url) { Content = inhoud };
            using var antwoord = await client.SendAsync(verzoek);
            Assert.True(antwoord.StatusCode == HttpStatusCode.Forbidden, $"{methode} {url} answered {(int)antwoord.StatusCode}");
        }

        await using var context = _db.MaakContext();
        var bewaard = await context.Gebruikers.SingleAsync(g => g.Id == doel.Id);
        Assert.True(bewaard.IsDirectie);
        Assert.False(bewaard.HeeftThemabeheer);
        Assert.Equal(2, await context.Gebruikers.CountAsync());
        Assert.False(await context.Klastoewijzingen.AnyAsync(t => t.GebruikerId == doel.Id));
        Assert.False(await context.Hoofdleerkrachtaanstellingen.AnyAsync(a => a.GebruikerId == doel.Id));
    }

    [PostgresFact]
    public async Task Zonder_sessie_krijgt_elke_route_401()
    {
        var jaar = await BewaarSchooljaarAsync(Vandaag.AddDays(-30), Vandaag.AddDays(200), "K3");
        var doel = await BewaarGebruikerAsync(directie: true);
        using var client = _factory.MaakAnoniemeClient();

        foreach (var (methode, url, inhoud) in Routes(doel.Id, jaar.Klassen.Single().Id, jaar.Id))
        {
            using var verzoek = new HttpRequestMessage(methode, url) { Content = inhoud };
            using var antwoord = await client.SendAsync(verzoek);
            Assert.True(antwoord.StatusCode == HttpStatusCode.Unauthorized, $"{methode} {url} answered {(int)antwoord.StatusCode}");
        }
    }

    [PostgresFact]
    public async Task Een_directie_uit_de_database_mag_het_beheer()
    {
        var directie = await BewaarGebruikerAsync(directie: true);
        using var client = _factory.MaakClientVoor(directie.Id);

        using var antwoord = await client.GetAsync("/api/gebruikers");

        Assert.Equal(HttpStatusCode.OK, antwoord.StatusCode);
    }

    // --- The overview. ---

    [PostgresFact]
    public async Task Het_overzicht_toont_rechten_klassen_aanstellingen_en_wat_nog_meetelt()
    {
        var lopend = await BewaarSchooljaarAsync(Vandaag.AddDays(-30), Vandaag.AddDays(200), "K3", "L1");
        var voorbij = await BewaarSchooljaarAsync(Vandaag.AddDays(-400), Vandaag.AddDays(-35), "L4");
        var volgend = await BewaarSchooljaarAsync(Vandaag.AddDays(250), Vandaag.AddDays(550));
        var k3 = lopend.Klassen.Single(k => k.Jaarfase == "K3").Id;
        var zonderLeeftijd = lopend.Klassen.Single(k => k.Jaarfase == "L1").Id;
        await using (var context = _db.MaakContext())
        {
            // Only a legacy row can state no jaarfase; the domain refuses it now (ADR-0030 I12).
            await context.Klassen.Where(k => k.Id == zonderLeeftijd)
                .ExecuteUpdateAsync(zet => zet.SetProperty(k => k.Jaarfase, (string?)null));
        }

        var an = await BewaarGebruikerAsync(naam: "An", themabeheer: true);
        await WijsToeAsync(an.Id, k3);
        await WijsToeAsync(an.Id, zonderLeeftijd);
        await WijsToeAsync(an.Id, voorbij.Klassen.Single().Id);
        await StelAanAsync(an.Id, lopend.Id, "L2");
        await StelAanAsync(an.Id, lopend.Id, "K2");
        await StelAanAsync(an.Id, voorbij.Id, "L6");
        await StelAanAsync(an.Id, volgend.Id, "K3");
        var bert = await BewaarGebruikerAsync(naam: "Bert", directie: true, gekoppeld: true);

        using var client = _factory.CreateClient();
        using var antwoord = await client.GetAsync("/api/gebruikers");

        Assert.Equal(HttpStatusCode.OK, antwoord.StatusCode);
        using var document = JsonDocument.Parse(await antwoord.Content.ReadAsStringAsync());
        Assert.Equal(
            ["gebruikers", "voorbijeSchooljaarIds"],
            document.RootElement.EnumerateObject().Select(p => p.Name).Order(StringComparer.Ordinal));
        Assert.Equal(
            ["email", "heeftThemabeheer", "hoofdleerkrachtaanstellingen", "id", "isAangemeld", "isDirectie", "klastoewijzingen", "naam"],
            document.RootElement.GetProperty("gebruikers")[0].EnumerateObject().Select(p => p.Name).Order(StringComparer.Ordinal));

        var overzicht = document.RootElement.Deserialize<OverzichtDto>(Json)!;
        Assert.Equal([voorbij.Id], overzicht.VoorbijeSchooljaarIds);
        Assert.Equal(["An", "Bert"], overzicht.Gebruikers.Select(g => g.Naam));

        var anWeergave = overzicht.Gebruikers[0];
        Assert.False(anWeergave.IsDirectie);
        Assert.True(anWeergave.HeeftThemabeheer);
        Assert.False(anWeergave.IsAangemeld);

        // A klastoewijzing gives a leeftijd right only in a year that has not ended (R20) and on a stated jaarfase (I12).
        Assert.True(anWeergave.Klastoewijzingen.Single(t => t.KlasId == k3).TeltVoorGedeeldeInhoud);
        Assert.Equal("K3", anWeergave.Klastoewijzingen.Single(t => t.KlasId == k3).Jaarfase);
        Assert.False(anWeergave.Klastoewijzingen.Single(t => t.KlasId == zonderLeeftijd).TeltVoorGedeeldeInhoud);
        Assert.Null(anWeergave.Klastoewijzingen.Single(t => t.KlasId == zonderLeeftijd).Jaarfase);
        Assert.False(anWeergave.Klastoewijzingen.Single(t => t.SchooljaarId == voorbij.Id).TeltVoorGedeeldeInhoud);

        // In jaar/fase order; a year not yet started counts (R20).
        Assert.Equal(
            [("K2", lopend.Id, true), ("K3", volgend.Id, true), ("L2", lopend.Id, true), ("L6", voorbij.Id, false)],
            anWeergave.Hoofdleerkrachtaanstellingen.Select(a => (a.Jaarfase, a.SchooljaarId, a.TeltVoorGedeeldeInhoud)));

        var bertWeergave = overzicht.Gebruikers[1];
        Assert.Equal(bert.Id, bertWeergave.Id);
        Assert.True(bertWeergave.IsDirectie);
        Assert.True(bertWeergave.IsAangemeld);
        Assert.Empty(bertWeergave.Klastoewijzingen);
    }

    // --- Inviting (ADR-0031 decision 3). ---

    [PostgresFact]
    public async Task Uitnodigen_bewaart_de_genormaliseerde_aanmeldnaam_met_de_gevraagde_rechten()
    {
        using var client = _factory.CreateClient();

        using var antwoord = await client.PostAsJsonAsync(
            "/api/gebruikers",
            new { email = "  Carla.Maes@School.be ", naam = " Carla Maes ", heeftThemabeheer = true });

        Assert.Equal(HttpStatusCode.Created, antwoord.StatusCode);
        var weergave = (await antwoord.Content.ReadFromJsonAsync<GebruikerDto>(Json))!;
        Assert.Equal("carla.maes@school.be", weergave.Email);
        Assert.Equal("Carla Maes", weergave.Naam);
        Assert.True(weergave.HeeftThemabeheer);
        Assert.False(weergave.IsDirectie);
        Assert.False(weergave.IsAangemeld);
        Assert.EndsWith($"/api/gebruikers/{weergave.Id}", antwoord.Headers.Location!.ToString(), StringComparison.OrdinalIgnoreCase);
    }

    [PostgresFact]
    public async Task Een_tweede_uitnodiging_voor_dezelfde_aanmeldnaam_wordt_in_het_Nederlands_geweigerd()
    {
        using var client = _factory.CreateClient();
        using (var eerste = await client.PostAsJsonAsync("/api/gebruikers", new { email = "an@school.be", naam = "An" }))
        {
            Assert.Equal(HttpStatusCode.Created, eerste.StatusCode);
        }

        using var tweede = await client.PostAsJsonAsync("/api/gebruikers", new { email = " AN@school.BE", naam = "Andere An" });

        Assert.Equal(HttpStatusCode.Conflict, tweede.StatusCode);
        Assert.Equal("Er is al een gebruiker met de aanmeldnaam an@school.be.", await DetailAsync(tweede));
        await using var context = _db.MaakContext();
        Assert.Equal(1, await context.Gebruikers.CountAsync());
    }

    [PostgresTheory]
    [InlineData("")]
    [InlineData("an")]
    [InlineData("an@@school.be")]
    [InlineData("an peeters@school.be")]
    public async Task Een_ongeldige_aanmeldnaam_wordt_in_het_Nederlands_geweigerd(string email)
    {
        using var client = _factory.CreateClient();

        using var antwoord = await client.PostAsJsonAsync("/api/gebruikers", new { email, naam = "An" });

        Assert.Equal(HttpStatusCode.BadRequest, antwoord.StatusCode);
        Assert.Equal("Vul één Microsoft-aanmeldnaam in, zoals an.peeters@school.be.", await DetailAsync(antwoord));
    }

    // --- Themabeheer and the directie right (R4, R16). ---

    [PostgresFact]
    public async Task Themabeheer_en_het_directierecht_geven_en_afnemen()
    {
        var eerste = await BewaarGebruikerAsync(directie: true);
        var an = await BewaarGebruikerAsync();
        using var client = _factory.CreateClient();

        var metThemabeheer = await SchrijfAsync(client, HttpMethod.Put, $"/api/gebruikers/{an.Id}/themabeheer");
        var opnieuw = await SchrijfAsync(client, HttpMethod.Put, $"/api/gebruikers/{an.Id}/themabeheer");
        var metDirectie = await SchrijfAsync(client, HttpMethod.Put, $"/api/gebruikers/{an.Id}/directierecht");
        var zonderThemabeheer = await SchrijfAsync(client, HttpMethod.Delete, $"/api/gebruikers/{an.Id}/themabeheer");

        Assert.True(metThemabeheer.HeeftThemabeheer);
        Assert.True(opnieuw.HeeftThemabeheer);
        Assert.True(metDirectie.IsDirectie);
        Assert.False(zonderThemabeheer.HeeftThemabeheer);

        // Two directieleden now, so either may lose it; the one who is left may not.
        var eersteZonder = await SchrijfAsync(client, HttpMethod.Delete, $"/api/gebruikers/{eerste.Id}/directierecht");
        Assert.False(eersteZonder.IsDirectie);
        using var geweigerd = await client.DeleteAsync($"/api/gebruikers/{an.Id}/directierecht");
        Assert.Equal(HttpStatusCode.Conflict, geweigerd.StatusCode);

        // Taking it from someone who does not hold it is a no-op, not a refusal.
        var nogSteeds = await SchrijfAsync(client, HttpMethod.Delete, $"/api/gebruikers/{eerste.Id}/directierecht");
        Assert.False(nogSteeds.IsDirectie);
    }

    [PostgresFact]
    public async Task De_laatste_directie_kan_het_directierecht_niet_verliezen_en_hoort_waarom_in_het_Nederlands()
    {
        var enige = await BewaarGebruikerAsync(naam: "Dirk Janssens", directie: true);
        using var client = _factory.MaakClientVoor(enige.Id);

        using var antwoord = await client.DeleteAsync($"/api/gebruikers/{enige.Id}/directierecht");

        Assert.Equal(HttpStatusCode.Conflict, antwoord.StatusCode);
        // The guard on the server-composed Dutch (Art. II.3): the value, read, not merely that some detail exists.
        var detail = await DetailAsync(antwoord);
        Assert.Equal("Dirk Janssens is de enige met het directierecht. Geef het directierecht eerst aan iemand anders.", detail);
        Assert.DoesNotContain("—", detail);
        await using var context = _db.MaakContext();
        Assert.True((await context.Gebruikers.SingleAsync(g => g.Id == enige.Id)).IsDirectie);
    }

    [PostgresFact]
    public async Task De_laatste_directie_kan_niet_verwijderd_worden_en_hoort_waarom_in_het_Nederlands()
    {
        var enige = await BewaarGebruikerAsync(naam: "Dirk Janssens", directie: true);
        using var client = _factory.CreateClient();

        using var antwoord = await client.DeleteAsync($"/api/gebruikers/{enige.Id}");

        Assert.Equal(HttpStatusCode.Conflict, antwoord.StatusCode);
        var detail = await DetailAsync(antwoord);
        Assert.Equal(
            "Dirk Janssens is de enige met het directierecht en kan niet verwijderd worden. Geef het directierecht eerst aan iemand anders.",
            detail);
        Assert.DoesNotContain("—", detail);
        await using var context = _db.MaakContext();
        Assert.True(await context.Gebruikers.AnyAsync(g => g.Id == enige.Id));
    }

    [PostgresFact]
    public async Task Een_directie_mag_zichzelf_verwijderen_zolang_er_een_andere_directie_blijft()
    {
        var ik = await BewaarGebruikerAsync(directie: true);
        var ander = await BewaarGebruikerAsync(directie: true);
        using var client = _factory.MaakClientVoor(ik.Id);

        using var antwoord = await client.DeleteAsync($"/api/gebruikers/{ik.Id}");

        Assert.Equal(HttpStatusCode.NoContent, antwoord.StatusCode);
        await using var context = _db.MaakContext();
        Assert.False(await context.Gebruikers.AnyAsync(g => g.Id == ik.Id));
        Assert.True((await context.Gebruikers.SingleAsync(g => g.Id == ander.Id)).IsDirectie);
    }

    /// <summary>
    /// The transaction boundary of the guard. Another directie tab is frozen halfway through demoting Bert: it holds
    /// the lock the service takes and has written, but not committed. A plain count would still see Bert as directie
    /// and let An go too, leaving nobody. The service must wait for that commit, count again, and refuse.
    /// </summary>
    [PostgresFact]
    public async Task Twee_directieleden_die_elkaar_tegelijk_afzetten_laten_er_een_over()
    {
        var an = await BewaarGebruikerAsync(naam: "An", directie: true);
        var bert = await BewaarGebruikerAsync(naam: "Bert", directie: true);

        await using var ander = _db.MaakContext();
        await using var transactie = await ander.Database.BeginTransactionAsync();
        await ander.Database.ExecuteSqlRawAsync("""SELECT "Id" FROM gebruikers WHERE "IsDirectie" ORDER BY "Id" FOR UPDATE""");
        await ander.Gebruikers.Where(g => g.Id == bert.Id)
            .ExecuteUpdateAsync(zet => zet.SetProperty(g => g.IsDirectie, false));

        using var client = _factory.CreateClient();
        var afzetting = client.DeleteAsync($"/api/gebruikers/{an.Id}/directierecht");

        var eerst = await Task.WhenAny(afzetting, Task.Delay(TimeSpan.FromSeconds(1)));
        Assert.NotSame(afzetting, eerst);

        await transactie.CommitAsync();
        using var antwoord = await afzetting;

        Assert.Equal(HttpStatusCode.Conflict, antwoord.StatusCode);
        await using var context = _db.MaakContext();
        Assert.True((await context.Gebruikers.SingleAsync(g => g.Id == an.Id)).IsDirectie);
        Assert.Equal(1, await context.Gebruikers.CountAsync(g => g.IsDirectie));
    }

    // --- Klastoewijzingen (R15). ---

    [PostgresFact]
    public async Task Een_leerkracht_aan_een_klas_koppelen_en_weer_ontkoppelen()
    {
        var jaar = await BewaarSchooljaarAsync(Vandaag.AddDays(-30), Vandaag.AddDays(200), "K3");
        var klasId = jaar.Klassen.Single().Id;
        var an = await BewaarGebruikerAsync();
        var bert = await BewaarGebruikerAsync();
        using var client = _factory.CreateClient();

        var gekoppeld = await SchrijfAsync(client, HttpMethod.Put, $"/api/gebruikers/{an.Id}/klassen/{klasId}");
        await SchrijfAsync(client, HttpMethod.Put, $"/api/gebruikers/{an.Id}/klassen/{klasId}");
        // A co-teacher on the same klas (R15).
        await SchrijfAsync(client, HttpMethod.Put, $"/api/gebruikers/{bert.Id}/klassen/{klasId}");

        Assert.Equal(klasId, gekoppeld.Klastoewijzingen.Single().KlasId);
        Assert.True(gekoppeld.Klastoewijzingen.Single().TeltVoorGedeeldeInhoud);
        await using (var context = _db.MaakContext())
        {
            Assert.Equal(2, await context.Klastoewijzingen.CountAsync(t => t.KlasId == klasId));
        }

        var ontkoppeld = await SchrijfAsync(client, HttpMethod.Delete, $"/api/gebruikers/{an.Id}/klassen/{klasId}");
        Assert.Empty(ontkoppeld.Klastoewijzingen);
        // Unlinking what is not linked is a no-op.
        await SchrijfAsync(client, HttpMethod.Delete, $"/api/gebruikers/{an.Id}/klassen/{klasId}");

        // What the link gives shows in the rights at once: the next request reads them afresh.
        using var alsBert = _factory.MaakClientVoor(bert.Id);
        var ik = await alsBert.GetFromJsonAsync<IkDto>("/api/ik");
        Assert.Equal([klasId], ik!.EigenKlasIds);
        Assert.Equal(["K3"], ik.LeerkrachtLeeftijden);
    }

    [PostgresFact]
    public async Task Koppelen_aan_een_onbekende_klas_of_gebruiker_is_404()
    {
        var jaar = await BewaarSchooljaarAsync(Vandaag.AddDays(-30), Vandaag.AddDays(200), "K3");
        var an = await BewaarGebruikerAsync();
        using var client = _factory.CreateClient();

        using var onbekendeKlas = await client.PutAsync($"/api/gebruikers/{an.Id}/klassen/{Guid.NewGuid()}", null);
        using var onbekendeGebruiker = await client.PutAsync($"/api/gebruikers/{Guid.NewGuid()}/klassen/{jaar.Klassen.Single().Id}", null);

        Assert.Equal(HttpStatusCode.NotFound, onbekendeKlas.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, onbekendeGebruiker.StatusCode);
    }

    // --- Hoofdleerkrachten (R5, I20). ---

    [PostgresFact]
    public async Task Hoofdleerkrachten_aanstellen_zonder_klas_meerdere_per_jaarfase_en_weer_intrekken()
    {
        var jaar = await BewaarSchooljaarAsync(Vandaag.AddDays(-30), Vandaag.AddDays(200));
        var an = await BewaarGebruikerAsync();
        var bert = await BewaarGebruikerAsync();
        using var client = _factory.CreateClient();

        var anAangesteld = await SchrijfAsync(client, HttpMethod.Put, $"/api/gebruikers/{an.Id}/hoofdleerkracht/{jaar.Id}/K3");
        await SchrijfAsync(client, HttpMethod.Put, $"/api/gebruikers/{an.Id}/hoofdleerkracht/{jaar.Id}/K3");
        await SchrijfAsync(client, HttpMethod.Put, $"/api/gebruikers/{bert.Id}/hoofdleerkracht/{jaar.Id}/K3");

        Assert.Equal(("K3", jaar.Id, true), anAangesteld.Hoofdleerkrachtaanstellingen.Select(a => (a.Jaarfase, a.SchooljaarId, a.TeltVoorGedeeldeInhoud)).Single());
        await using (var context = _db.MaakContext())
        {
            Assert.Equal(2, await context.Hoofdleerkrachtaanstellingen.CountAsync(a => a.SchooljaarId == jaar.Id && a.Jaarfase == "K3"));
        }

        // No klastoewijzing, and still hoofdleerkracht (I20).
        using (var alsAn = _factory.MaakClientVoor(an.Id))
        {
            var ik = await alsAn.GetFromJsonAsync<IkDto>("/api/ik");
            Assert.Equal(["K3"], ik!.HoofdleerkrachtLeeftijden);
            Assert.Empty(ik.EigenKlasIds);
        }

        var ingetrokken = await SchrijfAsync(client, HttpMethod.Delete, $"/api/gebruikers/{an.Id}/hoofdleerkracht/{jaar.Id}/K3");
        Assert.Empty(ingetrokken.Hoofdleerkrachtaanstellingen);
    }

    [PostgresTheory]
    [InlineData("K7", "'K7' is geen bekende leeftijd. Kies JK, K2, K3 of L1 tot L6.")]
    [InlineData("k3", "'k3' is geen bekende leeftijd. Kies JK, K2, K3 of L1 tot L6.")]
    [InlineData("3K", "'3K' is geen bekende leeftijd. Kies JK, K2, K3 of L1 tot L6.")]
    public async Task Een_onbekende_jaarfase_wordt_met_de_zin_van_de_leeftijdsregel_geweigerd(string jaarfase, string zin)
    {
        var jaar = await BewaarSchooljaarAsync(Vandaag.AddDays(-30), Vandaag.AddDays(200));
        var an = await BewaarGebruikerAsync();
        using var client = _factory.CreateClient();

        using var aanstellen = await client.PutAsync($"/api/gebruikers/{an.Id}/hoofdleerkracht/{jaar.Id}/{jaarfase}", null);
        using var intrekken = await client.DeleteAsync($"/api/gebruikers/{an.Id}/hoofdleerkracht/{jaar.Id}/{jaarfase}");

        Assert.Equal(HttpStatusCode.BadRequest, aanstellen.StatusCode);
        Assert.Equal(zin, await DetailAsync(aanstellen));
        Assert.Equal(HttpStatusCode.BadRequest, intrekken.StatusCode);
    }

    [PostgresFact]
    public async Task Aanstellen_in_een_onbekend_schooljaar_is_404()
    {
        var an = await BewaarGebruikerAsync();
        using var client = _factory.CreateClient();

        using var antwoord = await client.PutAsync($"/api/gebruikers/{an.Id}/hoofdleerkracht/{Guid.NewGuid()}/K3", null);

        Assert.Equal(HttpStatusCode.NotFound, antwoord.StatusCode);
    }

    // --- Removing a gebruiker (I17). ---

    [PostgresFact]
    public async Task Een_gebruiker_verwijderen_laat_zijn_activiteiten_gedeeld_en_ruimt_klassen_en_aanstellingen_op()
    {
        var jaar = await BewaarSchooljaarAsync(Vandaag.AddDays(-30), Vandaag.AddDays(200), "K3");
        var an = await BewaarGebruikerAsync();
        await WijsToeAsync(an.Id, jaar.Klassen.Single().Id);
        await StelAanAsync(an.Id, jaar.Id, "K3");
        using var directie = _factory.CreateClient();
        var subthemaId = await MaakSubthemaAsync(directie, "K3");
        // Made by An, who is hoofdleerkracht and leerkracht of K3, so the maker is An whatever route rights apply.
        using var alsAn = _factory.MaakClientVoor(an.Id);
        var activiteitId = await MaakActiviteitAsync(alsAn, subthemaId);

        using var antwoord = await directie.DeleteAsync($"/api/gebruikers/{an.Id}");

        Assert.Equal(HttpStatusCode.NoContent, antwoord.StatusCode);
        await using var context = _db.MaakContext();
        Assert.False(await context.Gebruikers.AnyAsync(g => g.Id == an.Id));
        var activiteit = await context.Activiteiten.SingleAsync(a => a.Id == activiteitId);
        Assert.Null(activiteit.MakerId);
        Assert.False(await context.Klastoewijzingen.AnyAsync(t => t.GebruikerId == an.Id));
        Assert.False(await context.Hoofdleerkrachtaanstellingen.AnyAsync(a => a.GebruikerId == an.Id));
        Assert.True(await context.Klassen.AnyAsync(k => k.Id == jaar.Klassen.Single().Id));

        using var weg = await directie.GetAsync($"/api/gebruikers/{an.Id}");
        Assert.Equal(HttpStatusCode.NotFound, weg.StatusCode);
    }

    // --- Helpers. ---

    private static IEnumerable<(HttpMethod Methode, string Url, HttpContent? Inhoud)> Routes(Guid doel, Guid klasId, Guid schooljaarId) =>
    [
        (HttpMethod.Get, "/api/gebruikers", null),
        (HttpMethod.Get, $"/api/gebruikers/{doel}", null),
        (HttpMethod.Post, "/api/gebruikers", JsonContent.Create(new { email = "nieuw@school.be", naam = "Nieuw", isDirectie = true })),
        (HttpMethod.Delete, $"/api/gebruikers/{doel}", null),
        (HttpMethod.Put, $"/api/gebruikers/{doel}/directierecht", null),
        (HttpMethod.Delete, $"/api/gebruikers/{doel}/directierecht", null),
        (HttpMethod.Put, $"/api/gebruikers/{doel}/themabeheer", null),
        (HttpMethod.Delete, $"/api/gebruikers/{doel}/themabeheer", null),
        (HttpMethod.Put, $"/api/gebruikers/{doel}/klassen/{klasId}", null),
        (HttpMethod.Delete, $"/api/gebruikers/{doel}/klassen/{klasId}", null),
        (HttpMethod.Put, $"/api/gebruikers/{doel}/hoofdleerkracht/{schooljaarId}/K3", null),
        (HttpMethod.Delete, $"/api/gebruikers/{doel}/hoofdleerkracht/{schooljaarId}/K3", null),
    ];

    private static async Task<GebruikerDto> SchrijfAsync(HttpClient client, HttpMethod methode, string url)
    {
        using var antwoord = await client.SendAsync(new HttpRequestMessage(methode, url));
        Assert.True(antwoord.StatusCode == HttpStatusCode.OK, $"{methode} {url} answered {(int)antwoord.StatusCode}");
        return (await antwoord.Content.ReadFromJsonAsync<GebruikerDto>(Json))!;
    }

    private static async Task<string?> DetailAsync(HttpResponseMessage antwoord)
    {
        using var document = JsonDocument.Parse(await antwoord.Content.ReadAsStringAsync());
        return document.RootElement.TryGetProperty("detail", out var detail) ? detail.GetString() : null;
    }

    private async Task<Gebruiker> BewaarGebruikerAsync(
        string naam = "Test",
        bool directie = false,
        bool themabeheer = false,
        bool gekoppeld = false)
    {
        var gebruiker = new Gebruiker($"{Guid.NewGuid():N}@school.be", naam, isDirectie: directie);
        if (themabeheer)
        {
            gebruiker.GeefThemabeheer();
        }

        if (gekoppeld)
        {
            gebruiker.KoppelAanEntra(Guid.NewGuid(), Guid.NewGuid(), naam: null);
        }

        await using var context = _db.MaakContext();
        context.Gebruikers.Add(gebruiker);
        await context.SaveChangesAsync();
        return gebruiker;
    }

    private async Task<Schooljaar> BewaarSchooljaarAsync(DateOnly start, DateOnly eind, params string[] klasJaarfasen)
    {
        var schooljaar = new Schooljaar(TestSchooljaar.UniekeNaam("beheer"), start, eind);
        foreach (var jaarfase in klasJaarfasen)
        {
            schooljaar.VoegKlasToe($"{jaarfase}-{Guid.NewGuid():N}", jaarfase);
        }

        await using var context = _db.MaakContext();
        context.Schooljaren.Add(schooljaar);
        await context.SaveChangesAsync();
        return schooljaar;
    }

    private async Task WijsToeAsync(Guid gebruikerId, Guid klasId)
    {
        await using var context = _db.MaakContext();
        context.Klastoewijzingen.Add(new Klastoewijzing(gebruikerId, klasId));
        await context.SaveChangesAsync();
    }

    private async Task StelAanAsync(Guid gebruikerId, Guid schooljaarId, string jaarfase)
    {
        await using var context = _db.MaakContext();
        context.Hoofdleerkrachtaanstellingen.Add(new Hoofdleerkrachtaanstelling(gebruikerId, schooljaarId, jaarfase));
        await context.SaveChangesAsync();
    }

    private static async Task<Guid> MaakSubthemaAsync(HttpClient client, string leeftijd)
    {
        using var themaAntwoord = await client.PostAsJsonAsync("/api/themas", new { naam = $"Thema {Guid.NewGuid():N}", duurWeken = 4 });
        Assert.Equal(HttpStatusCode.Created, themaAntwoord.StatusCode);
        var thema = await themaAntwoord.Content.ReadFromJsonAsync<IdDto>(Json);

        using var subthemaAntwoord = await client.PostAsJsonAsync(
            $"/api/themas/{thema!.Id}/subthemas", new { naam = "Regen", duurWeken = 2, leeftijd });
        Assert.Equal(HttpStatusCode.Created, subthemaAntwoord.StatusCode);
        return (await subthemaAntwoord.Content.ReadFromJsonAsync<IdDto>(Json))!.Id;
    }

    private static async Task<Guid> MaakActiviteitAsync(HttpClient client, Guid subthemaId)
    {
        using var antwoord = await client.PostAsJsonAsync(
            $"/api/subthemas/{subthemaId}/activiteiten",
            new { naam = $"Proef {Guid.NewGuid():N}", activiteitType = nameof(ActiviteitType.Experiment) });
        Assert.Equal(HttpStatusCode.Created, antwoord.StatusCode);
        return (await antwoord.Content.ReadFromJsonAsync<IdDto>(Json))!.Id;
    }

    private sealed record IdDto(Guid Id);

    private sealed record OverzichtDto(List<GebruikerDto> Gebruikers, List<Guid> VoorbijeSchooljaarIds);

    private sealed record GebruikerDto(
        Guid Id,
        string Naam,
        string Email,
        bool IsDirectie,
        bool HeeftThemabeheer,
        bool IsAangemeld,
        List<KlastoewijzingDto> Klastoewijzingen,
        List<AanstellingDto> Hoofdleerkrachtaanstellingen);

    private sealed record KlastoewijzingDto(Guid KlasId, string KlasNaam, string? Jaarfase, Guid SchooljaarId, bool TeltVoorGedeeldeInhoud);

    private sealed record AanstellingDto(Guid SchooljaarId, string Jaarfase, bool TeltVoorGedeeldeInhoud);

    private sealed record IkDto(string[] HoofdleerkrachtLeeftijden, string[] LeerkrachtLeeftijden, Guid[] EigenKlasIds);
}
