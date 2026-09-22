using System.Net;
using System.Net.Http.Json;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Schoolcontent;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.IntegrationTests.Postgres;

/// <summary>
/// FB-057 (ADR-0050) over HTTP against PostgreSQL: the open count per leeftijd without AI, the AI's proposals for an
/// existing and a new subthema, what accepting and rejecting write, that a rejected placement does not come back, that an
/// unreadable or invented answer stores nothing of it, and who may ask, decide and see. The AI is the factory's stub
/// (Art. IV.6).
/// </summary>
public sealed class SubdoelplaatsingEndpointsTests : IAsyncLifetime
{
    private const string Md = "PLA-MD-1";
    private const string Bezet = "PLA-K2-01";
    private const string Egel = "PLA-K2-05";
    private const string Regen = "PLA-K2-09";
    private const string Wind = "PLA-K2-11";
    private const string K3Doel = "PLA-K3-01";

    private PostgresTestDatabase _db = null!;
    private PostgresApiFactory _factory = null!;

    public async Task InitializeAsync()
    {
        if (!PostgresTestDatabase.IsBeschikbaar)
        {
            return;
        }

        _db = await PostgresTestDatabase.MaakAsync("subdoelplaatsing");
        _factory = new PostgresApiFactory(_db.ConnectionString);

        await RechtenTestOpzet.ZaaiMinimumdoelAsync(_db, Md);
        await using var context = _db.MaakContext();
        context.Leerplandoelen.AddRange(
            Doel(Bezet, "K2", "Bladeren kleuren."),
            Doel(Egel, "K2", "Dieren voor de winter."),
            Doel(Regen, "K2", "Temperatuur en neerslag."),
            Doel(Wind, "K2", "Wind zichtbaar maken."),
            Doel(K3Doel, "K3", "Een K3-doel."),
            new Leerplandoel("PLA-K2-99", Doelsoort.Gemeenschappelijk, "K2", "Natuur", "Weer", "9.1", tekst: "Niet geconcordeerd."));
        await context.SaveChangesAsync();
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

    private static Leerplandoel Doel(string code, string jaarFase, string tekst) =>
        new(code, Doelsoort.Gemeenschappelijk, jaarFase, "Natuur", "Seizoenen", "9.1", tekst: tekst, minimumdoelRef: Md);

    /// <summary>A thema with the minimumdoel as themadoel and a K2 subthema holding <see cref="Bezet"/>.</summary>
    private async Task<(Guid ThemaId, Guid SubthemaId)> ThemaAsync()
    {
        var themaId = await Opzet.ThemaAsync();
        var subthemaId = await Opzet.SubthemaAsync("K2", themaId);
        using var admin = Opzet.Admin();
        Assert.Equal(HttpStatusCode.OK, await RechtenTestOpzet.StatusAsync(
            admin.PostAsJsonAsync($"/api/themas/{themaId}/minimumdoelen", new { minimumdoelRef = Md })));
        Assert.Equal(HttpStatusCode.OK, await RechtenTestOpzet.StatusAsync(
            admin.PostAsJsonAsync($"/api/subthemas/{subthemaId}/doelkoppelingen", new { leerplandoelCode = Bezet })));
        return (themaId, subthemaId);
    }

    private static string Antwoord(string subthema) =>
        $$"""
        {"plaatsingen": [
           {"code": "{{Egel}}", "subthema": "S1", "motivatie": "Past bij het subthema."},
           {"code": "{{Regen}}", "subthema": "N1", "motivatie": "Weer."},
           {"code": "{{Wind}}", "subthema": "N1", "motivatie": "Wind."},
           {"code": "{{Bezet}}", "subthema": "S1", "motivatie": "Staat er al."},
           {"code": "PLA-K2-99", "subthema": "S1", "motivatie": "Niet open."}],
         "nieuweSubthemas": [{"sleutel": "N1", "naam": "{{subthema}}", "onderzoeksvraag": "Waar komt regen vandaan?", "duurWeken": 2, "motivatie": "Geen weersubthema."}]}
        """;

    private static async Task<Overzicht> LeesAsync(HttpClient client, Guid themaId) =>
        (await client.GetFromJsonAsync<Overzicht>($"/api/themas/{themaId}/subdoelplaatsing"))!;

    private static async Task<LeeftijdDto> K2Async(HttpClient client, Guid themaId) =>
        Assert.Single((await LeesAsync(client, themaId)).Leeftijden, l => l.Leeftijd == "K2");

    private static async Task<Resultaat> GenereerAsync(HttpClient client, Guid themaId, string leeftijd = "K2")
    {
        using var antwoord = await client.PostAsync($"/api/themas/{themaId}/subdoelplaatsing/{leeftijd}/genereer", null);
        Assert.True(antwoord.StatusCode == HttpStatusCode.OK, await antwoord.Content.ReadAsStringAsync());
        return (await antwoord.Content.ReadFromJsonAsync<Resultaat>())!;
    }

    [PostgresFact]
    public async Task Het_open_aantal_telt_zonder_AI_ook_bij_een_leeftijd_zonder_subthema_maar_niet_zonder_open_doelen()
    {
        var (themaId, _) = await ThemaAsync();
        using var admin = Opzet.Admin();

        var leeftijden = (await LeesAsync(admin, themaId)).Leeftijden;

        // K2 has a subthema; K3 has none but the themadoel brings it one open goal (ADR-0064). No other leeftijd has an
        // open goal, so none is listed.
        Assert.Equal(["K2", "K3"], leeftijden.Select(l => l.Leeftijd));
        Assert.Equal((3, true), (leeftijden[0].AantalOpen, leeftijden[0].HeeftSubthema));
        Assert.Equal((1, false), (leeftijden[1].AantalOpen, leeftijden[1].HeeftSubthema));
        Assert.Empty(leeftijden[0].Subdoelvoorstellen);
    }

    [PostgresFact]
    public async Task De_AI_stelt_een_bestaand_en_een_nieuw_subthema_voor_en_aanvaarden_schrijft_gewone_inhoud()
    {
        var (themaId, subthemaId) = await ThemaAsync();
        using var admin = Opzet.Admin();
        _factory.AiAntwoord = Antwoord("Regen en wind");

        var resultaat = await GenereerAsync(admin, themaId);
        Assert.Equal(new Resultaat(true, 3, 1, 2, null), resultaat);

        var k2 = await K2Async(admin, themaId);
        var subdoel = Assert.Single(k2.Subdoelvoorstellen);
        Assert.Equal((Egel, subthemaId, "Dieren voor de winter."), (subdoel.LeerplandoelCode, subdoel.SubthemaId!.Value, subdoel.Tekst));
        var nieuw = Assert.Single(k2.Subthemavoorstellen);
        Assert.Equal([Regen, Wind], nieuw.Doelen.Select(d => d.LeerplandoelCode));

        // Nothing counts before a decision (D5): the open count stays 3.
        Assert.Equal(3, k2.AantalOpen);

        Assert.Equal(HttpStatusCode.NoContent, await RechtenTestOpzet.StatusAsync(
            admin.PutAsJsonAsync($"/api/subdoelvoorstellen/{subdoel.Id}/status", new { status = "Aanvaard" })));
        Assert.Equal(HttpStatusCode.NoContent, await RechtenTestOpzet.StatusAsync(
            admin.PutAsJsonAsync($"/api/subthemavoorstellen/{nieuw.Id}/beslissing", new
            {
                status = "Aanvaard",
                naam = "Regenweer",
                duurWeken = 3,
                leerplandoelCodes = new[] { Regen },
            })));

        await using var context = _db.MaakContext();
        var subthemas = await context.Subthemas.AsNoTracking()
            .Include(s => s.Subdoelen).Include(s => s.Onderzoeksvragen)
            .Where(s => s.ThemaId == themaId)
            .ToListAsync();
        var bestaand = subthemas.Single(s => s.Id == subthemaId);
        var egel = bestaand.Subdoelen.Single(sd => sd.Koppeling.LeerplandoelCode == Egel);
        Assert.Equal((KoppelingStatus.Aanvaard, "Past bij het subthema."), (egel.Koppeling.Status, egel.Koppeling.AiMotivatie));

        var gemaakt = subthemas.Single(s => s.Id != subthemaId);
        Assert.Equal(("Regenweer", 3, "K2"), (gemaakt.Naam, gemaakt.DuurWeken, gemaakt.Leeftijd));
        Assert.Equal("Waar komt regen vandaan?", Assert.Single(gemaakt.Onderzoeksvragen).Vraag);
        Assert.Equal(Regen, Assert.Single(gemaakt.Subdoelen).Koppeling.LeerplandoelCode);

        var voorstel = await context.Subthemavoorstellen.AsNoTracking().SingleAsync(v => v.Id == nieuw.Id);
        Assert.Equal((KoppelingStatus.Manueel, gemaakt.Id), (voorstel.Status, voorstel.SubthemaId!.Value));
        Assert.Equal(KoppelingStatus.Geweigerd, (await context.Subdoelvoorstellen.AsNoTracking().SingleAsync(v => v.LeerplandoelCode == Wind)).Status);

        // Only the goal left out is still open, and a decided proposal is refused.
        Assert.Equal(1, (await K2Async(admin, themaId)).AantalOpen);
        await RechtenTestOpzet.VerwachtAsync(
            admin.PutAsJsonAsync($"/api/subdoelvoorstellen/{subdoel.Id}/status", new { status = "Geweigerd" }),
            HttpStatusCode.BadRequest,
            "Over dit voorstel is al beslist. Vernieuw de pagina om te zien wat er nu staat.");
    }

    [PostgresFact]
    public async Task Een_geweigerde_plaatsing_en_naam_komen_niet_terug_en_een_nieuwe_vraag_vervangt_de_open_voorstellen()
    {
        var (themaId, _) = await ThemaAsync();
        using var admin = Opzet.Admin();
        _factory.AiAntwoord = Antwoord("Regen en wind");
        await GenereerAsync(admin, themaId);
        var k2 = await K2Async(admin, themaId);

        Assert.Equal(HttpStatusCode.NoContent, await RechtenTestOpzet.StatusAsync(
            admin.PutAsJsonAsync($"/api/subdoelvoorstellen/{k2.Subdoelvoorstellen[0].Id}/status", new { status = "Geweigerd" })));
        Assert.Equal(HttpStatusCode.NoContent, await RechtenTestOpzet.StatusAsync(
            admin.PutAsJsonAsync($"/api/subthemavoorstellen/{k2.Subthemavoorstellen[0].Id}/beslissing", new { status = "Geweigerd" })));

        // The model repeats both: nothing of it is stored.
        var tweede = await GenereerAsync(admin, themaId);
        Assert.Equal(0, tweede.AantalVoorgesteld);
        Assert.Empty((await K2Async(admin, themaId)).Subthemavoorstellen);

        // A new name is accepted, and a third run replaces its open proposals rather than adding to them.
        _factory.AiAntwoord = Antwoord("Weer en wind");
        await GenereerAsync(admin, themaId);
        await GenereerAsync(admin, themaId);
        var derde = await K2Async(admin, themaId);
        Assert.Equal("Weer en wind", Assert.Single(derde.Subthemavoorstellen).Naam);
        Assert.Empty(derde.Subdoelvoorstellen);

        await using var context = _db.MaakContext();
        Assert.Equal(2, await context.Subthemavoorstellen.CountAsync(v => v.ThemaId == themaId));
    }

    [PostgresFact]
    public async Task Een_onleesbaar_antwoord_bewaart_niets()
    {
        var (themaId, _) = await ThemaAsync();
        using var admin = Opzet.Admin();
        _factory.AiAntwoord = "geen json";

        using var antwoord = await admin.PostAsync($"/api/themas/{themaId}/subdoelplaatsing/K2/genereer", null);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, antwoord.StatusCode);

        await using var context = _db.MaakContext();
        Assert.False(await context.Subdoelvoorstellen.AnyAsync(v => v.ThemaId == themaId));
    }

