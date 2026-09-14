using System.Net;
using System.Net.Http.Json;
using Jaarplanner.Domain.Schoolcontent;
using Microsoft.EntityFrameworkCore;
using static Jaarplanner.IntegrationTests.Postgres.RechtenTestOpzet;

namespace Jaarplanner.IntegrationTests.Postgres;

/// <summary>
/// The thema-opbouw wizard's own write actions, over HTTP against PostgreSQL (E6-02 slice 3, ADR-0030 R29, R32;
/// defaults I18, I22–I25, I27, I28). No screen calls them yet (E6-05); these tests are what shows they are real and
/// reachable.
/// <para>
/// What they pin: themabeheer builds a thema from scratch through them and through nothing else (I22); a run ends when
/// finished, closed or fourteen days silent, for directie too (I24), and only its own routes move that window (I28);
/// within a run, an edit or delete reaches only what that run created and what is still under its thema (I25); it
/// carries off nobody else's work, goal links included (I27 and the owner's Q4 ruling); afterwards the thema follows the
/// ordinary rights (I23); the maker of a wizard activiteit is the caller (I18).
/// </para>
/// <para>
/// <b>Every sentence the wizard writes is asserted in full</b>, with no em dash (<see cref="VerwachtAsync"/>): a
/// server-composed Dutch sentence is checked by its value (Art. II.3), and these are the only check on them.
/// </para>
/// </summary>
public sealed class WizardrunEndpointsTests : IClassFixture<WizardrunEndpointsTests.Omgeving>
{
    private const string Doelcode = "WIZ-01";

    // The wizard's sentences, written out: a reword shows up here as a failure, not silently on a screen.
    private const string NietGevonden = "Deze wizard is niet gevonden.";
    private const string Afgelopen = "Deze wizard is afgelopen.";
    private const string NietVanDitThema = "Dit subthema hoort niet bij het thema van deze wizard.";
    private const string ActiviteitWeg = "Deze activiteit staat niet meer onder het thema van deze wizard.";
    private const string NietInDezeWizard = "Dit is niet in deze wizard aangemaakt.";

    private const string Verdwijnt =
        "Onder dit subthema staan subdoelen of activiteiten die niet in deze wizard aangemaakt zijn. "
        + "Die zouden mee verdwijnen, dus de wizard verwijdert het niet.";

    private const string Verhuist =
        "Onder dit subthema staan subdoelen of activiteiten die niet in deze wizard aangemaakt zijn. "
        + "Die zouden mee van leeftijd veranderen, dus de wizard verandert de leeftijd niet.";

    private const string GekoppeldVerhuist =
        "Aan activiteiten onder dit subthema zijn doelen gekoppeld. Die mag je niet naar een andere leeftijd meenemen, "
        + "dus de wizard verandert de leeftijd niet.";

    private const string ActiviteitMetDoelen =
        "Aan deze activiteit zijn doelen gekoppeld. Je mag op deze leeftijd geen doelen ontkoppelen, "
        + "dus de wizard verwijdert deze activiteit niet.";

    private const string SubthemaMetDoelen =
        "Aan activiteiten onder dit subthema zijn doelen gekoppeld. Je mag op deze leeftijd geen doelen ontkoppelen, "
        + "dus de wizard verwijdert het niet.";

    private readonly Omgeving _omgeving;

    public WizardrunEndpointsTests(Omgeving omgeving) => _omgeving = omgeving;

    private RechtenTestOpzet Opzet => new(_omgeving.Db, _omgeving.Factory);

    private static object Subthema(string? leeftijd, string naam = "Regen") => new { naam, duurWeken = 2, leeftijd };

    private static readonly object Activiteit = new { naam = "Proef", activiteitType = "Experiment" };

    [Fact]
    public void Geen_zin_van_de_wizard_draagt_een_em_dash()
    {
        foreach (var zin in new[]
                 {
                     NietGevonden, Afgelopen, NietVanDitThema, ActiviteitWeg, NietInDezeWizard, Verdwijnt, Verhuist,
                     GekoppeldVerhuist, ActiviteitMetDoelen, SubthemaMetDoelen, GeenLeeftijd,
                 })
        {
            Assert.DoesNotContain('—', zin);
        }
    }

