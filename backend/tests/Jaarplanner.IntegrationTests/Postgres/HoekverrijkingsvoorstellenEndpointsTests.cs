using System.Net;
using System.Net.Http.Json;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Schoolcontent;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.IntegrationTests.Postgres;

/// <summary>
/// FB-028 (ADR-0070) over HTTP against PostgreSQL: the AI proposes a verrijking per hoek for a running subthema, and
/// whoever may plan the klas takes it over, changes it or rejects it. The AI is the factory's stub (Art. IV.6).
/// </summary>
public sealed class HoekverrijkingsvoorstellenEndpointsTests : IAsyncLifetime
{
    private const string Blad = "HVV-K3-01";

    private PostgresTestDatabase _db = null!;
    private PostgresApiFactory _factory = null!;

    public async Task InitializeAsync()
    {
        if (!PostgresTestDatabase.IsBeschikbaar)
        {
            return;
        }

        _db = await PostgresTestDatabase.MaakAsync("hoekverrijkingsvoorstellen");
        _factory = new PostgresApiFactory(_db.ConnectionString);

        await using var context = _db.MaakContext();
        context.Leerplandoelen.Add(
            new Leerplandoel(Blad, Doelsoort.Gemeenschappelijk, "K3", "Natuur", "Planten", "9.1", tekst: "Onderzoekt hoe bladeren vallen."));
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

    /// <summary>
    /// A K3 subthema with a subdoel, two hoeken of K3 blauw (the boekenhoek already enriched for it), the klas's
    /// leerkracht, and a colleague of K3 groen, who reads K3 blauw's agenda but may not plan it.
    /// </summary>
    private async Task<Opzetting> OpzetAsync()
    {
        var school = await Opzet.SchoolAsync();
        var subthemaId = await Opzet.SubthemaAsync("K3");
        using (var admin = Opzet.Admin())
        {
            Assert.Equal(HttpStatusCode.OK, await RechtenTestOpzet.StatusAsync(
                admin.PostAsJsonAsync($"/api/subthemas/{subthemaId}/doelkoppelingen", new { leerplandoelCode = Blad })));
        }

        Guid boeken;
        Guid bouwen;
        await using (var context = _db.MaakContext())
        {
            var boekenhoek = new Hoek(school.K3Blauw, "boekenhoek", "Een zetel en een rek prentenboeken.");
            var bouwhoek = new Hoek(school.K3Blauw, "bouwhoek");
            context.Hoeken.AddRange(boekenhoek, bouwhoek);
            await context.SaveChangesAsync();
            (boeken, bouwen) = (boekenhoek.Id, bouwhoek.Id);
        }

        var leerkracht = await Opzet.GebruikerAsync(school, klassen: [school.K3Blauw]);
        var collega = await Opzet.GebruikerAsync(school, klassen: [school.K3Groen]);

        using (var klas = Opzet.Als(leerkracht))
        {
            (await klas.PutAsJsonAsync($"/api/klassen/{school.K3Blauw}/hoekverrijkingen", new
            {
                subthemaId,
                van = "2026-10-05",
                tot = "2026-10-16",
                verrijkingen = new[] { new { hoekId = boeken, tekst = "prentenboeken over de herfst" } },
            })).EnsureSuccessStatusCode();
        }

        return new Opzetting(school.K3Blauw, subthemaId, boeken, bouwen, leerkracht, collega);
    }

    private static string Antwoord(string tekst) =>
        $$"""{"verrijking": "{{tekst}}", "motivatie": "Past bij vallende bladeren."}""";

    private static async Task<Resultaat> VraagAsync(HttpClient client, Opzetting o, Guid hoekId)
    {
        using var antwoord = await client.PostAsJsonAsync(
            $"/api/klassen/{o.KlasId}/hoeken/{hoekId}/verrijkingsvoorstel", new { subthemaId = o.SubthemaId });
        Assert.True(antwoord.StatusCode == HttpStatusCode.OK, await antwoord.Content.ReadAsStringAsync());
        return (await antwoord.Content.ReadFromJsonAsync<Resultaat>())!;
    }

    private static async Task<List<Voorstel>> LeesAsync(HttpClient client, Guid klasId) =>
        (await client.GetFromJsonAsync<List<Voorstel>>($"/api/klassen/{klasId}/hoekverrijkingsvoorstellen"))!;

    private static async Task<Besluit> BeslisAsync(HttpClient client, Guid klasId, Guid voorstelId, object lichaam)
    {
        using var antwoord = await client.PutAsJsonAsync($"/api/klassen/{klasId}/hoekverrijkingsvoorstellen/{voorstelId}/beslissing", lichaam);
        Assert.True(antwoord.StatusCode == HttpStatusCode.OK, await antwoord.Content.ReadAsStringAsync());
        return (await antwoord.Content.ReadFromJsonAsync<Besluit>())!;
    }

    private async Task<string?> VerrijkingAsync(Guid hoekId)
    {
        await using var context = _db.MaakContext();
        return await context.Hoekverrijkingen.Where(v => v.HoekId == hoekId).Select(v => v.Tekst).SingleOrDefaultAsync();
    }

    [PostgresFact]
    public async Task Per_hoek_een_voorstel_met_motivatie_en_overnemen_zet_het_als_verrijking()
    {
        var o = await OpzetAsync();
        using var leerkracht = Opzet.Als(o.Leerkracht);

        _factory.AiAntwoord = Antwoord("Takken, bladeren en een vergrootglas.");
        var resultaat = await VraagAsync(leerkracht, o, o.Bouwhoek);
        Assert.Equal(("Takken, bladeren en een vergrootglas.", "Past bij vallende bladeren."), (resultaat.Voorstel!.Tekst, resultaat.Voorstel.AiMotivatie));

        // The prompt holds the corner, the subthema and its subdoel's text, never its code, and no gebruiker.
        var verzoek = _factory.LaatsteAiVerzoek!.UserPrompt;
        Assert.Contains("bouwhoek", verzoek);
        Assert.Contains("Onderzoekt hoe bladeren vallen.", verzoek);
        Assert.DoesNotContain(Blad, verzoek);

        // Nothing is a verrijking before a decision.
        Assert.Null(await VerrijkingAsync(o.Bouwhoek));

        var voorstel = Assert.Single(await LeesAsync(leerkracht, o.KlasId));
        var besluit = await BeslisAsync(leerkracht, o.KlasId, voorstel.Id, new
        {
            status = "Aanvaard",
            subthemaId = o.SubthemaId,
            van = "2026-10-05",
            tot = "2026-10-16",
        });

        Assert.Equal("Aanvaard", besluit.Status);
        Assert.Equal("Takken, bladeren en een vergrootglas.", await VerrijkingAsync(o.Bouwhoek));
        Assert.Empty(await LeesAsync(leerkracht, o.KlasId));
    }

    [PostgresFact]
    public async Task Een_bestaande_verrijking_blijft_tot_ze_het_voorstel_overneemt_en_aangepast_is_manueel()
    {
        var o = await OpzetAsync();
        using var leerkracht = Opzet.Als(o.Leerkracht);
        _factory.AiAntwoord = Antwoord("Boeken over egels en eekhoorns.");

        var voorstel = (await VraagAsync(leerkracht, o, o.Boekenhoek)).Voorstel!;
        Assert.Equal("prentenboeken over de herfst", await VerrijkingAsync(o.Boekenhoek));
        Assert.Contains("prentenboeken over de herfst", _factory.LaatsteAiVerzoek!.UserPrompt);

        // Taken over with a word changed, into the window the agenda already stored.
        var periode = (await leerkracht.GetFromJsonAsync<List<PeriodeDto>>(
            $"/api/klassen/{o.KlasId}/hoekverrijkingen?van=2026-10-05&tot=2026-10-16"))!.Single();
        var besluit = await BeslisAsync(leerkracht, o.KlasId, voorstel.Id, new
        {
            status = "Aanvaard",
            tekst = "Boeken over egels.",
            subthemaperiodeId = periode.SubthemaperiodeId,
        });

        Assert.Equal("Manueel", besluit.Status);
        Assert.Equal("Boeken over egels.", await VerrijkingAsync(o.Boekenhoek));
    }

    [PostgresFact]
    public async Task Weigeren_verandert_de_verrijking_niet_en_het_geweigerde_komt_niet_terug()
    {
        var o = await OpzetAsync();
        using var leerkracht = Opzet.Als(o.Leerkracht);
        _factory.AiAntwoord = Antwoord("Kastanjes om mee te bouwen.");

        var voorstel = (await VraagAsync(leerkracht, o, o.Boekenhoek)).Voorstel!;
        Assert.Equal("Geweigerd", (await BeslisAsync(leerkracht, o.KlasId, voorstel.Id, new { status = "Geweigerd" })).Status);
        Assert.Equal("prentenboeken over de herfst", await VerrijkingAsync(o.Boekenhoek));

        // The model repeats the rejected text: it is told not to, and kept out when it does.
        var opnieuw = await VraagAsync(leerkracht, o, o.Boekenhoek);
        Assert.Null(opnieuw.Voorstel);
        Assert.Contains("Kastanjes om mee te bouwen.", _factory.LaatsteAiVerzoek!.UserPrompt);
        Assert.Empty(await LeesAsync(leerkracht, o.KlasId));

        await RechtenTestOpzet.VerwachtAsync(
            leerkracht.PutAsJsonAsync($"/api/klassen/{o.KlasId}/hoekverrijkingsvoorstellen/{voorstel.Id}/beslissing", new { status = "Geweigerd" }),
            HttpStatusCode.BadRequest,
            "Over dit voorstel is al beslist. Vernieuw de pagina om te zien wat er nu staat.");

        await using var context = _db.MaakContext();
        Assert.Equal(KoppelingStatus.Geweigerd, (await context.Hoekverrijkingsvoorstellen.SingleAsync()).Status);
    }

    [PostgresFact]
    public async Task Een_nieuwe_vraag_vervangt_het_open_voorstel_en_een_onleesbaar_antwoord_bewaart_niets()
    {
        var o = await OpzetAsync();
        using var leerkracht = Opzet.Als(o.Leerkracht);
        _factory.AiAntwoord = Antwoord("Eerste idee.");
        await VraagAsync(leerkracht, o, o.Bouwhoek);
        _factory.AiAntwoord = Antwoord("Tweede idee.");
        await VraagAsync(leerkracht, o, o.Bouwhoek);
        Assert.Equal("Tweede idee.", Assert.Single(await LeesAsync(leerkracht, o.KlasId)).Tekst);

        _factory.AiAntwoord = "geen json";
        using var antwoord = await leerkracht.PostAsJsonAsync(
            $"/api/klassen/{o.KlasId}/hoeken/{o.Bouwhoek}/verrijkingsvoorstel", new { subthemaId = o.SubthemaId });
        Assert.Equal(HttpStatusCode.UnprocessableEntity, antwoord.StatusCode);
        Assert.Equal("Tweede idee.", Assert.Single(await LeesAsync(leerkracht, o.KlasId)).Tekst);
    }

    [PostgresFact]
    public async Task Alleen_wie_de_klas_mag_plannen_vraagt_ziet_en_beslist_en_admin_ook()
    {
        var o = await OpzetAsync();
        _factory.AiAntwoord = Antwoord("Bladeren op de lichttafel.");
        using var leerkracht = Opzet.Als(o.Leerkracht);
        var voorstel = (await VraagAsync(leerkracht, o, o.Bouwhoek)).Voorstel!;

        // The colleague reads K3 blauw's agenda (same jaarfase, ADR-0040) but may not plan it.
        using var collega = Opzet.Als(o.Collega);
        Assert.Equal(HttpStatusCode.Forbidden, await RechtenTestOpzet.StatusAsync(
            collega.GetAsync($"/api/klassen/{o.KlasId}/hoekverrijkingsvoorstellen")));
        Assert.Equal(HttpStatusCode.Forbidden, await RechtenTestOpzet.StatusAsync(
            collega.PostAsJsonAsync($"/api/klassen/{o.KlasId}/hoeken/{o.Bouwhoek}/verrijkingsvoorstel", new { subthemaId = o.SubthemaId })));
        Assert.Equal(HttpStatusCode.Forbidden, await RechtenTestOpzet.StatusAsync(
            collega.PutAsJsonAsync($"/api/klassen/{o.KlasId}/hoekverrijkingsvoorstellen/{voorstel.Id}/beslissing", new { status = "Geweigerd" })));

        // A proposal is the klas's: admin sees it and decides it.
        using var admin = Opzet.Admin();
        Assert.Equal(voorstel.Id, Assert.Single(await LeesAsync(admin, o.KlasId)).Id);
        Assert.Equal("Geweigerd", (await BeslisAsync(admin, o.KlasId, voorstel.Id, new { status = "Geweigerd" })).Status);
    }

    [PostgresFact]
    public async Task Een_hoek_van_een_andere_klas_is_een_nederlandse_400_en_vraagt_de_ai_niets()
    {
        var o = await OpzetAsync();
        using var leerkracht = Opzet.Als(o.Leerkracht);
        _factory.AiAntwoord = null;

        Guid vreemd;
        await using (var context = _db.MaakContext())
        {
            var andereKlas = await context.Hoeken.Where(h => h.Id == o.Boekenhoek).Select(h => h.KlasId).SingleAsync();
            var anderKlasId = await context.Klassen.Where(k => k.Id != andereKlas).Select(k => k.Id).FirstAsync();
            var hoek = new Hoek(anderKlasId, "zandtafel");
            context.Hoeken.Add(hoek);
            await context.SaveChangesAsync();
            vreemd = hoek.Id;
        }

        await RechtenTestOpzet.VerwachtAsync(
            leerkracht.PostAsJsonAsync($"/api/klassen/{o.KlasId}/hoeken/{vreemd}/verrijkingsvoorstel", new { subthemaId = o.SubthemaId }),
            HttpStatusCode.BadRequest,
            "Die hoek hoort bij een andere klas.");
    }

    [PostgresFact]
    public async Task Een_voorstel_gaat_mee_weg_met_zijn_hoek()
    {
        var o = await OpzetAsync();
        using var leerkracht = Opzet.Als(o.Leerkracht);
        _factory.AiAntwoord = Antwoord("Blokken en boomschors.");
        await VraagAsync(leerkracht, o, o.Bouwhoek);

        using var admin = Opzet.Admin();
        (await admin.DeleteAsync($"/api/hoeken/{o.Bouwhoek}")).EnsureSuccessStatusCode();

        await using var context = _db.MaakContext();
        Assert.Empty(await context.Hoekverrijkingsvoorstellen.ToListAsync());
    }

    private sealed record Opzetting(Guid KlasId, Guid SubthemaId, Guid Boekenhoek, Guid Bouwhoek, Guid Leerkracht, Guid Collega);

    private sealed record Voorstel(Guid Id, Guid HoekId, Guid SubthemaId, string Tekst, string AiMotivatie);

    private sealed record Resultaat(bool IsGeslaagd, Voorstel? Voorstel, string? Fout);

    private sealed record Besluit(string Status);

    private sealed record PeriodeDto(Guid SubthemaperiodeId);
}