    [PostgresFact]
    public async Task Een_leeftijd_zonder_subthema_krijgt_alleen_nieuwe_subthemas_en_aanvaarden_maakt_het_eerste()
    {
        var (themaId, _) = await ThemaAsync();
        using var admin = Opzet.Admin();
        // The model also tries S1, which does not exist at K3: only the new subthema survives (D7).
        _factory.AiAntwoord = $$"""
            {"plaatsingen": [
               {"code": "{{K3Doel}}", "subthema": "N1", "motivatie": "Eigen subthema."},
               {"code": "{{K3Doel}}", "subthema": "S1", "motivatie": "Bestaat niet."}],
             "nieuweSubthemas": [{"sleutel": "N1", "naam": "Wolken", "onderzoeksvraag": "Waarom regent het?", "duurWeken": 2, "motivatie": "Nog niets voor K3."}]}
            """;

        var resultaat = await GenereerAsync(admin, themaId, "K3");
        Assert.Equal((1, 1), (resultaat.AantalVoorgesteld, resultaat.AantalNieuweSubthemas));

        var k3 = Assert.Single((await LeesAsync(admin, themaId)).Leeftijden, l => l.Leeftijd == "K3");
        Assert.Empty(k3.Subdoelvoorstellen);
        var nieuw = Assert.Single(k3.Subthemavoorstellen);
        Assert.Equal(K3Doel, Assert.Single(nieuw.Doelen).LeerplandoelCode);

        Assert.Equal(HttpStatusCode.NoContent, await RechtenTestOpzet.StatusAsync(
            admin.PutAsJsonAsync($"/api/subthemavoorstellen/{nieuw.Id}/beslissing", new { status = "Aanvaard" })));

        k3 = Assert.Single((await LeesAsync(admin, themaId)).Leeftijden, l => l.Leeftijd == "K3");
        Assert.Equal((0, true), (k3.AantalOpen, k3.HeeftSubthema));
        await using var context = _db.MaakContext();
        var subthema = await context.Subthemas.Include(s => s.Subdoelen).SingleAsync(s => s.ThemaId == themaId && s.Leeftijd == "K3");
        Assert.Equal("Wolken", subthema.Naam);
        Assert.Equal(K3Doel, Assert.Single(subthema.Subdoelen).Koppeling.LeerplandoelCode);
    }