    [PostgresFact]
    public async Task Themabeheer_bouwt_in_zijn_wizard_een_thema_van_nul_op()
    {
        var opzet = Opzet;
        var themabeheerId = await opzet.GebruikerAsync(themabeheer: true);
        using var client = opzet.Als(themabeheerId);

        var run = await StartWizardAsync(client);
        Assert.True(run.IsOpen);
        Assert.Equal(themabeheerId, run.GestartDoorId);

        var subthemaId = await IdAsync(client.PostAsJsonAsync($"{Wizard}/{run.Id}/subthemas", Subthema("K3")), HttpStatusCode.Created);
        var subdoelId = await IdAsync(
            client.PostAsJsonAsync($"{Wizard}/{run.Id}/subthemas/{subthemaId}/subdoelen", new { leerplandoelCode = Doelcode }), HttpStatusCode.OK);
        using var gemaakt = await client.PostAsJsonAsync($"{Wizard}/{run.Id}/subthemas/{subthemaId}/activiteiten", Activiteit);
        Assert.Equal(HttpStatusCode.Created, gemaakt.StatusCode);
        var activiteit = (await gemaakt.Content.ReadFromJsonAsync<ActiviteitDto>())!;
        Assert.Equal(themabeheerId, activiteit.MakerId); // I18

        var nu = await HaalOpAsync(client, run.Id);
        Assert.Equal(
            new[] { ("Activiteit", activiteit.Id), ("Subdoel", subdoelId), ("Subthema", subthemaId) }.Order(),
            nu.Aangemaakt.Select(i => (i.Soort, i.Id)).Order());

        // Within the open run, what it made may be edited and deleted (I25). The new leeftijd is allowed because
        // everything under the subthema is the run's own and no activiteit carries a goal link (I27).
        Assert.Equal(HttpStatusCode.OK, await StatusAsync(client.PutAsJsonAsync($"{Wizard}/{run.Id}/subthemas/{subthemaId}", Subthema("K2", "Wind"))));
        Assert.Equal(HttpStatusCode.OK, await StatusAsync(client.PutAsJsonAsync(
            $"{Wizard}/{run.Id}/activiteiten/{activiteit.Id}", new { naam = "Proef met ijs", activiteitType = "Experiment" })));
        Assert.Equal(HttpStatusCode.NoContent, await StatusAsync(client.DeleteAsync($"{Wizard}/{run.Id}/subthemas/{subthemaId}/subdoelen/{subdoelId}")));
        Assert.Equal(HttpStatusCode.NoContent, await StatusAsync(client.DeleteAsync($"{Wizard}/{run.Id}/activiteiten/{activiteit.Id}")));
        Assert.Equal(HttpStatusCode.NoContent, await StatusAsync(client.DeleteAsync($"{Wizard}/{run.Id}/subthemas/{subthemaId}")));

        var leeg = await HaalOpAsync(client, run.Id);
        Assert.Empty(leeg.Aangemaakt);
        Assert.True(leeg.IsOpen);
    }

    [PostgresFact]
    public async Task Themabeheer_heeft_geen_recht_op_de_gewone_routes_maar_wel_in_zijn_open_wizard_I22()
    {
        var opzet = Opzet;
        using var client = opzet.Als(await opzet.GebruikerAsync(themabeheer: true));
        var run = await StartWizardAsync(client);

        await VerwachtAsync(client.PostAsJsonAsync($"/api/themas/{run.ThemaId}/subthemas", Subthema("K3")), HttpStatusCode.Forbidden, GeenToegang);
        var subthemaId = await IdAsync(client.PostAsJsonAsync($"{Wizard}/{run.Id}/subthemas", Subthema("K3")), HttpStatusCode.Created);

        await VerwachtAsync(client.PutAsJsonAsync($"/api/subthemas/{subthemaId}", Subthema("K3", "Wind")), HttpStatusCode.Forbidden, GeenToegang);
        await VerwachtAsync(client.PostAsJsonAsync($"/api/subthemas/{subthemaId}/activiteiten", Activiteit), HttpStatusCode.Forbidden, GeenToegang);
        await VerwachtAsync(client.PostAsJsonAsync(
            $"/api/subthemas/{subthemaId}/doelkoppelingen", new { leerplandoelCode = Doelcode }), HttpStatusCode.Forbidden, GeenToegang);
    }

