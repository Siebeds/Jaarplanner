using System.Net;
using System.Net.Http.Json;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Schoolcontent;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.IntegrationTests.Postgres;

/// <summary>
/// FB-026 (ADR-0054) over HTTP against PostgreSQL: the AI's goal proposals for an activiteit, what accepting and rejecting
/// write, the subdoel proposal an accepted goal leaves at the subthema, that a rejected goal does not come back, who may
/// ask and decide, and that only a decided link stops the maker's delete (R25). The AI is the factory's stub (Art. IV.6).
/// </summary>
public sealed class ActiviteitDoelsuggestieEndpointsTests : IAsyncLifetime
{
    private static readonly string[] K2Doelen = ["ADS-K2-01", "ADS-K2-02", "ADS-K2-03", "ADS-K2-04", "ADS-K2-05", "ADS-K2-06", "ADS-K2-07"];
    private const string K3Doel = "ADS-K3-01";
    private const string Md = "ADS-MD-1";

    private PostgresTestDatabase _db = null!;
    private PostgresApiFactory _factory = null!;

    public async Task InitializeAsync()
    {
        if (!PostgresTestDatabase.IsBeschikbaar)
        {
            return;
        }

        _db = await PostgresTestDatabase.MaakAsync("activiteitdoelsuggesties");
        _factory = new PostgresApiFactory(_db.ConnectionString);

        await RechtenTestOpzet.ZaaiMinimumdoelAsync(_db, Md);
        await using var context = _db.MaakContext();
        foreach (var code in K2Doelen)
        {
            context.Leerplandoelen.Add(Doel(code, "K2"));
        }

        context.Leerplandoelen.Add(Doel(K3Doel, "K3"));
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

    private static Leerplandoel Doel(string code, string jaarFase) =>
        new(code, Doelsoort.Gemeenschappelijk, jaarFase, "Natuur", "Seizoenen", "9.1", tekst: $"Tekst van {code}.", minimumdoelRef: Md);

    private static string Antwoord(params string[] codes) =>
        "{\"suggesties\": [" + string.Join(", ", codes.Select(c => $"{{\"code\": \"{c}\", \"motivatie\": \"Past bij {c}.\"}}")) + "]}";

    private static async Task<Resultaat> GenereerAsync(HttpClient client, Guid activiteitId)
    {
        using var antwoord = await client.PostAsync($"/api/activiteiten/{activiteitId}/doelsuggesties/genereer", null);
        Assert.True(antwoord.StatusCode == HttpStatusCode.OK, await antwoord.Content.ReadAsStringAsync());
        return (await antwoord.Content.ReadFromJsonAsync<Resultaat>())!;
    }

    private static Task<HttpResponseMessage> BeslisAsync(HttpClient client, Guid activiteitId, Guid koppelingId, string status) =>
        client.PutAsJsonAsync($"/api/activiteiten/{activiteitId}/doelkoppelingen/{koppelingId}/status", new { status });

    private async Task<List<DoelKoppeling>> KoppelingenAsync(Guid activiteitId)
    {
        await using var context = _db.MaakContext();
        var activiteit = await context.Activiteiten.AsNoTracking().Include(a => a.Doelkoppelingen).SingleAsync(a => a.Id == activiteitId);
        return activiteit.Doelkoppelingen.OrderBy(k => k.LeerplandoelCode, StringComparer.Ordinal).ToList();
    }

    private async Task<Guid> KoppelingIdAsync(Guid activiteitId, string code) =>
        (await KoppelingenAsync(activiteitId)).Single(k => k.LeerplandoelCode == code).Id;

    [PostgresFact]
    public async Task De_AI_stelt_hoogstens_vijf_doelen_van_de_leeftijd_voor_en_laat_een_code_buiten_de_kandidaten_weg()
    {
        var subthemaId = await Opzet.SubthemaAsync("K2");
        var activiteit = await Opzet.ActiviteitAsync(subthemaId);
        using var directie = Opzet.Directie();
        _factory.AiAntwoord = Antwoord([K3Doel, "VERZONNEN-1", .. K2Doelen]);

        var resultaat = await GenereerAsync(directie, activiteit.Id);

        Assert.Equal(new Resultaat(true, 5, 4, null), resultaat);
        var koppelingen = await KoppelingenAsync(activiteit.Id);
        Assert.Equal(K2Doelen[..5], koppelingen.Select(k => k.LeerplandoelCode));
        Assert.All(koppelingen, k => Assert.Equal(KoppelingStatus.Voorgesteld, k.Status));
        Assert.All(koppelingen, k => Assert.Equal($"Past bij {k.LeerplandoelCode}.", k.AiMotivatie));

        // The prompt names only the activiteit and the goals of its leeftijd.
        Assert.DoesNotContain(K3Doel, _factory.LaatsteAiVerzoek!.VasteContext);
        Assert.Contains(K2Doelen[6], _factory.LaatsteAiVerzoek.VasteContext);
        Assert.Contains($"Naam: {activiteit.Naam}", _factory.LaatsteAiVerzoek.UserPrompt);
    }

    [PostgresFact]
    public async Task Aanvaarden_zet_het_doel_op_de_activiteit_en_stelt_het_voor_als_subdoel_dat_de_hoofdleerkracht_aanvaardt()
    {
        var school = await Opzet.SchoolAsync();
        var themaId = await Opzet.ThemaAsync();
        var subthemaId = await Opzet.SubthemaAsync("K2", themaId);
        using var directie = Opzet.Directie();
        Assert.Equal(HttpStatusCode.OK, await RechtenTestOpzet.StatusAsync(
            directie.PostAsJsonAsync($"/api/subthemas/{subthemaId}/doelkoppelingen", new { leerplandoelCode = K2Doelen[2] })));

        using var hlK2 = Opzet.Als(await Opzet.GebruikerAsync(school, hoofdleerkrachtVan: ["K2"]));
        var activiteit = await Opzet.ActiviteitAsync(subthemaId);
        _factory.AiAntwoord = Antwoord(K2Doelen[0], K2Doelen[1], K2Doelen[2], K2Doelen[3]);
        await GenereerAsync(hlK2, activiteit.Id);

        foreach (var (code, status) in new[] { (K2Doelen[0], "Aanvaard"), (K2Doelen[2], "Aanvaard"), (K2Doelen[1], "Geweigerd") })
        {
            Assert.Equal(HttpStatusCode.NoContent, await RechtenTestOpzet.StatusAsync(
                BeslisAsync(hlK2, activiteit.Id, await KoppelingIdAsync(activiteit.Id, code), status)));
        }

        var koppelingen = await KoppelingenAsync(activiteit.Id);
        Assert.Equal(
            [KoppelingStatus.Aanvaard, KoppelingStatus.Geweigerd, KoppelingStatus.Aanvaard, KoppelingStatus.Voorgesteld],
            koppelingen.Select(k => k.Status));

        // Only the accepted goal that is not yet a subdoel is proposed, at the subthema, naming the activiteit.
        var overzicht = (await hlK2.GetFromJsonAsync<Overzicht>($"/api/themas/{themaId}/subdoelplaatsing"))!;
        var voorstel = Assert.Single(Assert.Single(overzicht.Leeftijden).Subdoelvoorstellen);
        Assert.Equal((K2Doelen[0], subthemaId, activiteit.Naam, $"Past bij {K2Doelen[0]}."),
            (voorstel.LeerplandoelCode, voorstel.SubthemaId!.Value, voorstel.ActiviteitNaam, voorstel.AiMotivatie));

        await RechtenTestOpzet.VerwachtAsync(
            BeslisAsync(hlK2, activiteit.Id, await KoppelingIdAsync(activiteit.Id, K2Doelen[0]), "Geweigerd"),
            HttpStatusCode.BadRequest,
            "Over dit voorstel is al beslist. Vernieuw de pagina om te zien wat er nu staat.");

        Assert.Equal(HttpStatusCode.NoContent, await RechtenTestOpzet.StatusAsync(
            hlK2.PutAsJsonAsync($"/api/subdoelvoorstellen/{voorstel.Id}/status", new { status = "Aanvaard" })));
        await using var context = _db.MaakContext();
        Assert.True(await context.Subdoelen.AnyAsync(sd => sd.SubthemaId == subthemaId && sd.Koppeling.LeerplandoelCode == K2Doelen[0]));
    }

    [PostgresFact]
    public async Task Opnieuw_vragen_vervangt_de_open_voorstellen_en_brengt_geen_geweigerd_of_gekoppeld_doel_terug()
    {
        var subthemaId = await Opzet.SubthemaAsync("K2");
        var activiteit = await Opzet.ActiviteitAsync(subthemaId);
        using var directie = Opzet.Directie();
        _factory.AiAntwoord = Antwoord(K2Doelen[0], K2Doelen[1], K2Doelen[2]);
        await GenereerAsync(directie, activiteit.Id);
        await BeslisAsync(directie, activiteit.Id, await KoppelingIdAsync(activiteit.Id, K2Doelen[0]), "Aanvaard");
        await BeslisAsync(directie, activiteit.Id, await KoppelingIdAsync(activiteit.Id, K2Doelen[1]), "Geweigerd");

        // The model repeats the accepted and the rejected goal: only the new one is kept, and the open one it no longer
        // names is replaced.
        _factory.AiAntwoord = Antwoord(K2Doelen[0], K2Doelen[1], K2Doelen[4]);
        var tweede = await GenereerAsync(directie, activiteit.Id);

        Assert.Equal(new Resultaat(true, 1, 2, null), tweede);
        var koppelingen = await KoppelingenAsync(activiteit.Id);
        Assert.Equal(
            [(K2Doelen[0], KoppelingStatus.Aanvaard), (K2Doelen[1], KoppelingStatus.Geweigerd), (K2Doelen[4], KoppelingStatus.Voorgesteld)],
            koppelingen.Select(k => (k.LeerplandoelCode, k.Status)));
        Assert.Contains($"Al gekoppeld of geweigerd: {K2Doelen[0]}, {K2Doelen[1]}", _factory.LaatsteAiVerzoek!.UserPrompt);
    }

    [PostgresFact]
    public async Task Een_onleesbaar_antwoord_bewaart_niets()
    {
        var subthemaId = await Opzet.SubthemaAsync("K2");
        var activiteit = await Opzet.ActiviteitAsync(subthemaId);
        using var directie = Opzet.Directie();
        _factory.AiAntwoord = Antwoord(K2Doelen[0]);
        await GenereerAsync(directie, activiteit.Id);
        _factory.AiAntwoord = "geen json";

        using var antwoord = await directie.PostAsync($"/api/activiteiten/{activiteit.Id}/doelsuggesties/genereer", null);

        Assert.Equal(HttpStatusCode.UnprocessableEntity, antwoord.StatusCode);
        Assert.Equal(K2Doelen[0], Assert.Single(await KoppelingenAsync(activiteit.Id)).LeerplandoelCode);
    }

    [PostgresFact]
    public async Task Bij_een_gedeelde_activiteit_vraagt_en_beslist_een_leerkracht_zonder_hoofdleerkrachtrecht_niet()
    {
        var school = await Opzet.SchoolAsync();
        var subthemaId = await Opzet.SubthemaAsync("K2");
        var activiteit = await Opzet.ActiviteitAsync(subthemaId);
        using var directie = Opzet.Directie();
        _factory.AiAntwoord = Antwoord(K2Doelen[0]);
        await GenereerAsync(directie, activiteit.Id);
        var koppelingId = await KoppelingIdAsync(activiteit.Id, K2Doelen[0]);

        using var leerkracht = Opzet.Als(await Opzet.GebruikerAsync(school, klassen: [school.K2Rood]));
        using var hlK3 = Opzet.Als(await Opzet.GebruikerAsync(school, hoofdleerkrachtVan: ["K3"]));
        foreach (var ander in new[] { leerkracht, hlK3 })
        {
            await RechtenTestOpzet.VerwachtAsync(
                ander.PostAsync($"/api/activiteiten/{activiteit.Id}/doelsuggesties/genereer", null), HttpStatusCode.Forbidden, RechtenTestOpzet.GeenToegang);
            await RechtenTestOpzet.VerwachtAsync(
                BeslisAsync(ander, activiteit.Id, koppelingId, "Aanvaard"), HttpStatusCode.Forbidden, RechtenTestOpzet.GeenToegang);
        }

        Assert.Equal(KoppelingStatus.Voorgesteld, Assert.Single(await KoppelingenAsync(activiteit.Id)).Status);
    }

    [PostgresFact]
    public async Task Bij_haar_eigen_activiteit_vraagt_en_beslist_de_leerkracht_zelf_en_de_hoofdleerkracht_niet()
    {
        var school = await Opzet.SchoolAsync();
        var themaId = await Opzet.ThemaAsync();
        var subthemaId = await Opzet.SubthemaAsync("K2", themaId);
        using var leerkracht = Opzet.Als(await Opzet.GebruikerAsync(school, klassen: [school.K2Rood]));
        using var hlK2 = Opzet.Als(await Opzet.GebruikerAsync(school, hoofdleerkrachtVan: ["K2"]));
        var eigen = await Opzet.ActiviteitAsync(subthemaId, leerkracht);
        Assert.NotNull(eigen.EigenaarId);

        _factory.AiAntwoord = Antwoord(K2Doelen[0]);
        await RechtenTestOpzet.VerwachtAsync(
            hlK2.PostAsync($"/api/activiteiten/{eigen.Id}/doelsuggesties/genereer", null), HttpStatusCode.Forbidden, RechtenTestOpzet.GeenToegang);
        await GenereerAsync(leerkracht, eigen.Id);
        var koppelingId = await KoppelingIdAsync(eigen.Id, K2Doelen[0]);
        await RechtenTestOpzet.VerwachtAsync(
            BeslisAsync(hlK2, eigen.Id, koppelingId, "Aanvaard"), HttpStatusCode.Forbidden, RechtenTestOpzet.GeenToegang);
        Assert.Equal(HttpStatusCode.NoContent, await RechtenTestOpzet.StatusAsync(BeslisAsync(leerkracht, eigen.Id, koppelingId, "Aanvaard")));

        // The hoofdleerkracht decides the subdoel it leaves at the subthema.
        var overzicht = (await hlK2.GetFromJsonAsync<Overzicht>($"/api/themas/{themaId}/subdoelplaatsing"))!;
        Assert.Equal(K2Doelen[0], Assert.Single(Assert.Single(overzicht.Leeftijden).Subdoelvoorstellen).LeerplandoelCode);
    }

    [PostgresFact]
    public async Task Alleen_een_beslist_doel_houdt_de_maker_tegen_om_te_verplaatsen_of_te_verwijderen_en_telt_in_de_bibliotheek()
    {
        var school = await Opzet.SchoolAsync();
        var themaId = await Opzet.ThemaAsync();
        var subthemaId = await Opzet.SubthemaAsync("K2", themaId);
        var ander = await Opzet.SubthemaAsync("K2");
        var maker = await Opzet.GebruikerAsync(school, klassen: [school.K2Rood]);
        using var client = Opzet.Als(maker);

        var metVoorstellen = await Opzet.GedeeldeActiviteitMetMakerAsync(subthemaId, maker);
        var metAanvaard = await Opzet.GedeeldeActiviteitMetMakerAsync(subthemaId, maker);
        await using (var context = _db.MaakContext())
        {
            var activiteiten = await context.Activiteiten.Include(a => a.Doelkoppelingen)
                .Where(a => a.Id == metVoorstellen.Id || a.Id == metAanvaard.Id).ToListAsync();
            var voorstellen = activiteiten.Single(a => a.Id == metVoorstellen.Id);
            voorstellen.StelDoelVoor(K2Doelen[0], "Past.");
            voorstellen.StelDoelVoor(K2Doelen[1], "Past.").WijzigStatus(KoppelingStatus.Geweigerd);
            activiteiten.Single(a => a.Id == metAanvaard.Id).StelDoelVoor(K2Doelen[0], "Past.").WijzigStatus(KoppelingStatus.Aanvaard);
            await context.SaveChangesAsync();
        }

        // The library counts the one accepted link, not the proposal or the rejected goal.
        using var directie = Opzet.Directie();
        var bibliotheek = await directie.GetFromJsonAsync<List<BibliotheekDto>>("/api/themas/bibliotheek");
        Assert.Equal(1, bibliotheek!.Single(t => t.Id == themaId).AantalDoelkoppelingen);

        // I19: a leerkracht of the leeftijd moves an activiteit while no decided goal is linked.
        await RechtenTestOpzet.VerwachtAsync(
            client.PutAsJsonAsync($"/api/activiteiten/{metAanvaard.Id}/subthema", new { doelSubthemaId = ander }),
            HttpStatusCode.Forbidden,
            RechtenTestOpzet.GeenToegang);
        Assert.Equal(HttpStatusCode.OK, await RechtenTestOpzet.StatusAsync(
            client.PutAsJsonAsync($"/api/activiteiten/{metVoorstellen.Id}/subthema", new { doelSubthemaId = ander })));

        await RechtenTestOpzet.VerwachtAsync(
            client.DeleteAsync($"/api/activiteiten/{metAanvaard.Id}"), HttpStatusCode.Forbidden, RechtenTestOpzet.GeenToegang);
        Assert.Equal(HttpStatusCode.NoContent, await RechtenTestOpzet.StatusAsync(client.DeleteAsync($"/api/activiteiten/{metVoorstellen.Id}")));
    }

    [PostgresFact]
    public async Task Een_geweigerd_doel_met_de_hand_koppelen_maakt_het_manueel()
    {
        var subthemaId = await Opzet.SubthemaAsync("K2");
        var activiteit = await Opzet.ActiviteitAsync(subthemaId);
        using var directie = Opzet.Directie();
        _factory.AiAntwoord = Antwoord(K2Doelen[0]);
        await GenereerAsync(directie, activiteit.Id);
        await BeslisAsync(directie, activiteit.Id, await KoppelingIdAsync(activiteit.Id, K2Doelen[0]), "Geweigerd");

        await Opzet.KoppelAsync(activiteit.Id, K2Doelen[0]);

        var koppeling = Assert.Single(await KoppelingenAsync(activiteit.Id));
        Assert.Equal((KoppelingStatus.Manueel, (string?)null), (koppeling.Status, koppeling.AiMotivatie));
        await RechtenTestOpzet.VerwachtAsync(
            directie.PostAsJsonAsync($"/api/activiteiten/{activiteit.Id}/doelkoppelingen", new { leerplandoelCode = K2Doelen[0] }),
            HttpStatusCode.BadRequest,
            $"Activiteit is al gekoppeld aan leerdoel '{K2Doelen[0]}'.");
    }

    [PostgresFact]
    public async Task Een_subdoelplaatsing_laat_een_voorstel_vanuit_een_activiteit_staan()
    {
        var themaId = await Opzet.ThemaAsync();
        var subthemaId = await Opzet.SubthemaAsync("K2", themaId);
        using var directie = Opzet.Directie();
        Assert.Equal(HttpStatusCode.OK, await RechtenTestOpzet.StatusAsync(
            directie.PostAsJsonAsync($"/api/themas/{themaId}/minimumdoelen", new { minimumdoelRef = Md })));
        var activiteit = await Opzet.ActiviteitAsync(subthemaId);
        _factory.AiAntwoord = Antwoord(K2Doelen[0]);
        await GenereerAsync(directie, activiteit.Id);
        await BeslisAsync(directie, activiteit.Id, await KoppelingIdAsync(activiteit.Id, K2Doelen[0]), "Aanvaard");

        // An FB-057 run proposes the same goal in the same subthema, and another one.
        _factory.AiAntwoord =
            $$"""
            {"plaatsingen": [
               {"code": "{{K2Doelen[0]}}", "subthema": "S1", "motivatie": "Nogmaals."},
               {"code": "{{K2Doelen[1]}}", "subthema": "S1", "motivatie": "Ook."}],
             "nieuweSubthemas": []}
            """;
        using var antwoord = await directie.PostAsync($"/api/themas/{themaId}/subdoelplaatsing/K2/genereer", null);
        Assert.Equal(HttpStatusCode.OK, antwoord.StatusCode);
        using var nogmaals = await directie.PostAsync($"/api/themas/{themaId}/subdoelplaatsing/K2/genereer", null);
        Assert.Equal(HttpStatusCode.OK, nogmaals.StatusCode);

        var overzicht = (await directie.GetFromJsonAsync<Overzicht>($"/api/themas/{themaId}/subdoelplaatsing"))!;
        var voorstellen = Assert.Single(overzicht.Leeftijden).Subdoelvoorstellen.OrderBy(v => v.LeerplandoelCode, StringComparer.Ordinal).ToList();
        Assert.Equal(
            [(K2Doelen[0], activiteit.Naam), (K2Doelen[1], (string?)null)],
            voorstellen.Select(v => (v.LeerplandoelCode, v.ActiviteitNaam)));
    }

    private sealed record Overzicht(Guid ThemaId, List<LeeftijdDto> Leeftijden);

    private sealed record LeeftijdDto(string Leeftijd, int AantalOpen, bool MagBeslissen, List<SubdoelDto> Subdoelvoorstellen);

    private sealed record SubdoelDto(Guid Id, string LeerplandoelCode, Guid? SubthemaId, string AiMotivatie, string? ActiviteitNaam);

    private sealed record Resultaat(bool IsGeslaagd, int AantalVoorgesteld, int AantalOvergeslagen, string? Fout);

    private sealed record BibliotheekDto(Guid Id, int AantalDoelkoppelingen);
}