    [PostgresFact]
    public async Task Alleen_de_hoofdleerkracht_van_de_leeftijd_en_admin_vragen_beslissen_en_zien_de_voorstellen()
    {
        var school = await Opzet.SchoolAsync();
        var (themaId, _) = await ThemaAsync();
        using var admin = Opzet.Admin();
        _factory.AiAntwoord = Antwoord("Regen en wind");

        using var hlK2 = Opzet.Als(await Opzet.GebruikerAsync(school, hoofdleerkrachtVan: ["K2"]));
        using var hlK3 = Opzet.Als(await Opzet.GebruikerAsync(school, hoofdleerkrachtVan: ["K3"]));
        using var themabeheer = Opzet.Als(await Opzet.GebruikerAsync(school, themabeheer: true));
        using var leerkracht = Opzet.Als(await Opzet.GebruikerAsync(school, klassen: [school.K2Rood]));

        Assert.Equal(3, (await GenereerAsync(hlK2, themaId)).AantalVoorgesteld);
        var voorstel = Assert.Single((await K2Async(hlK2, themaId)).Subdoelvoorstellen);

        foreach (var ander in new[] { hlK3, themabeheer, leerkracht })
        {
            await RechtenTestOpzet.VerwachtAsync(
                ander.PostAsync($"/api/themas/{themaId}/subdoelplaatsing/K2/genereer", null), HttpStatusCode.Forbidden, RechtenTestOpzet.GeenToegang);
            await RechtenTestOpzet.VerwachtAsync(
                ander.PutAsJsonAsync($"/api/subdoelvoorstellen/{voorstel.Id}/status", new { status = "Aanvaard" }),
                HttpStatusCode.Forbidden,
                RechtenTestOpzet.GeenToegang);

            var gezien = await K2Async(ander, themaId);
            Assert.Equal((3, false), (gezien.AantalOpen, gezien.MagBeslissen));
            Assert.Empty(gezien.Subdoelvoorstellen);
            Assert.Empty(gezien.Subthemavoorstellen);
        }

        // ADR-0064: K3 has no subthema, so only whoever may decide there sees it, and only they may ask for it.
        Assert.Equal(["K2"], (await LeesAsync(hlK2, themaId)).Leeftijden.Select(l => l.Leeftijd));
        Assert.Equal(["K2"], (await LeesAsync(themabeheer, themaId)).Leeftijden.Select(l => l.Leeftijd));
        Assert.Equal(["K2"], (await LeesAsync(leerkracht, themaId)).Leeftijden.Select(l => l.Leeftijd));
        var k3VoorK3 = Assert.Single((await LeesAsync(hlK3, themaId)).Leeftijden, l => l.Leeftijd == "K3");
        Assert.Equal((1, true, false), (k3VoorK3.AantalOpen, k3VoorK3.MagBeslissen, k3VoorK3.HeeftSubthema));
        foreach (var ander in new[] { hlK2, themabeheer, leerkracht })
        {
            await RechtenTestOpzet.VerwachtAsync(
                ander.PostAsync($"/api/themas/{themaId}/subdoelplaatsing/K3/genereer", null), HttpStatusCode.Forbidden, RechtenTestOpzet.GeenToegang);
        }

        Assert.True((await K2Async(admin, themaId)).MagBeslissen);
        Assert.Equal(HttpStatusCode.NoContent, await RechtenTestOpzet.StatusAsync(
            hlK2.PutAsJsonAsync($"/api/subdoelvoorstellen/{voorstel.Id}/status", new { status = "Aanvaard" })));
    }