    [PostgresFact]
    public async Task Een_hoofdleerkracht_gebruikt_de_wizard_niet()
    {
        var opzet = Opzet;
        var school = await opzet.SchoolAsync();
        using var hoofdleerkracht = opzet.Als(await opzet.GebruikerAsync(school, hoofdleerkrachtVan: ["K3"]));
        using var themabeheer = opzet.Als(await opzet.GebruikerAsync(themabeheer: true));
        var run = await StartWizardAsync(themabeheer);

        await VerwachtAsync(hoofdleerkracht.PostAsJsonAsync(Wizard, new { naam = "Water", duurWeken = 4 }), HttpStatusCode.Forbidden, GeenToegang);
        await VerwachtAsync(hoofdleerkracht.PostAsJsonAsync($"{Wizard}/{run.Id}/subthemas", Subthema("K3")), HttpStatusCode.Forbidden, GeenToegang);
        await VerwachtAsync(hoofdleerkracht.PostAsync($"{Wizard}/{run.Id}/afronden", null), HttpStatusCode.Forbidden, GeenToegang);
    }

    [PostgresFact]
    public async Task Veertien_dagen_na_de_laatste_schrijfactie_is_de_wizard_afgelopen_ook_voor_directie_I24()
    {
        var opzet = Opzet;
        using var client = opzet.Als(await opzet.GebruikerAsync(themabeheer: true));
        using var directie = opzet.Als(await opzet.GebruikerAsync(directie: true));
        var run = await StartWizardAsync(client);

        // Thirteen days of silence: still open, and the write moves the window.
        await ZetLaatsteSchrijfactieAsync(run.Id, DateTimeOffset.UtcNow - TimeSpan.FromDays(13));
        Assert.Equal(HttpStatusCode.Created, await StatusAsync(client.PostAsJsonAsync($"{Wizard}/{run.Id}/subthemas", Subthema("K3"))));
        Assert.True((await HaalOpAsync(client, run.Id)).LaatsteSchrijfactieOp > DateTimeOffset.UtcNow - TimeSpan.FromMinutes(5));

        // A minute past fourteen: ended, for everyone.
        await ZetLaatsteSchrijfactieAsync(run.Id, DateTimeOffset.UtcNow - Wizardrun.MaximaleStilte - TimeSpan.FromMinutes(1));
        await VerwachtAsync(client.PostAsJsonAsync($"{Wizard}/{run.Id}/subthemas", Subthema("K3")), HttpStatusCode.Forbidden, Afgelopen);
        await VerwachtAsync(directie.PostAsJsonAsync($"{Wizard}/{run.Id}/subthemas", Subthema("K3")), HttpStatusCode.Forbidden, Afgelopen);
        Assert.False((await HaalOpAsync(client, run.Id)).IsOpen);
    }

    [PostgresFact]
    public async Task Een_gewone_thema_of_themadoelwijziging_verschuift_het_venster_van_de_wizard_niet_I28()
    {
        var opzet = Opzet;
        using var client = opzet.Als(await opzet.GebruikerAsync(themabeheer: true));
        var run = await StartWizardAsync(client);
        var voor = await LaatsteSchrijfactieAsync(run.Id);

        Assert.Equal(HttpStatusCode.OK, await StatusAsync(client.PutAsJsonAsync(
            $"/api/themas/{run.ThemaId}", new { naam = $"Hernoemd {Guid.NewGuid():N}", duurWeken = 5, kernwoordenschat = new[] { "regen" } })));
        Assert.Equal(HttpStatusCode.OK, await StatusAsync(client.PostAsJsonAsync(
            $"/api/themas/{run.ThemaId}/themadoelen", new { leerplandoelCode = Doelcode })));

        Assert.Equal(voor, await LaatsteSchrijfactieAsync(run.Id));
    }

