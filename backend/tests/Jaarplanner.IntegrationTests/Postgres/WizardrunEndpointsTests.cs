using System.Net;
using System.Net.Http.Json;
using Jaarplanner.Domain.Schoolcontent;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.IntegrationTests.Postgres;

/// <summary>
/// The thema-opbouw wizard's own write actions, over HTTP against PostgreSQL (E6-02 slice 3, ADR-0030 R29, R32;
/// defaults I18, I22–I25). No screen calls them yet (E6-05); these tests are what shows they are real and reachable.
/// <para>
/// What they pin: themabeheer builds a thema from scratch through them and through nothing else (I22); a run ends when
/// finished, closed or fourteen days silent, for directie too (I24); within a run, an edit or delete reaches only what
/// that run created (I25); afterwards the thema follows the ordinary rights (I23); the maker of a wizard activiteit is
/// the caller (I18).
/// </para>
/// </summary>
public sealed class WizardrunEndpointsTests : IClassFixture<WizardrunEndpointsTests.Omgeving>
{
    private const string Doelcode = "WIZ-01";
    private const string Wizard = "/api/thema-opbouw/wizardruns";

    private readonly Omgeving _omgeving;

    public WizardrunEndpointsTests(Omgeving omgeving) => _omgeving = omgeving;

    private RechtenTestOpzet Opzet => new(_omgeving.Db, _omgeving.Factory);

    private static Task<HttpStatusCode> StatusAsync(Task<HttpResponseMessage> verzoek) => RechtenTestOpzet.StatusAsync(verzoek);

    private static object Subthema(string leeftijd, string naam = "Regen") => new { naam, duurWeken = 2, leeftijd };

    private static readonly object Activiteit = new { naam = "Proef", activiteitType = "Experiment" };

    [PostgresFact]
    public async Task Themabeheer_bouwt_in_zijn_wizard_een_thema_van_nul_op()
    {
        var opzet = Opzet;
        var themabeheerId = await opzet.GebruikerAsync(themabeheer: true);
        using var client = opzet.Als(themabeheerId);

        var run = await StartAsync(client);
        Assert.True(run.IsOpen);
        Assert.Equal(themabeheerId, run.GestartDoorId);

        var subthemaId = await IdAsync(client.PostAsJsonAsync($"{Wizard}/{run.Id}/subthemas", Subthema("K3")), HttpStatusCode.Created);
        var subdoelId = await IdAsync(
            client.PostAsJsonAsync($"{Wizard}/{run.Id}/subthemas/{subthemaId}/subdoelen", new { leerplandoelCode = Doelcode }), HttpStatusCode.OK);
        using var gemaakt = await client.PostAsJsonAsync($"{Wizard}/{run.Id}/subthemas/{subthemaId}/activiteiten", Activiteit);
        Assert.Equal(HttpStatusCode.Created, gemaakt.StatusCode);
        var activiteit = (await gemaakt.Content.ReadFromJsonAsync<RechtenTestOpzet.ActiviteitDto>())!;
        Assert.Equal(themabeheerId, activiteit.MakerId); // I18

        var nu = await HaalOpAsync(client, run.Id);
        Assert.Equal(
            new[] { ("Activiteit", activiteit.Id), ("Subdoel", subdoelId), ("Subthema", subthemaId) }.Order(),
            nu.Aangemaakt.Select(i => (i.Soort, i.Id)).Order());

        // Within the open run, what it made may be edited (a new leeftijd included) and deleted (I25).
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
        var run = await StartAsync(client);

        Assert.Equal(HttpStatusCode.Forbidden, await StatusAsync(client.PostAsJsonAsync($"/api/themas/{run.ThemaId}/subthemas", Subthema("K3"))));
        var subthemaId = await IdAsync(client.PostAsJsonAsync($"{Wizard}/{run.Id}/subthemas", Subthema("K3")), HttpStatusCode.Created);

        Assert.Equal(HttpStatusCode.Forbidden, await StatusAsync(client.PutAsJsonAsync($"/api/subthemas/{subthemaId}", Subthema("K3", "Wind"))));
        Assert.Equal(HttpStatusCode.Forbidden, await StatusAsync(client.PostAsJsonAsync($"/api/subthemas/{subthemaId}/activiteiten", Activiteit)));
        Assert.Equal(HttpStatusCode.Forbidden, await StatusAsync(client.PostAsJsonAsync(
            $"/api/subthemas/{subthemaId}/doelkoppelingen", new { leerplandoelCode = Doelcode })));
    }