    [PostgresFact]
    public async Task Een_voorstel_in_een_subthema_dat_intussen_van_leeftijd_wisselde_beslist_de_oude_leeftijd_niet_meer()
    {
        var school = await Opzet.SchoolAsync();
        var (themaId, subthemaId) = await ThemaAsync();
        using var admin = Opzet.Admin();
        _factory.AiAntwoord = Antwoord("Regen en wind");
        await GenereerAsync(admin, themaId);
        var voorstel = Assert.Single((await K2Async(admin, themaId)).Subdoelvoorstellen);

        Assert.Equal(HttpStatusCode.OK, await RechtenTestOpzet.StatusAsync(
            admin.PutAsJsonAsync($"/api/subthemas/{subthemaId}", new { naam = "Regen", duurWeken = 2, leeftijd = "K3" })));

        // The rights check reads the subthema's leeftijd now: the K2 hoofdleerkracht is refused, and nothing is written.
        using var hlK2 = Opzet.Als(await Opzet.GebruikerAsync(school, hoofdleerkrachtVan: ["K2"]));
        await RechtenTestOpzet.VerwachtAsync(
            hlK2.PutAsJsonAsync($"/api/subdoelvoorstellen/{voorstel.Id}/status", new { status = "Aanvaard" }),
            HttpStatusCode.Forbidden,
            RechtenTestOpzet.GeenToegang);

        // Whoever may act at K3 is told the proposal no longer says what it would do.
        await RechtenTestOpzet.VerwachtAsync(
            admin.PutAsJsonAsync($"/api/subdoelvoorstellen/{voorstel.Id}/status", new { status = "Aanvaard" }),
            HttpStatusCode.BadRequest,
            "Regen hoort intussen bij een andere leeftijd. Vraag opnieuw voorstellen voor K3.");

        await using var context = _db.MaakContext();
        Assert.False(await context.Subdoelen.AnyAsync(sd => sd.SubthemaId == subthemaId && sd.Koppeling.LeerplandoelCode == Egel));
    }