    [PostgresFact]
    public async Task De_wizard_raakt_alleen_aan_wat_hij_zelf_aanmaakte_I25()
    {
        var opzet = Opzet;
        var school = await opzet.SchoolAsync();
        using var client = opzet.Als(await opzet.GebruikerAsync(themabeheer: true));
        using var hoofdleerkracht = opzet.Als(await opzet.GebruikerAsync(school, hoofdleerkrachtVan: ["K3"]));
        var runA = await StartWizardAsync(client);
        var runB = await StartWizardAsync(client);
        var vanA = await IdAsync(client.PostAsJsonAsync($"{Wizard}/{runA.Id}/subthemas", Subthema("K3")), HttpStatusCode.Created);

        // An item another run created.
        await VerwachtAsync(client.PutAsJsonAsync($"{Wizard}/{runB.Id}/subthemas/{vanA}", Subthema("K3", "Wind")), HttpStatusCode.Forbidden, NietInDezeWizard);
        await VerwachtAsync(client.DeleteAsync($"{Wizard}/{runB.Id}/subthemas/{vanA}"), HttpStatusCode.Forbidden, NietInDezeWizard);
        await VerwachtAsync(client.PostAsJsonAsync(
            $"{Wizard}/{runB.Id}/subthemas/{vanA}/subdoelen", new { leerplandoelCode = Doelcode }), HttpStatusCode.Forbidden, NietVanDitThema);
        await VerwachtAsync(client.PostAsJsonAsync($"{Wizard}/{runB.Id}/subthemas/{vanA}/activiteiten", Activiteit), HttpStatusCode.Forbidden, NietVanDitThema);

        // Something someone else put under the run's own thema, on the ordinary route.
        var vanHoofdleerkracht = await IdAsync(
            hoofdleerkracht.PostAsJsonAsync($"/api/themas/{runA.ThemaId}/subthemas", Subthema("K3", "Zon")), HttpStatusCode.Created);
        await VerwachtAsync(client.PutAsJsonAsync(
            $"{Wizard}/{runA.Id}/subthemas/{vanHoofdleerkracht}", Subthema("K3", "Maan")), HttpStatusCode.Forbidden, NietInDezeWizard);

        // An item that does not exist is 404, not 403.
        Assert.Equal(HttpStatusCode.NotFound, await StatusAsync(client.PutAsJsonAsync($"{Wizard}/{runA.Id}/subthemas/{Guid.NewGuid()}", Subthema("K3"))));
    }

    [PostgresFact]
    public async Task Een_subthema_met_inhoud_van_iemand_anders_verwijdert_de_wizard_niet_en_verhuist_hij_niet_I25_I27()
    {
        var opzet = Opzet;
        var school = await opzet.SchoolAsync();
        using var client = opzet.Als(await opzet.GebruikerAsync(themabeheer: true));
        using var leerkracht = opzet.Als(await opzet.GebruikerAsync(school, klassen: [school.K3Blauw]));
        var run = await StartWizardAsync(client);
        var subthemaId = await IdAsync(client.PostAsJsonAsync($"{Wizard}/{run.Id}/subthemas", Subthema("K3")), HttpStatusCode.Created);
        await opzet.ActiviteitAsync(subthemaId, leerkracht);

        await VerwachtAsync(client.DeleteAsync($"{Wizard}/{run.Id}/subthemas/{subthemaId}"), HttpStatusCode.Forbidden, Verdwijnt);

        // I27: the leeftijd may not change, because the leerkracht's activiteit would move with it...
        await VerwachtAsync(client.PutAsJsonAsync($"{Wizard}/{run.Id}/subthemas/{subthemaId}", Subthema("K2")), HttpStatusCode.Forbidden, Verhuist);
        // ...but the rest of the subthema is still the run's to edit, at the same leeftijd.
        Assert.Equal(HttpStatusCode.OK, await StatusAsync(client.PutAsJsonAsync($"{Wizard}/{run.Id}/subthemas/{subthemaId}", Subthema("K3", "Wind"))));

        await using var context = _omgeving.Db.MaakContext();
        var bewaard = await context.Subthemas.SingleAsync(s => s.Id == subthemaId);
        Assert.Equal("K3", bewaard.Leeftijd);
    }