    [PostgresFact]
    public async Task Een_hoofdleerkracht_gebruikt_de_wizard_niet()
    {
        var opzet = Opzet;
        var school = await opzet.SchoolAsync();
        using var hoofdleerkracht = opzet.Als(await opzet.GebruikerAsync(school, hoofdleerkrachtVan: ["K3"]));
        using var themabeheer = opzet.Als(await opzet.GebruikerAsync(themabeheer: true));
        var run = await StartAsync(themabeheer);

        Assert.Equal(HttpStatusCode.Forbidden, await StatusAsync(hoofdleerkracht.PostAsJsonAsync(Wizard, new { naam = "Water", duurWeken = 4 })));
        Assert.Equal(HttpStatusCode.Forbidden, await StatusAsync(hoofdleerkracht.PostAsJsonAsync($"{Wizard}/{run.Id}/subthemas", Subthema("K3"))));
        Assert.Equal(HttpStatusCode.Forbidden, await StatusAsync(hoofdleerkracht.PostAsync($"{Wizard}/{run.Id}/afronden", null)));
    }

    [PostgresFact]
    public async Task Veertien_dagen_na_de_laatste_schrijfactie_is_de_wizard_afgelopen_ook_voor_directie_I24()
    {
        var opzet = Opzet;
        using var client = opzet.Als(await opzet.GebruikerAsync(themabeheer: true));
        using var directie = opzet.Als(await opzet.GebruikerAsync(directie: true));
        var run = await StartAsync(client);

        // Thirteen days of silence: still open, and the write moves the window.
        await ZetLaatsteSchrijfactieAsync(run.Id, DateTimeOffset.UtcNow - TimeSpan.FromDays(13));
        Assert.Equal(HttpStatusCode.Created, await StatusAsync(client.PostAsJsonAsync($"{Wizard}/{run.Id}/subthemas", Subthema("K3"))));
        Assert.True((await HaalOpAsync(client, run.Id)).LaatsteSchrijfactieOp > DateTimeOffset.UtcNow - TimeSpan.FromMinutes(5));

        // A minute past fourteen: ended, for everyone.
        await ZetLaatsteSchrijfactieAsync(run.Id, DateTimeOffset.UtcNow - Wizardrun.MaximaleStilte - TimeSpan.FromMinutes(1));
        using var geweigerd = await client.PostAsJsonAsync($"{Wizard}/{run.Id}/subthemas", Subthema("K3"));
        Assert.Equal(HttpStatusCode.Forbidden, geweigerd.StatusCode);
        Assert.Contains("Deze wizard is afgelopen.", await geweigerd.Content.ReadAsStringAsync(), StringComparison.Ordinal);
        Assert.Equal(HttpStatusCode.Forbidden, await StatusAsync(directie.PostAsJsonAsync($"{Wizard}/{run.Id}/subthemas", Subthema("K3"))));
        Assert.False((await HaalOpAsync(client, run.Id)).IsOpen);
    }

    [PostgresFact]
    public async Task De_wizard_raakt_alleen_aan_wat_hij_zelf_aanmaakte_I25()
    {
        var opzet = Opzet;
        var school = await opzet.SchoolAsync();
        using var client = opzet.Als(await opzet.GebruikerAsync(themabeheer: true));
        using var hoofdleerkracht = opzet.Als(await opzet.GebruikerAsync(school, hoofdleerkrachtVan: ["K3"]));
        var runA = await StartAsync(client);
        var runB = await StartAsync(client);
        var vanA = await IdAsync(client.PostAsJsonAsync($"{Wizard}/{runA.Id}/subthemas", Subthema("K3")), HttpStatusCode.Created);

        // An item another run created.
        using var anderRun = await client.PutAsJsonAsync($"{Wizard}/{runB.Id}/subthemas/{vanA}", Subthema("K3", "Wind"));
        Assert.Equal(HttpStatusCode.Forbidden, anderRun.StatusCode);
        Assert.Contains("niet in deze wizard aangemaakt", await anderRun.Content.ReadAsStringAsync(), StringComparison.Ordinal);
        Assert.Equal(HttpStatusCode.Forbidden, await StatusAsync(client.DeleteAsync($"{Wizard}/{runB.Id}/subthemas/{vanA}")));
        Assert.Equal(HttpStatusCode.Forbidden, await StatusAsync(client.PostAsJsonAsync(
            $"{Wizard}/{runB.Id}/subthemas/{vanA}/subdoelen", new { leerplandoelCode = Doelcode })));

        // Something someone else put under the run's own thema, on the ordinary route.
        var vanHoofdleerkracht = await IdAsync(
            hoofdleerkracht.PostAsJsonAsync($"/api/themas/{runA.ThemaId}/subthemas", Subthema("K3", "Zon")), HttpStatusCode.Created);
        Assert.Equal(HttpStatusCode.Forbidden, await StatusAsync(client.PutAsJsonAsync(
            $"{Wizard}/{runA.Id}/subthemas/{vanHoofdleerkracht}", Subthema("K3", "Maan"))));

        // An item that does not exist is 404, not 403.
        Assert.Equal(HttpStatusCode.NotFound, await StatusAsync(client.PutAsJsonAsync($"{Wizard}/{runA.Id}/subthemas/{Guid.NewGuid()}", Subthema("K3"))));
    }

