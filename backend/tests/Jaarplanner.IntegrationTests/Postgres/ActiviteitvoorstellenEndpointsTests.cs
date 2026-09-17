using System.Net;
using System.Net.Http.Json;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Schoolcontent;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.IntegrationTests.Postgres;

/// <summary>
/// FB-025 (ADR-0056) over HTTP against PostgreSQL: the AI's activiteit proposals under a subthema, what accepting and
/// rejecting write, that a rejected proposal does not come back, that an unreadable or invented answer stores nothing of
/// it, that proposals are the asker's alone, and who may ask. The AI is the factory's stub (Art. IV.6).
/// </summary>
public sealed class ActiviteitvoorstellenEndpointsTests : IAsyncLifetime
{
    private const string Drijven = "AVS-K3-01";
    private const string Water = "AVS-K3-02";
    private const string Vreemd = "AVS-K3-99";

    private PostgresTestDatabase _db = null!;
    private PostgresApiFactory _factory = null!;

    public async Task InitializeAsync()
    {
        if (!PostgresTestDatabase.IsBeschikbaar)
        {
            return;
        }

        _db = await PostgresTestDatabase.MaakAsync("activiteitvoorstellen");
        _factory = new PostgresApiFactory(_db.ConnectionString);

        await using var context = _db.MaakContext();
        context.Leerplandoelen.AddRange(
            Doel(Drijven, "Onderzoekt wat drijft en zinkt."),
            Doel(Water, "Beschrijft hoe water beweegt."),
            Doel(Vreemd, "Geen subdoel."));
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

    private static Leerplandoel Doel(string code, string tekst) =>
        new(code, Doelsoort.Gemeenschappelijk, "K3", "Natuur", "Water", "9.1", tekst: tekst);

    /// <summary>A K3 subthema with two subdoelen and an onderzoeksvraag, a K3 leerkracht, and her client.</summary>
    private async Task<(Guid SubthemaId, Guid LeerkrachtId, RechtenTestOpzet.School School)> OpzetAsync()
    {
        var school = await Opzet.SchoolAsync();
        var subthemaId = await Opzet.SubthemaAsync("K3");
        using var directie = Opzet.Directie();
        foreach (var code in new[] { Drijven, Water })
        {
            Assert.Equal(HttpStatusCode.OK, await RechtenTestOpzet.StatusAsync(
                directie.PostAsJsonAsync($"/api/subthemas/{subthemaId}/doelkoppelingen", new { leerplandoelCode = code })));
        }

        Assert.Equal(HttpStatusCode.Created, await RechtenTestOpzet.StatusAsync(
            directie.PostAsJsonAsync($"/api/subthemas/{subthemaId}/onderzoeksvragen", new { vraag = "Waarom blijft een boot drijven?" })));

        var leerkracht = await Opzet.GebruikerAsync(school, klassen: [school.K3Blauw]);
        return (subthemaId, leerkracht, school);
    }

    private static string Item(string naam) =>
        $$"""
        {"naam": "{{naam}}", "soort": "Experiment", "verwachteUitkomsten": "De kleuters testen voorwerpen in water.",
         "lengteInLesuren": 2, "onderzoeksvraag": "V1", "doelen": ["{{Drijven}}", "{{Water}}", "{{Vreemd}}"],
         "motivatie": "Werkt aan drijven."}
        """;

    /// <summary>The named activiteiten, and one that works on an invented code only, which is dropped.</summary>
    private static string Antwoord(params string[] namen)
    {
        var verzonnen = """
            {"naam": "Verzonnen", "soort": null, "verwachteUitkomsten": "Iets.", "lengteInLesuren": 1, "onderzoeksvraag": null,
             "doelen": ["VERZONNEN-01"], "motivatie": "Geen echt doel."}
            """;
        return $"{{\"activiteiten\": [{string.Join(",", namen.Select(Item).Append(verzonnen))}]}}";
    }

    private static async Task<List<Voorstel>> LeesAsync(HttpClient client, Guid subthemaId) =>
        (await client.GetFromJsonAsync<List<Voorstel>>($"/api/subthemas/{subthemaId}/activiteitvoorstellen"))!;

    private static async Task<Resultaat> GenereerAsync(HttpClient client, Guid subthemaId)
    {
        using var antwoord = await client.PostAsync($"/api/subthemas/{subthemaId}/activiteitvoorstellen/genereer", null);
        Assert.True(antwoord.StatusCode == HttpStatusCode.OK, await antwoord.Content.ReadAsStringAsync());
        return (await antwoord.Content.ReadFromJsonAsync<Resultaat>())!;
    }

    private static async Task<Besluit> BeslisAsync(HttpClient client, Guid voorstelId, object lichaam)
    {
        using var antwoord = await client.PutAsJsonAsync($"/api/activiteitvoorstellen/{voorstelId}/beslissing", lichaam);
        Assert.True(antwoord.StatusCode == HttpStatusCode.OK, await antwoord.Content.ReadAsStringAsync());
        return (await antwoord.Content.ReadFromJsonAsync<Besluit>())!;
    }

    [PostgresFact]
    public async Task Een_leerkracht_krijgt_voorstellen_op_de_subdoelen_en_aanvaarden_maakt_haar_eigen_activiteit()
    {
        var (subthemaId, leerkrachtId, _) = await OpzetAsync();
        using var leerkracht = Opzet.Als(leerkrachtId);
        _factory.AiAntwoord = Antwoord("Drijftafel", "Bootjesrace");

        Assert.Equal(new Resultaat(true, 2, 1, null), await GenereerAsync(leerkracht, subthemaId));

        var voorstellen = await LeesAsync(leerkracht, subthemaId);
        Assert.Equal(["Drijftafel", "Bootjesrace"], voorstellen.Select(v => v.Naam));
        var eerste = voorstellen[0];
        Assert.Equal([Drijven, Water], eerste.Doelen.Select(d => d.LeerplandoelCode));
        Assert.Equal("Onderzoekt wat drijft en zinkt.", eerste.Doelen[0].Tekst);
        Assert.Equal(("Experiment", 2, "Waarom blijft een boot drijven?"), (eerste.ActiviteitType, eerste.LengteInLesuren, eerste.Onderzoeksvraag));

        // Nothing is an activiteit before a decision.
        await using (var voor = _db.MaakContext())
        {
            Assert.False(await voor.Activiteiten.AnyAsync(a => a.SubthemaId == subthemaId));
        }

        var besluit = await BeslisAsync(leerkracht, eerste.Id, new { status = "Aanvaard" });
        Assert.Equal("Aanvaard", besluit.Status);

        // The edited form: a new name, no soort, one goal left out.
        var tweede = await BeslisAsync(leerkracht, voorstellen[1].Id, new
        {
            status = "Aanvaard",
            naam = "Bootjes laten varen",
            activiteitType = (string?)null,
            verwachteUitkomsten = "De kleuters laten bootjes varen.",
            lengteInLesuren = 1,
            leerplandoelCodes = new[] { Water },
        });
        Assert.Equal("Manueel", tweede.Status);

        await using var context = _db.MaakContext();
        var activiteiten = await context.Activiteiten.AsNoTracking()
            .Include(a => a.Doelkoppelingen)
            .Where(a => a.SubthemaId == subthemaId)
            .ToListAsync();
        var drijftafel = activiteiten.Single(a => a.Id == besluit.ActiviteitId);
        Assert.Equal((leerkrachtId, leerkrachtId, "Drijftafel", ActiviteitType.Experiment, 2), (drijftafel.EigenaarId!.Value, drijftafel.MakerId!.Value, drijftafel.Naam, drijftafel.ActiviteitType!.Value, drijftafel.LengteInLesuren));
        Assert.Equal("De kleuters testen voorwerpen in water.", drijftafel.VerwachteUitkomsten);
        Assert.NotNull(drijftafel.OnderzoeksvraagId);
        Assert.All(drijftafel.Doelkoppelingen, k => Assert.Equal((KoppelingStatus.Aanvaard, "Werkt aan drijven."), (k.Status, k.AiMotivatie)));
        Assert.Equal([Drijven, Water], drijftafel.Doelkoppelingen.Select(k => k.LeerplandoelCode).Order());

        var varen = activiteiten.Single(a => a.Id == tweede.ActiviteitId);
        Assert.Equal(("Bootjes laten varen", (ActiviteitType?)null, 1), (varen.Naam, varen.ActiviteitType, varen.LengteInLesuren));
        Assert.Equal(Water, Assert.Single(varen.Doelkoppelingen).LeerplandoelCode);

        Assert.Empty(await LeesAsync(leerkracht, subthemaId));
        await RechtenTestOpzet.VerwachtAsync(
            leerkracht.PutAsJsonAsync($"/api/activiteitvoorstellen/{eerste.Id}/beslissing", new { status = "Geweigerd" }),
            HttpStatusCode.BadRequest,
            "Over dit voorstel is al beslist. Vernieuw de pagina om te zien wat er nu staat.");
    }

    [PostgresFact]
    public async Task Een_geweigerd_voorstel_komt_niet_terug_en_een_nieuwe_vraag_vervangt_de_open_voorstellen()
    {
        var (subthemaId, leerkrachtId, _) = await OpzetAsync();
        using var leerkracht = Opzet.Als(leerkrachtId);
        _factory.AiAntwoord = Antwoord("Drijftafel", "Bootjesrace");
        await GenereerAsync(leerkracht, subthemaId);
        var voorstellen = await LeesAsync(leerkracht, subthemaId);

        Assert.Equal("Geweigerd", (await BeslisAsync(leerkracht, voorstellen[0].Id, new { status = "Geweigerd" })).Status);

        // The model repeats both names: the rejected one is dropped, the open one is replaced by its new copy.
        var tweede = await GenereerAsync(leerkracht, subthemaId);
        Assert.Equal((1, 2), (tweede.AantalVoorgesteld, tweede.AantalOvergeslagen));
        Assert.Equal("Bootjesrace", Assert.Single(await LeesAsync(leerkracht, subthemaId)).Naam);

        // A run that keeps nothing leaves the open proposal where it was.
        _factory.AiAntwoord = Antwoord();
        Assert.Equal(0, (await GenereerAsync(leerkracht, subthemaId)).AantalVoorgesteld);
        Assert.Equal("Bootjesrace", Assert.Single(await LeesAsync(leerkracht, subthemaId)).Naam);
        _factory.AiAntwoord = Antwoord("Drijftafel", "Bootjesrace");

        // An accepted activiteit's name is not proposed again either.
        await BeslisAsync(leerkracht, (await LeesAsync(leerkracht, subthemaId))[0].Id, new { status = "Aanvaard" });
        Assert.Equal(0, (await GenereerAsync(leerkracht, subthemaId)).AantalVoorgesteld);

        await using var context = _db.MaakContext();
        Assert.Equal(2, await context.Activiteitvoorstellen.CountAsync(v => v.SubthemaId == subthemaId));
    }

    [PostgresFact]
    public async Task Een_onleesbaar_antwoord_bewaart_niets_en_een_subthema_zonder_subdoelen_wordt_geweigerd()
    {
        var (subthemaId, leerkrachtId, _) = await OpzetAsync();
        using var leerkracht = Opzet.Als(leerkrachtId);
        _factory.AiAntwoord = "geen json";

        using var antwoord = await leerkracht.PostAsync($"/api/subthemas/{subthemaId}/activiteitvoorstellen/genereer", null);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, antwoord.StatusCode);

        await using var context = _db.MaakContext();
        Assert.False(await context.Activiteitvoorstellen.AnyAsync(v => v.SubthemaId == subthemaId));

        var leeg = await Opzet.SubthemaAsync("K3");
        await RechtenTestOpzet.VerwachtAsync(
            leerkracht.PostAsync($"/api/subthemas/{leeg}/activiteitvoorstellen/genereer", null),
            HttpStatusCode.BadRequest,
            "Regen heeft nog geen subdoelen. Voeg er eerst toe, dan kan de AI er activiteiten bij voorstellen.");
    }