    [PostgresFact]
    public async Task Een_gekoppelde_wizardactiviteit_verhuist_alleen_mee_voor_wie_op_beide_leeftijden_mag_koppelen_Q4()
    {
        var opzet = Opzet;
        var school = await opzet.SchoolAsync();
        using var themabeheer = opzet.Als(await opzet.GebruikerAsync(themabeheer: true));
        using var hoofdleerkracht = opzet.Als(await opzet.GebruikerAsync(school, hoofdleerkrachtVan: ["K3"]));
        using var alleenK3 = opzet.Als(await opzet.GebruikerAsync(school, themabeheer: true, hoofdleerkrachtVan: ["K3"]));
        using var alleenK2 = opzet.Als(await opzet.GebruikerAsync(school, themabeheer: true, hoofdleerkrachtVan: ["K2"]));
        using var beide = opzet.Als(await opzet.GebruikerAsync(school, themabeheer: true, hoofdleerkrachtVan: ["K3", "K2"]));
        var run = await StartWizardAsync(themabeheer);
        var subthemaId = await IdAsync(themabeheer.PostAsJsonAsync($"{Wizard}/{run.Id}/subthemas", Subthema("K3")), HttpStatusCode.Created);
        var activiteitId = await IdAsync(
            themabeheer.PostAsJsonAsync($"{Wizard}/{run.Id}/subthemas/{subthemaId}/activiteiten", Activiteit), HttpStatusCode.Created);

        // Everything under the subthema is the run's own, but a hoofdleerkracht linked a goal to its activiteit.
        Assert.Equal(HttpStatusCode.OK, await StatusAsync(hoofdleerkracht.PostAsJsonAsync(
            $"/api/activiteiten/{activiteitId}/doelkoppelingen", new { leerplandoelCode = Doelcode })));
        var pad = $"{Wizard}/{run.Id}/subthemas/{subthemaId}";

        await VerwachtAsync(themabeheer.PutAsJsonAsync(pad, Subthema("K2")), HttpStatusCode.Forbidden, GekoppeldVerhuist);
        // I27 as ratified on Q5: "at both the old and the new leeftijd". The old leeftijd only is not enough, because the
        // link would land at K2...
        await VerwachtAsync(alleenK3.PutAsJsonAsync(pad, Subthema("K2")), HttpStatusCode.Forbidden, GekoppeldVerhuist);
        // ...and the new leeftijd only is not enough either, because the link would leave K3's dekking.
        await VerwachtAsync(alleenK2.PutAsJsonAsync(pad, Subthema("K2")), HttpStatusCode.Forbidden, GekoppeldVerhuist);
        // An edit at the same leeftijd carries no link anywhere.
        Assert.Equal(HttpStatusCode.OK, await StatusAsync(themabeheer.PutAsJsonAsync(pad, Subthema("K3", "Wind"))));

        await using (var context = _omgeving.Db.MaakContext())
        {
            Assert.Equal("K3", (await context.Subthemas.SingleAsync(s => s.Id == subthemaId)).Leeftijd);
        }

        Assert.Equal(HttpStatusCode.OK, await StatusAsync(beide.PutAsJsonAsync(pad, Subthema("K2"))));
        await using var na = _omgeving.Db.MaakContext();
        Assert.Equal("K2", (await na.Subthemas.SingleAsync(s => s.Id == subthemaId)).Leeftijd);
    }

    [PostgresFact]
    public async Task Een_wizardactiviteit_waaraan_iemand_een_doel_koppelde_verwijdert_alleen_wie_mag_koppelen_I27()
    {
        var opzet = Opzet;
        var school = await opzet.SchoolAsync();
        using var themabeheer = opzet.Als(await opzet.GebruikerAsync(themabeheer: true));
        using var ookHoofdleerkracht = opzet.Als(await opzet.GebruikerAsync(school, themabeheer: true, hoofdleerkrachtVan: ["K3"]));
        var run = await StartWizardAsync(themabeheer);
        var subthemaId = await IdAsync(themabeheer.PostAsJsonAsync($"{Wizard}/{run.Id}/subthemas", Subthema("K3")), HttpStatusCode.Created);
        var pad = $"{Wizard}/{run.Id}/subthemas/{subthemaId}/activiteiten";
        var eerste = await IdAsync(themabeheer.PostAsJsonAsync(pad, Activiteit), HttpStatusCode.Created);
        var tweede = await IdAsync(themabeheer.PostAsJsonAsync(pad, Activiteit), HttpStatusCode.Created);
        await opzet.KoppelAsync(eerste, Doelcode);
        await opzet.KoppelAsync(tweede, Doelcode);

        await VerwachtAsync(themabeheer.DeleteAsync($"{Wizard}/{run.Id}/activiteiten/{eerste}"), HttpStatusCode.Forbidden, ActiviteitMetDoelen);
        Assert.Equal(HttpStatusCode.NoContent, await StatusAsync(ookHoofdleerkracht.DeleteAsync($"{Wizard}/{run.Id}/activiteiten/{tweede}")));

        await using var context = _omgeving.Db.MaakContext();
        Assert.True(await context.Activiteiten.AnyAsync(a => a.Id == eerste));
    }