    [PostgresFact]
    public async Task Een_subthema_met_inhoud_van_iemand_anders_verwijdert_de_wizard_niet()
    {
        var opzet = Opzet;
        var school = await opzet.SchoolAsync();
        using var client = opzet.Als(await opzet.GebruikerAsync(themabeheer: true));
        using var leerkracht = opzet.Als(await opzet.GebruikerAsync(school, klassen: [school.K3Blauw]));
        var run = await StartAsync(client);
        var subthemaId = await IdAsync(client.PostAsJsonAsync($"{Wizard}/{run.Id}/subthemas", Subthema("K3")), HttpStatusCode.Created);
        await opzet.ActiviteitAsync(subthemaId, leerkracht);

        Assert.Equal(HttpStatusCode.Forbidden, await StatusAsync(client.DeleteAsync($"{Wizard}/{run.Id}/subthemas/{subthemaId}")));

        await using var context = _omgeving.Db.MaakContext();
        Assert.True(await context.Subthemas.AnyAsync(s => s.Id == subthemaId));
    }

    [PostgresFact]
    public async Task Afronden_en_sluiten_beeindigen_de_wizard_en_daarna_volgt_het_thema_de_gewone_rechten_I23()
    {
        var opzet = Opzet;
        var school = await opzet.SchoolAsync();
        using var client = opzet.Als(await opzet.GebruikerAsync(themabeheer: true));
        using var directie = opzet.Als(await opzet.GebruikerAsync(directie: true));
        using var hoofdleerkracht = opzet.Als(await opzet.GebruikerAsync(school, hoofdleerkrachtVan: ["K3"]));
        var run = await StartAsync(client);
        var subthemaId = await IdAsync(client.PostAsJsonAsync($"{Wizard}/{run.Id}/subthemas", Subthema("K3")), HttpStatusCode.Created);

        using var afgerond = await client.PostAsync($"{Wizard}/{run.Id}/afronden", null);
        Assert.Equal(HttpStatusCode.OK, afgerond.StatusCode);
        Assert.False((await afgerond.Content.ReadFromJsonAsync<RunDto>())!.IsOpen);

        Assert.Equal(HttpStatusCode.Forbidden, await StatusAsync(directie.PostAsJsonAsync($"{Wizard}/{run.Id}/subthemas", Subthema("K3"))));
        Assert.Equal(HttpStatusCode.Forbidden, await StatusAsync(client.PostAsync($"{Wizard}/{run.Id}/sluiten", null)));
        Assert.Equal(HttpStatusCode.Forbidden, await StatusAsync(client.PutAsJsonAsync($"{Wizard}/{run.Id}/subthemas/{subthemaId}", Subthema("K3", "Wind"))));

        // I23: the thema's content is now ordinary shared content.
        Assert.Equal(HttpStatusCode.Forbidden, await StatusAsync(client.PutAsJsonAsync($"/api/subthemas/{subthemaId}", Subthema("K3", "Wind"))));
        Assert.Equal(HttpStatusCode.OK, await StatusAsync(hoofdleerkracht.PutAsJsonAsync($"/api/subthemas/{subthemaId}", Subthema("K3", "Wind"))));

        var tweede = await StartAsync(client);
        using var gesloten = await client.PostAsync($"{Wizard}/{tweede.Id}/sluiten", null);
        Assert.Equal(HttpStatusCode.OK, gesloten.StatusCode);
        Assert.False((await gesloten.Content.ReadFromJsonAsync<RunDto>())!.IsOpen);
    }