    [PostgresFact]
    public async Task Wie_vroeg_en_de_directie_zien_en_beslissen_een_voorstel_en_alleen_wie_een_eigen_activiteit_mag_maken_vraagt()
    {
        var (subthemaId, leerkrachtId, school) = await OpzetAsync();
        using var leerkracht = Opzet.Als(leerkrachtId);
        _factory.AiAntwoord = Antwoord("Drijftafel");
        await GenereerAsync(leerkracht, subthemaId);
        var voorstel = Assert.Single(await LeesAsync(leerkracht, subthemaId));

        Assert.True(voorstel.IsEigen);

        // A K3 colleague may ask for her own, but neither sees nor decides this one.
        using var collega = Opzet.Als(await Opzet.GebruikerAsync(school, klassen: [school.K3Groen]));
        Assert.Empty(await LeesAsync(collega, subthemaId));
        await RechtenTestOpzet.VerwachtAsync(
            collega.PutAsJsonAsync($"/api/activiteitvoorstellen/{voorstel.Id}/beslissing", new { status = "Geweigerd" }),
            HttpStatusCode.Forbidden,
            RechtenTestOpzet.GeenToegang);

        // A K2 leerkracht, a K3 hoofdleerkracht without a K3 klas, and themabeheer may not ask or decide at K3.
        foreach (var ander in new[]
                 {
                     await Opzet.GebruikerAsync(school, klassen: [school.K2Rood]),
                     await Opzet.GebruikerAsync(school, hoofdleerkrachtVan: ["K3"]),
                     await Opzet.GebruikerAsync(school, themabeheer: true),
                 })
        {
            using var client = Opzet.Als(ander);
            await RechtenTestOpzet.VerwachtAsync(
                client.PostAsync($"/api/subthemas/{subthemaId}/activiteitvoorstellen/genereer", null),
                HttpStatusCode.Forbidden,
                RechtenTestOpzet.GeenToegang);
            await RechtenTestOpzet.VerwachtAsync(
                client.PutAsJsonAsync($"/api/activiteitvoorstellen/{voorstel.Id}/beslissing", new { status = "Aanvaard" }),
                HttpStatusCode.Forbidden,
                RechtenTestOpzet.GeenToegang);
        }

        // Directie sees every asker's proposals, its own first, and an acceptance makes the asker's own activiteit (A3).
        using var directie = Opzet.Als(await Opzet.GebruikerAsync(school, directie: true));
        Assert.Equal(1, (await GenereerAsync(directie, subthemaId)).AantalVoorgesteld);
        var gezien = await LeesAsync(directie, subthemaId);
        Assert.Equal([(true, "Test"), (false, "Test")], gezien.Select(v => (v.IsEigen, v.AanvragerNaam)));
        Assert.Equal(voorstel.Id, gezien[1].Id);
        Assert.Single(await LeesAsync(leerkracht, subthemaId));

        var besluit = await BeslisAsync(directie, voorstel.Id, new { status = "Aanvaard" });
        await using var context = _db.MaakContext();
        var activiteit = await context.Activiteiten.AsNoTracking().SingleAsync(a => a.Id == besluit.ActiviteitId);
        Assert.Equal((leerkrachtId, leerkrachtId), (activiteit.EigenaarId!.Value, activiteit.MakerId!.Value));
        Assert.Empty(await LeesAsync(leerkracht, subthemaId));
    }