    [PostgresFact]
    public async Task Een_wizardsubthema_met_gekoppelde_activiteiten_verwijdert_alleen_wie_mag_koppelen_I27()
    {
        var opzet = Opzet;
        var school = await opzet.SchoolAsync();
        using var themabeheer = opzet.Als(await opzet.GebruikerAsync(themabeheer: true));
        using var ookHoofdleerkracht = opzet.Als(await opzet.GebruikerAsync(school, themabeheer: true, hoofdleerkrachtVan: ["K3"]));
        var run = await StartWizardAsync(themabeheer);
        var subthemaId = await IdAsync(themabeheer.PostAsJsonAsync($"{Wizard}/{run.Id}/subthemas", Subthema("K3")), HttpStatusCode.Created);
        var activiteitId = await IdAsync(
            themabeheer.PostAsJsonAsync($"{Wizard}/{run.Id}/subthemas/{subthemaId}/activiteiten", Activiteit), HttpStatusCode.Created);
        await opzet.KoppelAsync(activiteitId, Doelcode);

        await VerwachtAsync(themabeheer.DeleteAsync($"{Wizard}/{run.Id}/subthemas/{subthemaId}"), HttpStatusCode.Forbidden, SubthemaMetDoelen);
        await using (var context = _omgeving.Db.MaakContext())
        {
            Assert.True(await context.Subthemas.AnyAsync(s => s.Id == subthemaId));
            Assert.True(await context.Activiteiten.AnyAsync(a => a.Id == activiteitId));
        }

        Assert.Equal(HttpStatusCode.NoContent, await StatusAsync(ookHoofdleerkracht.DeleteAsync($"{Wizard}/{run.Id}/subthemas/{subthemaId}")));
    }

    [PostgresFact]
    public async Task Een_wizardactiviteit_die_naar_een_ander_thema_verhuisde_is_niet_meer_van_de_wizard()
    {
        var opzet = Opzet;
        using var client = opzet.Als(await opzet.GebruikerAsync(themabeheer: true));
        var run = await StartWizardAsync(client);
        var subthemaId = await IdAsync(client.PostAsJsonAsync($"{Wizard}/{run.Id}/subthemas", Subthema("K3")), HttpStatusCode.Created);
        var activiteitId = await IdAsync(
            client.PostAsJsonAsync($"{Wizard}/{run.Id}/subthemas/{subthemaId}/activiteiten", Activiteit), HttpStatusCode.Created);

        // Directie moves it, on the ordinary route, to a K3 subthema of another thema.
        var elders = await opzet.SubthemaAsync("K3");
        using (var directie = opzet.Directie())
        {
            Assert.Equal(HttpStatusCode.OK, await StatusAsync(directie.PutAsJsonAsync(
                $"/api/activiteiten/{activiteitId}/subthema", new { doelSubthemaId = elders })));
        }

        await VerwachtAsync(client.PutAsJsonAsync(
            $"{Wizard}/{run.Id}/activiteiten/{activiteitId}", new { naam = "Proef met ijs", activiteitType = "Experiment" }),
            HttpStatusCode.Forbidden,
            ActiviteitWeg);
        await VerwachtAsync(client.DeleteAsync($"{Wizard}/{run.Id}/activiteiten/{activiteitId}"), HttpStatusCode.Forbidden, ActiviteitWeg);
    }

