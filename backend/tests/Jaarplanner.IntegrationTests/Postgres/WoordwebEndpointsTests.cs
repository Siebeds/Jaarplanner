using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.Domain.Toegang;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.IntegrationTests.Postgres;

/// <summary>
/// FB-036 (ADR-0041) over HTTP against PostgreSQL: a teacher keeps her own woordweb on a subthema, a colleague reads it
/// and cannot change it, the AI proposes only after a word of her own and at most five, every proposal waits for her
/// decision, a rejected word never comes back, and an answer outside the contract stores nothing. The AI is the
/// factory's stub (Art. IV.6): left unset it fails the test, so a request refused before the call is proven refused.
/// </summary>
public sealed class WoordwebEndpointsTests : IAsyncLifetime
{
    private const string Doelcode = "WOORD-01";
    private const string EerstZelf = "Zet eerst zelf een woord in je woordweb. Daarna stelt de AI er woorden bij voor.";

    private PostgresTestDatabase _db = null!;
    private PostgresApiFactory _factory = null!;

    public async Task InitializeAsync()
    {
        if (!PostgresTestDatabase.IsBeschikbaar)
        {
            return;
        }

        _db = await PostgresTestDatabase.MaakAsync("woordweb");
        _factory = new PostgresApiFactory(_db.ConnectionString);
        await RechtenTestOpzet.ZaaiDoelAsync(_db, Doelcode);
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

    private RechtenTestOpzet Opzet => new(_db, _factory);

    [PostgresFact]
    public async Task Een_leerkracht_houdt_een_eigen_woordweb_bij_dat_een_collega_leest_maar_niet_wijzigt()
    {
        var school = await Opzet.SchoolAsync();
        var subthemaId = await Opzet.SubthemaAsync("K3");
        using var an = Opzet.Als(await PersoonAsync("Leerkracht An", klassen: [school.K3Blauw]));
        using var bo = Opzet.Als(await PersoonAsync("Leerkracht Bo", klassen: [school.K3Groen]));

        var web = await WebAsync(an.PostAsJsonAsync(Eigen(subthemaId), new { woorden = new[] { "wind", "Regen", "WIND", " " } }));
        Assert.True(web.IsEigen);
        Assert.Equal(["wind", "Regen"], web.Woorden.Select(w => w.Woord));
        Assert.All(web.Woorden, w => Assert.Equal("Manueel", w.Status));

        var vanAn = Assert.Single(await LeesAsync(bo, subthemaId));
        Assert.Equal("Leerkracht An", vanAn.EigenaarNaam);
        Assert.False(vanAn.IsEigen);
        Assert.Equal(["wind", "Regen"], vanAn.Woorden.Select(w => w.Woord));

        var woordId = web.Woorden[0].Id;
        Assert.Equal(HttpStatusCode.Forbidden, await RechtenTestOpzet.StatusAsync(bo.PostAsJsonAsync($"/api/woordwebs/{web.Id}/woorden", new { woorden = new[] { "zon" } })));
        Assert.Equal(HttpStatusCode.Forbidden, await RechtenTestOpzet.StatusAsync(bo.DeleteAsync($"/api/woordwebs/{web.Id}/woorden/{woordId}")));
        Assert.Equal(HttpStatusCode.Forbidden, await RechtenTestOpzet.StatusAsync(bo.PutAsJsonAsync($"/api/woordwebs/{web.Id}/woorden/{woordId}/status", new { status = "Aanvaard" })));
        Assert.Equal(HttpStatusCode.Forbidden, await RechtenTestOpzet.StatusAsync(bo.PostAsync($"/api/woordwebs/{web.Id}/voorstellen", null)));

        // Bo keeps her own: both are on the page, each reader's own first.
        await WebAsync(bo.PostAsJsonAsync(Eigen(subthemaId), new { woorden = new[] { "paraplu" } }));
        var voorAn = await LeesAsync(an, subthemaId);
        Assert.Equal(["Leerkracht An", "Leerkracht Bo"], voorAn.Select(w => w.EigenaarNaam));
        Assert.True(voorAn[0].IsEigen);
        Assert.Equal("Leerkracht Bo", (await LeesAsync(bo, subthemaId))[0].EigenaarNaam);

        // The owner edits her web by its id, and directie edits any web (D3).
        Assert.Equal(HttpStatusCode.OK, await RechtenTestOpzet.StatusAsync(an.DeleteAsync($"/api/woordwebs/{web.Id}/woorden/{woordId}")));
        using var directie = Opzet.Als(await PersoonAsync("Directeur", directie: true));
        var naDirectie = await WebAsync(directie.PostAsJsonAsync($"/api/woordwebs/{web.Id}/woorden", new { woorden = new[] { "zon" } }));
        Assert.Equal(["Regen", "zon"], naDirectie.Woorden.Select(w => w.Woord));
        Assert.False(naDirectie.IsEigen);
    }

    [PostgresFact]
    public async Task Een_gebruiker_zonder_enig_recht_houdt_toch_een_eigen_woordweb_bij()
    {
        var subthemaId = await Opzet.SubthemaAsync("K2");
        using var zonderRecht = Opzet.Als(await PersoonAsync("Zorgcoördinator"));

        var web = await WebAsync(zonderRecht.PostAsJsonAsync(Eigen(subthemaId), new { woorden = new[] { "bos" } }));

        Assert.True(web.IsEigen);
        Assert.Equal(HttpStatusCode.OK, await RechtenTestOpzet.StatusAsync(
            zonderRecht.PostAsJsonAsync($"/api/woordwebs/{web.Id}/woorden", new { woorden = new[] { "blad" } })));
    }

    [PostgresFact]
    public async Task De_ai_stelt_pas_voor_na_een_eigen_woord_hoogstens_vijf_en_een_geweigerd_woord_komt_niet_terug()
    {
        var subthemaId = await Opzet.SubthemaAsync("K3");
        using var an = Opzet.Als(await PersoonAsync("Leerkracht An"));
        var web = await WebAsync(an.PostAsJsonAsync(Eigen(subthemaId), new { woorden = new[] { "wind" } }));
        await WebAsync(an.DeleteAsync($"/api/woordwebs/{web.Id}/woorden/{web.Woorden[0].Id}"));

        // An empty web: refused before any call, since the stub would fail the test if reached.
        await RechtenTestOpzet.VerwachtAsync(an.PostAsync($"/api/woordwebs/{web.Id}/voorstellen", null), HttpStatusCode.BadRequest, EerstZelf);

        await WebAsync(an.PostAsJsonAsync($"/api/woordwebs/{web.Id}/woorden", new { woorden = new[] { "wind" } }));
        _factory.AiAntwoord = Antwoord("Wind", "wolk", "regenboog", "donder", "bliksem", "plas", "paraplu");

        var eerste = await VoorstelAsync(an, web.Id);
        Assert.Equal(5, eerste.AantalVoorgesteld);
        var voorgesteld = eerste.Woordweb!.Woorden.Where(w => w.Status == "Voorgesteld").ToList();
        Assert.Equal(["wolk", "regenboog", "donder", "bliksem", "plas"], voorgesteld.Select(w => w.Woord));
        Assert.All(voorgesteld, w => Assert.Equal($"{w.Woord} past bij het subthema.", w.AiMotivatie));

        var pad = (WoordDto woord) => $"/api/woordwebs/{web.Id}/woorden/{woord.Id}/status";
        await WebAsync(an.PutAsJsonAsync(pad(voorgesteld[0]), new { status = "Aanvaard" }));
        await WebAsync(an.PutAsJsonAsync(pad(voorgesteld[1]), new { status = "Geweigerd" }));
        await RechtenTestOpzet.VerwachtAsync(an.PutAsJsonAsync(pad(voorgesteld[1]), new { status = "Aanvaard" }), HttpStatusCode.BadRequest, "Over dit woord is al beslist.");
        await RechtenTestOpzet.VerwachtAsync(an.PutAsJsonAsync(pad(voorgesteld[2]), new { status = "Manueel" }), HttpStatusCode.BadRequest, "Een voorgesteld woord aanvaard of weiger je.");

        // A second request: the rejected word and every word already in the web, in any status, are skipped.
        _factory.AiAntwoord = Antwoord("regenboog", "Wolk", "wind", "donder", "modder");
        Assert.Equal(1, (await VoorstelAsync(an, web.Id)).AantalVoorgesteld);

        // And every decision is stored: a fresh read has them.
        var gelezen = Assert.Single(await LeesAsync(an, subthemaId));
        Assert.Equal("Aanvaard", gelezen.Woorden.Single(w => w.Woord == "wolk").Status);
        Assert.Equal("Geweigerd", Assert.Single(gelezen.Woorden, w => w.Woord.Equals("regenboog", StringComparison.OrdinalIgnoreCase)).Status);
        Assert.Equal("Voorgesteld", gelezen.Woorden.Single(w => w.Woord == "modder").Status);
        // wind, the five of the first request, and modder.
        Assert.Equal(7, gelezen.Woorden.Count);
    }

    [PostgresFact]
    public async Task Een_antwoord_buiten_het_contract_geeft_422_en_bewaart_niets()
    {
        var subthemaId = await Opzet.SubthemaAsync("K3");
        using var an = Opzet.Als(await PersoonAsync("Leerkracht An"));
        var web = await WebAsync(an.PostAsJsonAsync(Eigen(subthemaId), new { woorden = new[] { "wind" } }));

        // One good word beside one without a motivation: the whole answer is refused, the good word too.
        _factory.AiAntwoord = """{"woorden": [{"woord": "wolk", "motivatie": "Een reden."}, {"woord": "regen"}]}""";
        using var antwoord = await an.PostAsync($"/api/woordwebs/{web.Id}/voorstellen", null);

        Assert.Equal(HttpStatusCode.UnprocessableEntity, antwoord.StatusCode);
        Assert.Equal(["wind"], Assert.Single(await LeesAsync(an, subthemaId)).Woorden.Select(w => w.Woord));
    }

    [PostgresFact]
    public async Task Een_woordweb_verandert_geen_enkel_dekkingscijfer()
    {
        // Art. V.1 and ADR-0041: a word is not a doel. The whole dekking payload of a K3 klas is read before and after
        // typed words, an AI request and an accepted AI word on a subthema of a thema with a themadoel, and compared as
        // text, so no figure anywhere in it may move.
        var school = await Opzet.SchoolAsync();
        var themaId = await Opzet.ThemaAsync();
        var subthemaId = await Opzet.SubthemaAsync("K3", themaId);
        using var directie = Opzet.Directie();
        Assert.Equal(HttpStatusCode.OK, await RechtenTestOpzet.StatusAsync(
            directie.PostAsJsonAsync($"/api/themas/{themaId}/themadoelen", new { leerplandoelCode = Doelcode })));
        var voor = await directie.GetStringAsync($"/api/klassen/{school.K3Blauw}/dekking");

        using var an = Opzet.Als(await PersoonAsync("Leerkracht An", klassen: [school.K3Blauw]));
        var web = await WebAsync(an.PostAsJsonAsync(Eigen(subthemaId), new { woorden = new[] { "wind", "regen" } }));
        _factory.AiAntwoord = Antwoord("wolk");
        var voorstel = (await VoorstelAsync(an, web.Id)).Woordweb!.Woorden.Single(w => w.Status == "Voorgesteld");
        await WebAsync(an.PutAsJsonAsync($"/api/woordwebs/{web.Id}/woorden/{voorstel.Id}/status", new { status = "Aanvaard" }));

        Assert.Equal(voor, await directie.GetStringAsync($"/api/klassen/{school.K3Blauw}/dekking"));
    }

    [PostgresFact]
    public async Task Wie_een_subthema_verwijdert_verwijdert_de_woordwebs_erbij()
    {
        var subthemaId = await Opzet.SubthemaAsync("K3");
        using var an = Opzet.Als(await PersoonAsync("Leerkracht An"));
        var web = await WebAsync(an.PostAsJsonAsync(Eigen(subthemaId), new { woorden = new[] { "wind", "regen" } }));
        using var directie = Opzet.Directie();

        Assert.Equal(HttpStatusCode.NoContent, await RechtenTestOpzet.StatusAsync(directie.DeleteAsync($"/api/subthemas/{subthemaId}")));

        await using var context = _db.MaakContext();
        Assert.False(await context.Woordwebs.AnyAsync(w => w.Id == web.Id));
        Assert.False(await context.Set<WoordwebWoord>().AnyAsync(w => w.WoordwebId == web.Id));
    }

    [PostgresFact]
    public async Task Themabeheer_verwijdert_geen_nieuw_thema_waarop_een_collega_een_woordweb_bijhoudt()
    {
        // D5: a woordweb is someone's personal content, so it protects a thema from themabeheer's delete (I26) as another
        // person's subthema would. The same thema without the web is themabeheer's to delete, which is the control.
        using var themabeheer = Opzet.Als(await Opzet.GebruikerAsync(themabeheer: true));
        using var an = Opzet.Als(await PersoonAsync("Leerkracht An"));

        var metWeb = await RechtenTestOpzet.StartWizardAsync(themabeheer);
        var subthemaId = await IdAsync(themabeheer.PostAsJsonAsync(
            $"{RechtenTestOpzet.Wizard}/{metWeb.Id}/subthemas", new { naam = "Wind", duurWeken = 2, leeftijd = "K3" }));
        await WebAsync(an.PostAsJsonAsync(Eigen(subthemaId), new { woorden = new[] { "storm" } }));

        var zonderWeb = await RechtenTestOpzet.StartWizardAsync(themabeheer);
        await IdAsync(themabeheer.PostAsJsonAsync(
            $"{RechtenTestOpzet.Wizard}/{zonderWeb.Id}/subthemas", new { naam = "Wind", duurWeken = 2, leeftijd = "K3" }));

        Assert.Equal(HttpStatusCode.Forbidden, await RechtenTestOpzet.StatusAsync(themabeheer.DeleteAsync($"/api/themas/{metWeb.ThemaId}")));
        using var controle = await themabeheer.DeleteAsync($"/api/themas/{zonderWeb.ThemaId}");
        Assert.True(controle.IsSuccessStatusCode, $"The control delete answered {(int)controle.StatusCode}.");
    }

    [PostgresFact]
    public async Task Lege_en_te_lange_woorden_en_een_onbekend_subthema_krijgen_een_nederlandse_zin()
    {
        var subthemaId = await Opzet.SubthemaAsync("K3");
        using var an = Opzet.Als(await PersoonAsync("Leerkracht An"));
        var lang = new string('a', Woordweb.MaxWoordlengte + 1);

        await RechtenTestOpzet.VerwachtAsync(
            an.PostAsJsonAsync(Eigen(subthemaId), new { woorden = new[] { " " } }), HttpStatusCode.BadRequest, "Typ minstens één woord.");
        await RechtenTestOpzet.VerwachtAsync(
            an.PostAsJsonAsync(Eigen(subthemaId), new { woorden = new[] { lang } }),
            HttpStatusCode.BadRequest,
            $"\"{lang[..20]}…\" is te lang. Een woord in het woordweb telt hoogstens {Woordweb.MaxWoordlengte} tekens.");
        await RechtenTestOpzet.VerwachtAsync(
            an.GetAsync($"/api/subthemas/{Guid.NewGuid()}/woordwebs"),
            HttpStatusCode.NotFound,
            "Dit subthema bestaat niet meer. Iemand anders heeft het verwijderd.");
    }

    private async Task<Guid> PersoonAsync(string naam, bool directie = false, Guid[]? klassen = null)
    {
        var gebruiker = new Gebruiker($"{Guid.NewGuid():N}@school.be", naam, isDirectie: directie);
        await using var context = _db.MaakContext();
        context.Gebruikers.Add(gebruiker);
        await context.SaveChangesAsync();
        foreach (var klasId in klassen ?? [])
        {
            context.Klastoewijzingen.Add(new Klastoewijzing(gebruiker.Id, klasId));
        }

        await context.SaveChangesAsync();
        return gebruiker.Id;
    }

    private static string Eigen(Guid subthemaId) => $"/api/subthemas/{subthemaId}/woordwebs/eigen/woorden";

    private static string Antwoord(params string[] woorden) =>
        JsonSerializer.Serialize(new { woorden = woorden.Select(w => new { woord = w, motivatie = $"{w} past bij het subthema." }) });

    private static async Task<List<WebDto>> LeesAsync(HttpClient client, Guid subthemaId) =>
        (await client.GetFromJsonAsync<List<WebDto>>($"/api/subthemas/{subthemaId}/woordwebs"))!;

    private static async Task<WebDto> WebAsync(Task<HttpResponseMessage> verzoek)
    {
        using var antwoord = await verzoek;
        Assert.True(antwoord.StatusCode == HttpStatusCode.OK, $"Expected 200, got {(int)antwoord.StatusCode}: {await antwoord.Content.ReadAsStringAsync()}");
        return (await antwoord.Content.ReadFromJsonAsync<WebDto>())!;
    }

    private static async Task<VoorstelDto> VoorstelAsync(HttpClient client, Guid woordwebId)
    {
        using var antwoord = await client.PostAsync($"/api/woordwebs/{woordwebId}/voorstellen", null);
        Assert.True(antwoord.StatusCode == HttpStatusCode.OK, $"Expected 200, got {(int)antwoord.StatusCode}: {await antwoord.Content.ReadAsStringAsync()}");
        return (await antwoord.Content.ReadFromJsonAsync<VoorstelDto>())!;
    }

    private static async Task<Guid> IdAsync(Task<HttpResponseMessage> verzoek)
    {
        using var antwoord = await verzoek;
        Assert.True(antwoord.IsSuccessStatusCode, $"Seeding failed: {(int)antwoord.StatusCode} {await antwoord.Content.ReadAsStringAsync()}");
        return (await antwoord.Content.ReadFromJsonAsync<RechtenTestOpzet.IdDto>())!.Id;
    }

    private sealed record WebDto(Guid Id, Guid SubthemaId, Guid EigenaarId, string EigenaarNaam, bool IsEigen, List<WoordDto> Woorden);

    private sealed record WoordDto(Guid Id, string Woord, string Status, string? AiMotivatie);

    private sealed record VoorstelDto(bool IsGeslaagd, WebDto? Woordweb, int AantalVoorgesteld, string? Fout);
}