    [PostgresFact]
    public async Task Een_doel_dat_intussen_geen_subdoel_meer_is_wordt_niet_gekoppeld()
    {
        var (subthemaId, leerkrachtId, _) = await OpzetAsync();
        using var leerkracht = Opzet.Als(leerkrachtId);
        _factory.AiAntwoord = Antwoord("Drijftafel");
        await GenereerAsync(leerkracht, subthemaId);
        var voorstel = Assert.Single(await LeesAsync(leerkracht, subthemaId));

        await using (var context = _db.MaakContext())
        {
            var subdoel = await context.Subdoelen.SingleAsync(sd => sd.SubthemaId == subthemaId && sd.Koppeling.LeerplandoelCode == Water);
            context.Subdoelen.Remove(subdoel);
            await context.SaveChangesAsync();
        }

        await RechtenTestOpzet.VerwachtAsync(
            leerkracht.PutAsJsonAsync($"/api/activiteitvoorstellen/{voorstel.Id}/beslissing", new { status = "Aanvaard" }),
            HttpStatusCode.BadRequest,
            $"{Water} is intussen geen subdoel meer van Regen. Laat het weg, of vraag nieuwe voorstellen.");
        await RechtenTestOpzet.VerwachtAsync(
            leerkracht.PutAsJsonAsync($"/api/activiteitvoorstellen/{voorstel.Id}/beslissing", new
            {
                status = "Aanvaard",
                naam = "Drijftafel",
                verwachteUitkomsten = "Testen.",
                lengteInLesuren = 1,
                leerplandoelCodes = new[] { Vreemd },
            }),
            HttpStatusCode.BadRequest,
            $"{Vreemd} hoort niet bij dit voorstel. Je kunt alleen de voorgestelde doelen houden.");

        var besluit = await BeslisAsync(leerkracht, voorstel.Id, new
        {
            status = "Aanvaard",
            naam = "Drijftafel",
            activiteitType = "Experiment",
            verwachteUitkomsten = "De kleuters testen voorwerpen in water.",
            lengteInLesuren = 2,
            leerplandoelCodes = new[] { Drijven },
        });
        Assert.Equal("Manueel", besluit.Status);
    }