    [PostgresFact]
    public async Task Een_nieuw_subthema_plaatst_geen_doel_dat_intussen_met_de_hand_geplaatst_is()
    {
        var (themaId, subthemaId) = await ThemaAsync();
        using var admin = Opzet.Admin();
        _factory.AiAntwoord = Antwoord("Regen en wind");
        await GenereerAsync(admin, themaId);
        var nieuw = Assert.Single((await K2Async(admin, themaId)).Subthemavoorstellen);

        Assert.Equal(HttpStatusCode.OK, await RechtenTestOpzet.StatusAsync(
            admin.PostAsJsonAsync($"/api/subthemas/{subthemaId}/doelkoppelingen", new { leerplandoelCode = Regen })));

        await RechtenTestOpzet.VerwachtAsync(
            admin.PutAsJsonAsync($"/api/subthemavoorstellen/{nieuw.Id}/beslissing", new { status = "Aanvaard" }),
            HttpStatusCode.BadRequest,
            $"{Regen} staat intussen al in een subthema van K2. Laat het weg, of weiger het voorgestelde subthema.");
        await RechtenTestOpzet.VerwachtAsync(
            admin.PutAsJsonAsync($"/api/subthemavoorstellen/{nieuw.Id}/beslissing", new { status = "Aanvaard", naam = "regen" }),
            HttpStatusCode.BadRequest,
            "Er is al een subthema regen voor K2. Kies een andere naam.");
        Assert.Equal(HttpStatusCode.NoContent, await RechtenTestOpzet.StatusAsync(
            admin.PutAsJsonAsync($"/api/subthemavoorstellen/{nieuw.Id}/beslissing", new { status = "Aanvaard", leerplandoelCodes = new[] { Wind } })));
    }

