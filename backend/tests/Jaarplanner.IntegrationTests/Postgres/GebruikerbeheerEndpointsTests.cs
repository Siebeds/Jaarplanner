using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Jaarplanner.Api.Infrastructure.Authenticatie;
using Jaarplanner.Application.Toegang;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.Domain.Toegang;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace Jaarplanner.IntegrationTests.Postgres;

/// <summary>
/// Directie's beheer of gebruikers and rights (E6-04, FA FR-12.2, Art. VI.1, ADR-0030 §3 row "Gebruikers … beheren",
/// directie only) against real PostgreSQL: who may call it, what the overview shows, the invitation, the rights,
/// klastoewijzingen and appointments, removal with its cascades, and the last-directie guard (ADR-0031 decision 7),
/// including the lock that stops two directieleden demoting or removing each other at once.
/// <para>
/// On Postgres because the guard's lock, the cascades, SET NULL on the maker, the unique indexes and the foreign keys are
/// database behaviour the in-memory provider does not have. The default test identity is directie without a row (see
/// <see cref="TestAuthenticatie"/>), so it never counts as one of the directieleden the guard counts.
/// </para>
/// <para>
/// <b>Every request here runs the production rule</b> (<see cref="GebruikerbeheerOpties"/>: only a bound directie can
/// sign in). The test host starts in Development with the development sign-in, where the Api switches the rule to
/// "every directie can sign in"; <see cref="_productie"/> switches it back, and the one test of the development rule
/// uses <see cref="_factory"/> on purpose.
/// </para>
/// </summary>
public sealed class GebruikerbeheerEndpointsTests : IAsyncLifetime
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private PostgresTestDatabase _db = null!;
    private PostgresApiFactory _factory = null!;
    private WebApplicationFactory<Program> _productie = null!;

    public async Task InitializeAsync()
    {
        if (!PostgresTestDatabase.IsBeschikbaar)
        {
            return;
        }

        _db = await PostgresTestDatabase.MaakAsync("gebruikerbeheer");
        _factory = new PostgresApiFactory(_db.ConnectionString);
        _productie = _factory.WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
            services.PostConfigure<GebruikerbeheerOpties>(o => o.OngekoppeldeDirectieKanAanmelden = false)));
    }

    public async Task DisposeAsync()
    {
        if (_productie is not null)
        {
            await _productie.DisposeAsync();
        }

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
        using var client = ClientVoor(beller.Id);

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
        using var client = AnoniemeClient();

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
        using var client = ClientVoor(directie.Id);

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

        var an = await BewaarGebruikerAsync(naam: "An", themabeheer: true, gekoppeld: false);
        await WijsToeAsync(an.Id, k3);
        await WijsToeAsync(an.Id, zonderLeeftijd);
        await WijsToeAsync(an.Id, voorbij.Klassen.Single().Id);
        await StelAanAsync(an.Id, lopend.Id, "L2");
        await StelAanAsync(an.Id, lopend.Id, "K2");
        await StelAanAsync(an.Id, voorbij.Id, "L6");
        await StelAanAsync(an.Id, volgend.Id, "K3");
        var bert = await BewaarGebruikerAsync(naam: "Bert", directie: true);

        using var client = Client();
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
        using var client = Client();

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
        using var client = Client();
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
        using var client = Client();

        using var antwoord = await client.PostAsJsonAsync("/api/gebruikers", new { email, naam = "An" });

        Assert.Equal(HttpStatusCode.BadRequest, antwoord.StatusCode);
        Assert.Equal("Vul één Microsoft-aanmeldnaam in, zoals an.peeters@school.be.", await DetailAsync(antwoord));
    }

    [PostgresFact]
    public async Task Een_te_lange_naam_of_aanmeldnaam_wordt_in_het_Nederlands_geweigerd()
    {
        using var client = Client();

        using var langeNaam = await client.PostAsJsonAsync("/api/gebruikers", new { email = "an@school.be", naam = new string('a', 257) });
        using var langeAanmeldnaam = await client.PostAsJsonAsync(
            "/api/gebruikers", new { email = new string('a', 311) + "@school.be", naam = "An" });

        Assert.Equal(HttpStatusCode.BadRequest, langeNaam.StatusCode);
        Assert.Equal("Een naam is hoogstens 256 tekens lang.", await DetailAsync(langeNaam));
        Assert.Equal(HttpStatusCode.BadRequest, langeAanmeldnaam.StatusCode);
        Assert.Equal("Een aanmeldnaam is hoogstens 320 tekens lang.", await DetailAsync(langeAanmeldnaam));
        await using var context = _db.MaakContext();
        Assert.Equal(0, await context.Gebruikers.CountAsync());
    }

    // --- Themabeheer and the directie right (R4, R16). ---

    [PostgresFact]
    public async Task Themabeheer_en_het_directierecht_geven_en_afnemen()
    {
        var eerste = await BewaarGebruikerAsync(directie: true);
        var an = await BewaarGebruikerAsync();
        using var client = Client();

        var metThemabeheer = await SchrijfAsync(client, HttpMethod.Put, $"/api/gebruikers/{an.Id}/themabeheer");
        var opnieuw = await SchrijfAsync(client, HttpMethod.Put, $"/api/gebruikers/{an.Id}/themabeheer");
        var metDirectie = await SchrijfAsync(client, HttpMethod.Put, $"/api/gebruikers/{an.Id}/directierecht");
        var zonderThemabeheer = await SchrijfAsync(client, HttpMethod.Delete, $"/api/gebruikers/{an.Id}/themabeheer");

        Assert.True(metThemabeheer.HeeftThemabeheer);
        Assert.True(opnieuw.HeeftThemabeheer);
        Assert.True(metDirectie.IsDirectie);
        Assert.False(zonderThemabeheer.HeeftThemabeheer);

        // Two bound directieleden now, so either may lose it; the one who is left may not.
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
        using var client = ClientVoor(enige.Id);

        using var antwoord = await client.DeleteAsync($"/api/gebruikers/{enige.Id}/directierecht");

        Assert.Equal(HttpStatusCode.Conflict, antwoord.StatusCode);
        // The guard on the server-composed Dutch (Art. II.3): the value, read, not merely that some detail exists.
        var detail = await DetailAsync(antwoord);
        Assert.Equal("Dirk Janssens is de enige met het directierecht. Geef het directierecht eerst aan iemand anders die zich al heeft aangemeld.", detail);
        Assert.DoesNotContain("—", detail);
        await using var context = _db.MaakContext();
        Assert.True((await context.Gebruikers.SingleAsync(g => g.Id == enige.Id)).IsDirectie);
    }

    [PostgresFact]
    public async Task De_laatste_directie_kan_niet_verwijderd_worden_en_hoort_waarom_in_het_Nederlands()
    {
        var enige = await BewaarGebruikerAsync(naam: "Dirk Janssens", directie: true);
        using var client = Client();

        using var antwoord = await client.DeleteAsync($"/api/gebruikers/{enige.Id}");

        Assert.Equal(HttpStatusCode.Conflict, antwoord.StatusCode);
        var detail = await DetailAsync(antwoord);
        Assert.Equal(
            "Dirk Janssens is de enige met het directierecht en kan niet verwijderd worden. Geef het directierecht eerst aan iemand anders die zich al heeft aangemeld.",
            detail);
        Assert.DoesNotContain("—", detail);
        await using var context = _db.MaakContext();
        Assert.True(await context.Gebruikers.AnyAsync(g => g.Id == enige.Id));
    }

    /// <summary>
    /// MAJOR 1 of the slice 2 audit: an unbound directie invitation is not a directie who can sign in (a mistyped UPN,
    /// someone who never comes), so it cannot be what lets the last bound one go. The refusal says why.
    /// </summary>
    [PostgresFact]
    public async Task Een_directie_die_zich_nog_niet_aanmeldde_telt_niet_mee_voor_de_laatste_directie()
    {
        var dirk = await BewaarGebruikerAsync(naam: "Dirk Janssens", directie: true);
        await BewaarGebruikerAsync(naam: "Eva Peeters", directie: true, gekoppeld: false);
        using var client = ClientVoor(dirk.Id);

        using var afgeven = await client.DeleteAsync($"/api/gebruikers/{dirk.Id}/directierecht");
        using var verwijderen = await client.DeleteAsync($"/api/gebruikers/{dirk.Id}");

        Assert.Equal(HttpStatusCode.Conflict, afgeven.StatusCode);
        Assert.Equal(
            "Dirk Janssens is de enige met het directierecht die zich al heeft aangemeld. "
            + "Wie verder het directierecht heeft, heeft zich nog niet aangemeld, dus het directierecht kan nog niet weg.",
            await DetailAsync(afgeven));
        Assert.Equal(HttpStatusCode.Conflict, verwijderen.StatusCode);
        Assert.Equal(
            "Dirk Janssens is de enige met het directierecht die zich al heeft aangemeld, en kan niet verwijderd worden. "
            + "Wie verder het directierecht heeft, heeft zich nog niet aangemeld.",
            await DetailAsync(verwijderen));
        await using var context = _db.MaakContext();
        Assert.True((await context.Gebruikers.SingleAsync(g => g.Id == dirk.Id)).IsDirectie);
    }

    [PostgresFact]
    public async Task Zodra_een_tweede_directie_zich_aanmeldde_mag_het_directierecht_weg()
    {
        var dirk = await BewaarGebruikerAsync(naam: "Dirk Janssens", directie: true);
        var eva = await BewaarGebruikerAsync(naam: "Eva Peeters", directie: true, gekoppeld: false);
        using var client = ClientVoor(dirk.Id);
        using (var voorAanmelding = await client.DeleteAsync($"/api/gebruikers/{dirk.Id}/directierecht"))
        {
            Assert.Equal(HttpStatusCode.Conflict, voorAanmelding.StatusCode);
        }

        await BindAsync(eva.Id);

        var afgegeven = await SchrijfAsync(client, HttpMethod.Delete, $"/api/gebruikers/{dirk.Id}/directierecht");
        Assert.False(afgegeven.IsDirectie);
    }

    [PostgresFact]
    public async Task Zodra_een_tweede_directie_zich_aanmeldde_mag_de_eerste_verwijderd_worden()
    {
        var dirk = await BewaarGebruikerAsync(naam: "Dirk Janssens", directie: true);
        var eva = await BewaarGebruikerAsync(naam: "Eva Peeters", directie: true, gekoppeld: false);
        using var client = ClientVoor(dirk.Id);
        using (var voorAanmelding = await client.DeleteAsync($"/api/gebruikers/{dirk.Id}"))
        {
            Assert.Equal(HttpStatusCode.Conflict, voorAanmelding.StatusCode);
        }

        await BindAsync(eva.Id);

        using var antwoord = await client.DeleteAsync($"/api/gebruikers/{dirk.Id}");

        Assert.Equal(HttpStatusCode.NoContent, antwoord.StatusCode);
        await using var context = _db.MaakContext();
        Assert.False(await context.Gebruikers.AnyAsync(g => g.Id == dirk.Id));
    }

    [PostgresFact]
    public async Task Een_directie_die_zich_nog_niet_aanmeldde_mag_zelf_weg_zolang_er_een_aangemelde_blijft()
    {
        var dirk = await BewaarGebruikerAsync(naam: "Dirk Janssens", directie: true);
        var eva = await BewaarGebruikerAsync(naam: "Eva Peeters", directie: true, gekoppeld: false);
        using var client = ClientVoor(dirk.Id);

        var afgegeven = await SchrijfAsync(client, HttpMethod.Delete, $"/api/gebruikers/{eva.Id}/directierecht");
        using var verwijderd = await client.DeleteAsync($"/api/gebruikers/{eva.Id}");

        Assert.False(afgegeven.IsDirectie);
        Assert.Equal(HttpStatusCode.NoContent, verwijderd.StatusCode);
    }

    /// <summary>
    /// The one place the rule differs, and it is explicit: under the development sign-in nobody is ever bound and every
    /// directie can sign in by being picked, so there an unbound directie counts. This host is the Development one with
    /// that sign-in, as a developer's machine runs it.
    /// </summary>
    [PostgresFact]
    public async Task Onder_de_ontwikkelaanmelding_telt_een_directie_die_niet_gekoppeld_is_wel_mee()
    {
        var dirk = await BewaarGebruikerAsync(naam: "Dirk Janssens", directie: true, gekoppeld: false);
        await BewaarGebruikerAsync(naam: "Eva Peeters", directie: true, gekoppeld: false);
        using var client = _factory.MaakClientVoor(dirk.Id);

        using var antwoord = await client.DeleteAsync($"/api/gebruikers/{dirk.Id}/directierecht");

        Assert.Equal(HttpStatusCode.OK, antwoord.StatusCode);
    }

    [Fact]
    public void Alleen_de_ontwikkelaanmelding_laat_een_directie_die_niet_gekoppeld_is_meetellen()
    {
        using var entra = new JaarplannerApiFactory().WithWebHostBuilder(builder =>
        {
            builder.UseSetting("Authenticatie:Modus", "Entra");
            builder.UseSetting("Authenticatie:Entra:TenantId", "11111111-0000-0000-0000-000000000000");
            builder.UseSetting("Authenticatie:Entra:ClientId", "22222222-0000-0000-0000-000000000000");
            builder.UseSetting("Authenticatie:Entra:ClientSecret", "test-only-not-a-secret");
        });
        using var ontwikkeling = new JaarplannerApiFactory().WithWebHostBuilder(builder =>
            builder.UseSetting("Authenticatie:Modus", "Ontwikkeling"));

        Assert.False(new GebruikerbeheerOpties().OngekoppeldeDirectieKanAanmelden);
        Assert.False(entra.Services.GetRequiredService<IOptions<GebruikerbeheerOpties>>().Value.OngekoppeldeDirectieKanAanmelden);
        Assert.True(ontwikkeling.Services.GetRequiredService<IOptions<GebruikerbeheerOpties>>().Value.OngekoppeldeDirectieKanAanmelden);
    }

    [PostgresFact]
    public async Task Een_directie_mag_zichzelf_verwijderen_zolang_er_een_andere_directie_blijft()
    {
        var ik = await BewaarGebruikerAsync(directie: true);
        var ander = await BewaarGebruikerAsync(directie: true);
        using var client = ClientVoor(ik.Id);

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
        await using var ander = await HoudDirectieVastEnZetAfAsync(bert.Id);

        using var client = Client();
        var afzetting = client.DeleteAsync($"/api/gebruikers/{an.Id}/directierecht");

        var eerst = await Task.WhenAny(afzetting, Task.Delay(TimeSpan.FromSeconds(1)));
        Assert.NotSame(afzetting, eerst);

        await ander.Database.CommitTransactionAsync();
        using var antwoord = await afzetting;

        Assert.Equal(HttpStatusCode.Conflict, antwoord.StatusCode);
        await using var context = _db.MaakContext();
        Assert.True((await context.Gebruikers.SingleAsync(g => g.Id == an.Id)).IsDirectie);
        Assert.Equal(1, await context.Gebruikers.CountAsync(g => g.IsDirectie));
    }

    /// <summary>The same boundary on the other write that can remove a directie: removing An while Bert is being demoted.</summary>
    [PostgresFact]
    public async Task Een_directie_verwijderen_terwijl_een_andere_wordt_afgezet_laat_er_een_over()
    {
        var an = await BewaarGebruikerAsync(naam: "An", directie: true);
        var bert = await BewaarGebruikerAsync(naam: "Bert", directie: true);
        await using var ander = await HoudDirectieVastEnZetAfAsync(bert.Id);

        using var client = Client();
        var verwijdering = client.DeleteAsync($"/api/gebruikers/{an.Id}");

        var eerst = await Task.WhenAny(verwijdering, Task.Delay(TimeSpan.FromSeconds(1)));
        Assert.NotSame(verwijdering, eerst);

        await ander.Database.CommitTransactionAsync();
        using var antwoord = await verwijdering;

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
        using var client = Client();

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
        using var alsBert = ClientVoor(bert.Id);
        var ik = await alsBert.GetFromJsonAsync<IkDto>("/api/ik");
        Assert.Equal([klasId], ik!.EigenKlasIds);
        Assert.Equal(["K3"], ik.LeerkrachtLeeftijden);
    }

    [PostgresFact]
    public async Task Koppelen_aan_een_onbekende_klas_of_gebruiker_is_404()
    {
        var jaar = await BewaarSchooljaarAsync(Vandaag.AddDays(-30), Vandaag.AddDays(200), "K3");
        var an = await BewaarGebruikerAsync();
        using var client = Client();

        using var onbekendeKlas = await client.PutAsync($"/api/gebruikers/{an.Id}/klassen/{Guid.NewGuid()}", null);
        using var onbekendeGebruiker = await client.PutAsync($"/api/gebruikers/{Guid.NewGuid()}/klassen/{jaar.Klassen.Single().Id}", null);

        Assert.Equal(HttpStatusCode.NotFound, onbekendeKlas.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, onbekendeGebruiker.StatusCode);
    }

    /// <summary>
    /// MINOR 6 of the slice 2 audit: the klas exists when the link is checked and is gone when it is inserted. Another
    /// transaction has deleted it without committing, so the insert's foreign-key check waits for it, and fails once it
    /// commits. That is a 404 with a Dutch sentence, not a 500.
    /// </summary>
    [PostgresFact]
    public async Task Koppelen_aan_een_klas_die_intussen_verwijderd_wordt_is_404_en_geen_500()
    {
        var jaar = await BewaarSchooljaarAsync(Vandaag.AddDays(-30), Vandaag.AddDays(200), "K3");
        var klasId = jaar.Klassen.Single().Id;
        var an = await BewaarGebruikerAsync();

        await using var ander = _db.MaakContext();
        await ander.Database.BeginTransactionAsync();
        await ander.Klassen.Where(k => k.Id == klasId).ExecuteDeleteAsync();

        using var client = Client();
        var koppeling = client.PutAsync($"/api/gebruikers/{an.Id}/klassen/{klasId}", null);

        var eerst = await Task.WhenAny(koppeling, Task.Delay(TimeSpan.FromSeconds(1)));
        Assert.NotSame(koppeling, eerst);

        await ander.Database.CommitTransactionAsync();
        using var antwoord = await koppeling;

        Assert.Equal(HttpStatusCode.NotFound, antwoord.StatusCode);
        Assert.Equal("De gebruiker of de klas bestaat niet meer.", await DetailAsync(antwoord));
    }

    /// <summary>
    /// MINOR 4 of the slice 2 audit, round 2: a write to a gebruiker whom another request removes between the read and
    /// the write. The other transaction has deleted An without committing, so the tracked UPDATE or DELETE waits on the
    /// row lock and then affects no row. That is a Dutch 404, not the 500 an unmapped concurrency fault would give.
    /// </summary>
    [PostgresTheory]
    [InlineData("PUT", "/themabeheer")]
    [InlineData("PUT", "/directierecht")]
    [InlineData("DELETE", "")]
    public async Task Een_schrijfactie_op_een_gebruiker_die_intussen_verwijderd_wordt_is_404_en_geen_500(string methode, string achtervoegsel)
    {
        var an = await BewaarGebruikerAsync(naam: "An");

        await using var ander = _db.MaakContext();
        await ander.Database.BeginTransactionAsync();
        await ander.Gebruikers.Where(g => g.Id == an.Id).ExecuteDeleteAsync();

        using var client = Client();
        var schrijf = client.SendAsync(new HttpRequestMessage(new HttpMethod(methode), $"/api/gebruikers/{an.Id}{achtervoegsel}"));

        var eerst = await Task.WhenAny(schrijf, Task.Delay(TimeSpan.FromSeconds(1)));
        Assert.NotSame(schrijf, eerst);

        await ander.Database.CommitTransactionAsync();
        using var antwoord = await schrijf;

        Assert.Equal(HttpStatusCode.NotFound, antwoord.StatusCode);
        Assert.Equal("Deze gebruiker is intussen verwijderd.", await DetailAsync(antwoord));
    }

    /// <summary>
    /// The fourth toggle, and removal, on a <b>directie</b> removed in between (test-runner, round 3). These two take the
    /// directie lock first, so they wait there rather than on the save; once the delete commits the row is gone, and the
    /// answer is the same "intussen verwijderd" 404 as the other writes, not a sentence with a raw id.
    /// </summary>
    [PostgresTheory]
    [InlineData("/directierecht")]
    [InlineData("")]
    public async Task Een_directie_afzetten_of_verwijderen_die_intussen_verwijderd_wordt_is_404_en_geen_500(string achtervoegsel)
    {
        var an = await BewaarGebruikerAsync(naam: "An", directie: true);
        await BewaarGebruikerAsync(naam: "Bert", directie: true);

        await using var ander = _db.MaakContext();
        await ander.Database.BeginTransactionAsync();
        await ander.Gebruikers.Where(g => g.Id == an.Id).ExecuteDeleteAsync();

        using var client = Client();
        var schrijf = client.DeleteAsync($"/api/gebruikers/{an.Id}{achtervoegsel}");

        var eerst = await Task.WhenAny(schrijf, Task.Delay(TimeSpan.FromSeconds(1)));
        Assert.NotSame(schrijf, eerst);

        await ander.Database.CommitTransactionAsync();
        using var antwoord = await schrijf;

        Assert.Equal(HttpStatusCode.NotFound, antwoord.StatusCode);
        Assert.Equal("Deze gebruiker is intussen verwijderd.", await DetailAsync(antwoord));
    }

    /// <summary>Taking themabeheer away from someone removed in between: the same 404 on the revoking write.</summary>
    [PostgresFact]
    public async Task Themabeheer_afnemen_van_een_gebruiker_die_intussen_verwijderd_wordt_is_404_en_geen_500()
    {
        var an = await BewaarGebruikerAsync(naam: "An", themabeheer: true);

        await using var ander = _db.MaakContext();
        await ander.Database.BeginTransactionAsync();
        await ander.Gebruikers.Where(g => g.Id == an.Id).ExecuteDeleteAsync();

        using var client = Client();
        var schrijf = client.DeleteAsync($"/api/gebruikers/{an.Id}/themabeheer");

        var eerst = await Task.WhenAny(schrijf, Task.Delay(TimeSpan.FromSeconds(1)));
        Assert.NotSame(schrijf, eerst);

        await ander.Database.CommitTransactionAsync();
        using var antwoord = await schrijf;

        Assert.Equal(HttpStatusCode.NotFound, antwoord.StatusCode);
        Assert.Equal("Deze gebruiker is intussen verwijderd.", await DetailAsync(antwoord));
    }

    // --- Hoofdleerkrachten (R5, I20). ---

    [PostgresFact]
    public async Task Hoofdleerkrachten_aanstellen_zonder_klas_meerdere_per_jaarfase_en_weer_intrekken()
    {
        var jaar = await BewaarSchooljaarAsync(Vandaag.AddDays(-30), Vandaag.AddDays(200));
        var an = await BewaarGebruikerAsync();
        var bert = await BewaarGebruikerAsync();
        using var client = Client();

        var anAangesteld = await SchrijfAsync(client, HttpMethod.Put, $"/api/gebruikers/{an.Id}/hoofdleerkracht/{jaar.Id}/K3");
        await SchrijfAsync(client, HttpMethod.Put, $"/api/gebruikers/{an.Id}/hoofdleerkracht/{jaar.Id}/K3");
        await SchrijfAsync(client, HttpMethod.Put, $"/api/gebruikers/{bert.Id}/hoofdleerkracht/{jaar.Id}/K3");

        Assert.Equal(("K3", jaar.Id, true), anAangesteld.Hoofdleerkrachtaanstellingen.Select(a => (a.Jaarfase, a.SchooljaarId, a.TeltVoorGedeeldeInhoud)).Single());
        await using (var context = _db.MaakContext())
        {
            Assert.Equal(2, await context.Hoofdleerkrachtaanstellingen.CountAsync(a => a.SchooljaarId == jaar.Id && a.Jaarfase == "K3"));
        }

        // No klastoewijzing, and still hoofdleerkracht (I20).
        using (var alsAn = ClientVoor(an.Id))
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
        using var client = Client();

        using var aanstellen = await client.PutAsync($"/api/gebruikers/{an.Id}/hoofdleerkracht/{jaar.Id}/{jaarfase}", null);
        using var intrekken = await client.DeleteAsync($"/api/gebruikers/{an.Id}/hoofdleerkracht/{jaar.Id}/{jaarfase}");

        Assert.Equal(HttpStatusCode.BadRequest, aanstellen.StatusCode);
        Assert.Equal(zin, await DetailAsync(aanstellen));
        Assert.Equal(HttpStatusCode.BadRequest, intrekken.StatusCode);
    }

    /// <summary>
    /// The appointment's twin of the klas race: the schooljaar exists when checked and is gone at the insert. Another
    /// transaction has deleted it (a year with no klassen, as a schooljaar with klassen cannot be deleted) without
    /// committing, so the insert's foreign-key check waits on it and fails once it commits. Pinned by value.
    /// </summary>
    [PostgresFact]
    public async Task Aanstellen_in_een_schooljaar_dat_intussen_verwijderd_wordt_is_404_en_geen_500()
    {
        var jaar = await BewaarSchooljaarAsync(Vandaag.AddDays(-30), Vandaag.AddDays(200));
        var an = await BewaarGebruikerAsync();

        await using var ander = _db.MaakContext();
        await ander.Database.BeginTransactionAsync();
        await ander.Schooljaren.Where(s => s.Id == jaar.Id).ExecuteDeleteAsync();

        using var client = Client();
        var aanstelling = client.PutAsync($"/api/gebruikers/{an.Id}/hoofdleerkracht/{jaar.Id}/K3", null);

        var eerst = await Task.WhenAny(aanstelling, Task.Delay(TimeSpan.FromSeconds(1)));
        Assert.NotSame(aanstelling, eerst);

        await ander.Database.CommitTransactionAsync();
        using var antwoord = await aanstelling;

        Assert.Equal(HttpStatusCode.NotFound, antwoord.StatusCode);
        Assert.Equal("De gebruiker of het schooljaar bestaat niet meer.", await DetailAsync(antwoord));
    }

    [PostgresFact]
    public async Task Aanstellen_in_een_onbekend_schooljaar_is_404()
    {
        var an = await BewaarGebruikerAsync();
        using var client = Client();

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
        using var directie = Client();
        var subthemaId = await MaakSubthemaAsync(directie, "K3");
        // Made by An, who is hoofdleerkracht and leerkracht of K3, so the maker is An whatever route rights apply.
        using var alsAn = ClientVoor(an.Id);
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
        // A second tab after the removal: Dutch, and no raw id (round 3).
        Assert.Equal("Deze gebruiker bestaat niet (meer).", await DetailAsync(weg));
        using var tweedeTab = await directie.PutAsync($"/api/gebruikers/{an.Id}/themabeheer", null);
        Assert.Equal(HttpStatusCode.NotFound, tweedeTab.StatusCode);
        Assert.Equal("Deze gebruiker bestaat niet (meer).", await DetailAsync(tweedeTab));
    }

    // --- Helpers. ---

    /// <summary>A client on the production rule, carrying the anti-forgery header as the frontend's fetch does.</summary>
    private HttpClient Client()
    {
        var client = _productie.CreateClient();
        if (!client.DefaultRequestHeaders.Contains(CsrfHeaderControle.Header))
        {
            client.DefaultRequestHeaders.Add(CsrfHeaderControle.Header, "1");
        }

        return client;
    }

    private HttpClient ClientVoor(Guid gebruikerId)
    {
        var client = Client();
        client.DefaultRequestHeaders.Add(TestAuthenticatie.GebruikerHeader, gebruikerId.ToString());
        return client;
    }

    private HttpClient AnoniemeClient()
    {
        var client = Client();
        client.DefaultRequestHeaders.Add(TestAuthenticatie.AnoniemHeader, "1");
        return client;
    }

    /// <summary>
    /// A second directie tab frozen halfway: a transaction that holds the lock the service takes and has demoted
    /// <paramref name="gebruikerId"/>, uncommitted. The caller commits it.
    /// </summary>
    private async Task<AppDbContext> HoudDirectieVastEnZetAfAsync(Guid gebruikerId)
    {
        var ander = _db.MaakContext();
        await ander.Database.BeginTransactionAsync();
        await ander.Database.ExecuteSqlRawAsync("""SELECT "Id" FROM gebruikers WHERE "IsDirectie" ORDER BY "Id" FOR UPDATE""");
        await ander.Gebruikers.Where(g => g.Id == gebruikerId)
            .ExecuteUpdateAsync(zet => zet.SetProperty(g => g.IsDirectie, false));
        return ander;
    }

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

    /// <summary>
    /// A seeded gebruiker. <paramref name="gekoppeld"/> defaults to true: a signed-in directie is bound, and the
    /// last-directie guard counts only bound ones (MAJOR 1). Tests about the unbound state say so.
    /// </summary>
    private async Task<Gebruiker> BewaarGebruikerAsync(
        string naam = "Test",
        bool directie = false,
        bool themabeheer = false,
        bool gekoppeld = true)
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

    /// <summary>What a first login does to an invitation: bind it to an Entra account.</summary>
    private async Task BindAsync(Guid gebruikerId)
    {
        await using var context = _db.MaakContext();
        var gebruiker = await context.Gebruikers.SingleAsync(g => g.Id == gebruikerId);
        gebruiker.KoppelAanEntra(Guid.NewGuid(), Guid.NewGuid(), naam: null);
        await context.SaveChangesAsync();
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