    [PostgresFact]
    public async Task Een_verwijderd_subthema_neemt_de_voorstellen_mee()
    {
        var (subthemaId, leerkrachtId, _) = await OpzetAsync();
        using var leerkracht = Opzet.Als(leerkrachtId);
        _factory.AiAntwoord = Antwoord("Drijftafel");
        await GenereerAsync(leerkracht, subthemaId);

        using var directie = Opzet.Directie();
        Assert.Equal(HttpStatusCode.NoContent, await RechtenTestOpzet.StatusAsync(directie.DeleteAsync($"/api/subthemas/{subthemaId}")));

        await using var context = _db.MaakContext();
        Assert.False(await context.Activiteitvoorstellen.AnyAsync(v => v.SubthemaId == subthemaId));
    }

    private sealed record Doeldto(string LeerplandoelCode, string? Tekst);

    private sealed record Voorstel(
        Guid Id,
        string AanvragerNaam,
        bool IsEigen,
        string Naam,
        string? ActiviteitType,
        string VerwachteUitkomsten,
        int LengteInLesuren,
        string? Onderzoeksvraag,
        List<Doeldto> Doelen,
        string AiMotivatie);

    private sealed record Resultaat(bool IsGeslaagd, int AantalVoorgesteld, int AantalOvergeslagen, string? Fout);

    private sealed record Besluit(string Status, Guid? ActiviteitId);
}