    [PostgresFact]
    public async Task Afronden_en_sluiten_beeindigen_de_wizard_en_daarna_volgt_het_thema_de_gewone_rechten_I23()
    {
        var opzet = Opzet;
        var school = await opzet.SchoolAsync();
        using var client = opzet.Als(await opzet.GebruikerAsync(themabeheer: true));
        using var directie = opzet.Als(await opzet.GebruikerAsync(directie: true));
        using var hoofdleerkracht = opzet.Als(await opzet.GebruikerAsync(school, hoofdleerkrachtVan: ["K3"]));
        var run = await StartWizardAsync(client);
        var subthemaId = await IdAsync(client.PostAsJsonAsync($"{Wizard}/{run.Id}/subthemas", Subthema("K3")), HttpStatusCode.Created);

        using var afgerond = await client.PostAsync($"{Wizard}/{run.Id}/afronden", null);
        Assert.Equal(HttpStatusCode.OK, afgerond.StatusCode);
        Assert.False((await afgerond.Content.ReadFromJsonAsync<RunDto>())!.IsOpen);

        await VerwachtAsync(directie.PostAsJsonAsync($"{Wizard}/{run.Id}/subthemas", Subthema("K3")), HttpStatusCode.Forbidden, Afgelopen);
        await VerwachtAsync(client.PostAsync($"{Wizard}/{run.Id}/sluiten", null), HttpStatusCode.Forbidden, Afgelopen);
        await VerwachtAsync(client.PutAsJsonAsync($"{Wizard}/{run.Id}/subthemas/{subthemaId}", Subthema("K3", "Wind")), HttpStatusCode.Forbidden, Afgelopen);

        // I23: the thema's content is now ordinary shared content.
        await VerwachtAsync(client.PutAsJsonAsync($"/api/subthemas/{subthemaId}", Subthema("K3", "Wind")), HttpStatusCode.Forbidden, GeenToegang);
        Assert.Equal(HttpStatusCode.OK, await StatusAsync(hoofdleerkracht.PutAsJsonAsync($"/api/subthemas/{subthemaId}", Subthema("K3", "Wind"))));

        var tweede = await StartWizardAsync(client);
        using var gesloten = await client.PostAsync($"{Wizard}/{tweede.Id}/sluiten", null);
        Assert.Equal(HttpStatusCode.OK, gesloten.StatusCode);
        Assert.False((await gesloten.Content.ReadFromJsonAsync<RunDto>())!.IsOpen);
    }

    [PostgresFact]
    public async Task Een_leeftijd_die_geen_leeftijd_is_of_ontbreekt_krijgt_in_de_wizard_de_400_van_de_write()
    {
        var opzet = Opzet;
        var school = await opzet.SchoolAsync();
        using var client = opzet.Als(await opzet.GebruikerAsync(themabeheer: true));
        using var hoofdleerkracht = opzet.Als(await opzet.GebruikerAsync(school, hoofdleerkrachtVan: ["K3"]));
        var run = await StartWizardAsync(client);
        var subthemaId = await IdAsync(client.PostAsJsonAsync($"{Wizard}/{run.Id}/subthemas", Subthema("K3")), HttpStatusCode.Created);
        var maken = $"{Wizard}/{run.Id}/subthemas";
        var wijzigen = $"{Wizard}/{run.Id}/subthemas/{subthemaId}";

        await VerwachtAsync(client.PostAsJsonAsync(maken, Subthema("3K")), HttpStatusCode.BadRequest,
            "'3K' is geen geldige leeftijd. Kies er een uit: JK, K2, K3, L1, L2, L3, L4, L5, L6.");
        await VerwachtAsync(client.PutAsJsonAsync(wijzigen, Subthema("k3")), HttpStatusCode.BadRequest,
            "'k3' is geen geldige leeftijd. Kies er een uit: JK, K2, K3, L1, L2, L3, L4, L5, L6.");

        // A null or omitted leeftijd reaches the same Dutch refusal, not ASP.NET Core's English one (test-runner D2).
        foreach (var lichaam in new object[] { Subthema(null), new { naam = "Regen", duurWeken = 2 } })
        {
            await VerwachtAsync(client.PostAsJsonAsync(maken, lichaam), HttpStatusCode.BadRequest, GeenLeeftijd);
            await VerwachtAsync(client.PutAsJsonAsync(wijzigen, lichaam), HttpStatusCode.BadRequest, GeenLeeftijd);
            // The wizard rows need no resource, so a caller outside them is refused before the body is read.
            await VerwachtAsync(hoofdleerkracht.PostAsJsonAsync(maken, lichaam), HttpStatusCode.Forbidden, GeenToegang);
            await VerwachtAsync(hoofdleerkracht.PutAsJsonAsync(wijzigen, lichaam), HttpStatusCode.Forbidden, GeenToegang);
        }
    }