    [PostgresFact]
    public async Task Een_leeftijd_die_geen_leeftijd_is_krijgt_in_de_wizard_de_400_van_de_write()
    {
        var opzet = Opzet;
        using var client = opzet.Als(await opzet.GebruikerAsync(themabeheer: true));
        var run = await StartAsync(client);
        var subthemaId = await IdAsync(client.PostAsJsonAsync($"{Wizard}/{run.Id}/subthemas", Subthema("K3")), HttpStatusCode.Created);

        using var maken = await client.PostAsJsonAsync($"{Wizard}/{run.Id}/subthemas", Subthema("3K"));
        Assert.Equal(HttpStatusCode.BadRequest, maken.StatusCode);
        Assert.Contains("'3K' is geen geldige leeftijd", await maken.Content.ReadAsStringAsync(), StringComparison.Ordinal);
        Assert.Equal(HttpStatusCode.BadRequest, await StatusAsync(client.PutAsJsonAsync($"{Wizard}/{run.Id}/subthemas/{subthemaId}", Subthema("k3"))));
    }

    [PostgresFact]
    public async Task Doelen_meegeven_aan_een_wizardactiviteit_vraagt_het_koppelrecht_R19()
    {
        var opzet = Opzet;
        var school = await opzet.SchoolAsync();
        using var themabeheer = opzet.Als(await opzet.GebruikerAsync(themabeheer: true));
        using var ookHoofdleerkracht = opzet.Als(await opzet.GebruikerAsync(school, themabeheer: true, hoofdleerkrachtVan: ["K3"]));
        var run = await StartAsync(themabeheer);
        var subthemaId = await IdAsync(themabeheer.PostAsJsonAsync($"{Wizard}/{run.Id}/subthemas", Subthema("K3")), HttpStatusCode.Created);
        var pad = $"{Wizard}/{run.Id}/subthemas/{subthemaId}/activiteiten";
        var metDoel = new { naam = "Proef", activiteitType = "Experiment", leerplandoelCodes = new[] { Doelcode } };

        Assert.Equal(HttpStatusCode.Forbidden, await StatusAsync(themabeheer.PostAsJsonAsync(pad, metDoel)));
        Assert.Equal(HttpStatusCode.Created, await StatusAsync(ookHoofdleerkracht.PostAsJsonAsync(pad, metDoel)));
    }

    [PostgresFact]
    public async Task Een_wizard_die_niet_bestaat_is_404()
    {
        var opzet = Opzet;
        using var client = opzet.Als(await opzet.GebruikerAsync(themabeheer: true));
        var niets = Guid.NewGuid();

        Assert.Equal(HttpStatusCode.NotFound, await StatusAsync(client.PostAsJsonAsync($"{Wizard}/{niets}/subthemas", Subthema("K3"))));
        Assert.Equal(HttpStatusCode.NotFound, await StatusAsync(client.PostAsync($"{Wizard}/{niets}/afronden", null)));
        Assert.Equal(HttpStatusCode.NotFound, await StatusAsync(client.GetAsync($"{Wizard}/{niets}")));
    }

    private static async Task<RunDto> StartAsync(HttpClient client)
    {
        using var antwoord = await client.PostAsJsonAsync(Wizard, new { naam = $"Wizard {Guid.NewGuid():N}", duurWeken = 4 });
        Assert.Equal(HttpStatusCode.Created, antwoord.StatusCode);
        return (await antwoord.Content.ReadFromJsonAsync<RunDto>())!;
    }

    private static async Task<RunDto> HaalOpAsync(HttpClient client, Guid runId) =>
        (await client.GetFromJsonAsync<RunDto>($"{Wizard}/{runId}"))!;

    private static async Task<Guid> IdAsync(Task<HttpResponseMessage> verzoek, HttpStatusCode verwacht)
    {
        using var antwoord = await verzoek;
        Assert.True(antwoord.StatusCode == verwacht, $"Expected {verwacht}, got {(int)antwoord.StatusCode}: {await antwoord.Content.ReadAsStringAsync()}");
        return (await antwoord.Content.ReadFromJsonAsync<RechtenTestOpzet.IdDto>())!.Id;
    }

    private async Task ZetLaatsteSchrijfactieAsync(Guid runId, DateTimeOffset moment)
    {
        await using var context = _omgeving.Db.MaakContext();
        await context.Wizardruns
            .Where(r => r.Id == runId)
            .ExecuteUpdateAsync(zet => zet.SetProperty(r => r.LaatsteSchrijfactieOp, moment));
    }

    private sealed record RunDto(
        Guid Id,
        Guid ThemaId,
        Guid? GestartDoorId,
        bool IsOpen,
        DateTimeOffset LaatsteSchrijfactieOp,
        List<ItemDto> Aangemaakt);

    private sealed record ItemDto(string Soort, Guid Id);

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
            await RechtenTestOpzet.ZaaiDoelAsync(Db, Doelcode);
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