    [PostgresFact]
    public async Task Een_verwijderd_subthema_neemt_zijn_voorstellen_mee()
    {
        var (themaId, subthemaId) = await ThemaAsync();
        using var admin = Opzet.Admin();
        _factory.AiAntwoord = Antwoord("Regen en wind");
        await GenereerAsync(admin, themaId);

        Assert.Equal(HttpStatusCode.NoContent, await RechtenTestOpzet.StatusAsync(admin.DeleteAsync($"/api/subthemas/{subthemaId}")));

        await using var context = _db.MaakContext();
        Assert.False(await context.Subdoelvoorstellen.AnyAsync(v => v.SubthemaId == subthemaId));
        Assert.Equal(2, await context.Subdoelvoorstellen.CountAsync(v => v.ThemaId == themaId));
    }

    private sealed record Overzicht(Guid ThemaId, List<LeeftijdDto> Leeftijden);

    private sealed record LeeftijdDto(
        string Leeftijd,
        int AantalOpen,
        bool MagBeslissen,
        List<Subdoel> Subdoelvoorstellen,
        List<Subthema> Subthemavoorstellen,
        bool HeeftSubthema);

    private sealed record Subdoel(Guid Id, string LeerplandoelCode, string? Tekst, Guid? SubthemaId, string AiMotivatie);

    private sealed record Subthema(Guid Id, string Naam, string Onderzoeksvraag, int DuurWeken, List<Subdoel> Doelen);

    private sealed record Resultaat(bool IsGeslaagd, int AantalVoorgesteld, int AantalNieuweSubthemas, int AantalOvergeslagen, string? Fout);
}