    [PostgresFact]
    public async Task Doelen_meegeven_aan_een_wizardactiviteit_vraagt_het_koppelrecht_R19()
    {
        var opzet = Opzet;
        var school = await opzet.SchoolAsync();
        using var themabeheer = opzet.Als(await opzet.GebruikerAsync(themabeheer: true));
        using var ookHoofdleerkracht = opzet.Als(await opzet.GebruikerAsync(school, themabeheer: true, hoofdleerkrachtVan: ["K3"]));
        var run = await StartWizardAsync(themabeheer);
        var subthemaId = await IdAsync(themabeheer.PostAsJsonAsync($"{Wizard}/{run.Id}/subthemas", Subthema("K3")), HttpStatusCode.Created);
        var pad = $"{Wizard}/{run.Id}/subthemas/{subthemaId}/activiteiten";
        var metDoel = new { naam = "Proef", activiteitType = "Experiment", leerplandoelCodes = new[] { Doelcode } };

        await VerwachtAsync(themabeheer.PostAsJsonAsync(pad, metDoel), HttpStatusCode.Forbidden, GeenToegang);
        Assert.Equal(HttpStatusCode.Created, await StatusAsync(ookHoofdleerkracht.PostAsJsonAsync(pad, metDoel)));
    }

    [PostgresFact]
    public async Task Een_wizard_die_niet_bestaat_is_niet_gevonden()
    {
        var opzet = Opzet;
        using var client = opzet.Als(await opzet.GebruikerAsync(themabeheer: true));
        var niets = Guid.NewGuid();

        await VerwachtAsync(client.PostAsJsonAsync($"{Wizard}/{niets}/subthemas", Subthema("K3")), HttpStatusCode.NotFound, NietGevonden);
        await VerwachtAsync(client.PostAsync($"{Wizard}/{niets}/afronden", null), HttpStatusCode.NotFound, NietGevonden);
        await VerwachtAsync(client.GetAsync($"{Wizard}/{niets}"), HttpStatusCode.NotFound, NietGevonden);
    }

    private static async Task<RunDto> HaalOpAsync(HttpClient client, Guid runId) =>
        (await client.GetFromJsonAsync<RunDto>($"{Wizard}/{runId}"))!;

    /// <summary>The stored value itself, not the API's rendering of it, so an unchanged window compares exactly.</summary>
    private async Task<DateTimeOffset> LaatsteSchrijfactieAsync(Guid runId)
    {
        await using var context = _omgeving.Db.MaakContext();
        return await context.Wizardruns.AsNoTracking()
            .Where(r => r.Id == runId)
            .Select(r => r.LaatsteSchrijfactieOp)
            .SingleAsync();
    }

    private async Task ZetLaatsteSchrijfactieAsync(Guid runId, DateTimeOffset moment)
    {
        await using var context = _omgeving.Db.MaakContext();
        await context.Wizardruns
            .Where(r => r.Id == runId)
            .ExecuteUpdateAsync(zet => zet.SetProperty(r => r.LaatsteSchrijfactieOp, moment));
    }

    /// <summary>One database for the class; every test starts its own runs and seeds its own gebruikers.</summary>
    public sealed class Omgeving : IAsyncLifetime
    {
        public PostgresTestDatabase Db { get; private set; } = null!;

        public PostgresApiFactory Factory { get; private set; } = null!;

        public async Task InitializeAsync()
        {
            if (!PostgresTestDatabase.IsBeschikbaar)
            {
                return;
            }

            Db = await PostgresTestDatabase.MaakAsync("wizardrun");
            Factory = new PostgresApiFactory(Db.ConnectionString);
            await ZaaiDoelAsync(Db, Doelcode);
        }

        public async Task DisposeAsync()
        {
            if (Factory is not null)
            {
                await Factory.DisposeAsync();
            }

            if (Db is not null)
            {
                await Db.DisposeAsync();
            }
        }
    }
}
