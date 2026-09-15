using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Jaarplanner.Application.Toegang;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.Domain.Toegang;
using Jaarplanner.Infrastructure.Toegang;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace Jaarplanner.IntegrationTests.Postgres;

/// <summary>
/// The rights model against real PostgreSQL (E6-02, Art. VI.1, ADR-0030): the migration, the rights read from the
/// database, the FKs that clean up after a removal, the unique indexes, <c>GET /api/ik</c>, and the one policy slice 1
/// enforces, <c>Curriculumbeheer</c>. On Postgres because the removal rules (cascade, set null) and the uniqueness are
/// database guarantees the in-memory provider does not keep.
/// </summary>
public sealed class RechtenEndpointsTests : IAsyncLifetime
{
    private const string Doelcode = "RECHT-01";

    private PostgresTestDatabase _db = null!;
    private PostgresApiFactory _factory = null!;

    public async Task InitializeAsync()
    {
        if (!PostgresTestDatabase.IsBeschikbaar)
        {
            return;
        }

        _db = await PostgresTestDatabase.MaakAsync("rechten");
        _factory = new PostgresApiFactory(_db.ConnectionString);

        await using var context = _db.MaakContext();
        context.Leerplandoelen.Add(new Leerplandoel(
            Doelcode, Doelsoort.Gemeenschappelijk, "K3", "Natuur", "Levende natuur", "9.1", tekst: "Tekst"));
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

    private static DateOnly Vandaag => DateOnly.FromDateTime(DateTime.UtcNow);

    // --- GET /api/ik carries the rights. ---

    [PostgresFact]
    public async Task Ik_draagt_de_rechten_van_de_gebruiker()
    {
        var an = await BewaarGebruikerAsync(themabeheer: true);
        var lopend = await BewaarSchooljaarAsync(Vandaag.AddDays(-30), Vandaag.AddDays(200), "K3");
        var voorbij = await BewaarSchooljaarAsync(Vandaag.AddDays(-400), Vandaag.AddDays(-35), "L4");
        await WijsToeAsync(an.Id, lopend.Klassen.Single().Id);
        await WijsToeAsync(an.Id, voorbij.Klassen.Single().Id);
        await StelAanAsync(an.Id, lopend.Id, "L2");
        await StelAanAsync(an.Id, voorbij.Id, "L6");

        using var client = _factory.MaakClientVoor(an.Id);
        using var antwoord = await client.GetAsync("/api/ik");

        Assert.Equal(HttpStatusCode.OK, antwoord.StatusCode);
        using var json = JsonDocument.Parse(await antwoord.Content.ReadAsStringAsync());
        Assert.Equal(
            [
                "eigenKlasIds", "email", "heeftLeerlingzorg", "heeftThemabeheer", "hoofdleerkrachtLeeftijden", "id", "isDirectie",
                "leerkrachtLeeftijden", "lopendeRapportklasIds", "naam", "rapportklasIds",
            ],
            json.RootElement.EnumerateObject().Select(p => p.Name).Order(StringComparer.Ordinal));

        // FB-001: the running K3 klas is a rapportklas, to read and to fill in; the ended L4 klas grants no K3 at all.
        var k3 = lopend.Klassen.Single().Id;
        Assert.Equal([k3], json.RootElement.GetProperty("rapportklasIds").EnumerateArray().Select(e => e.GetGuid()));
        Assert.Equal([k3], json.RootElement.GetProperty("lopendeRapportklasIds").EnumerateArray().Select(e => e.GetGuid()));

        var ik = json.RootElement.Deserialize<IkDto>(new JsonSerializerOptions(JsonSerializerDefaults.Web))!;
        Assert.Equal(an.Id, ik.Id);
        Assert.False(ik.IsDirectie);
        Assert.True(ik.HeeftThemabeheer);
        Assert.Equal(["L2"], ik.HoofdleerkrachtLeeftijden);
        Assert.Equal(["K3"], ik.LeerkrachtLeeftijden);
        Assert.Equal(
            new[] { lopend.Klassen.Single().Id, voorbij.Klassen.Single().Id }.Order(),
            ik.EigenKlasIds.Order());
    }

    [PostgresFact]
    public async Task Ik_van_een_directie_zegt_directie()
    {
        var directie = await BewaarGebruikerAsync(directie: true);

        using var client = _factory.MaakClientVoor(directie.Id);
        var ik = await client.GetFromJsonAsync<IkDto>("/api/ik");

        Assert.True(ik!.IsDirectie);
        Assert.Empty(ik.EigenKlasIds);
    }

    // --- Curriculumbeheer: directie only (ADR-0030 §3, Op.stap row). ---

    [PostgresFact]
    public async Task Het_curriculumbeheer_weigert_themabeheer_hoofdleerkracht_en_leerkracht()
    {
        // Everything except directie, in one gebruiker: the union rule must not add up to a right no column grants.
        var an = await BewaarGebruikerAsync(themabeheer: true);
        var lopend = await BewaarSchooljaarAsync(Vandaag.AddDays(-30), Vandaag.AddDays(200), "K3");
        await WijsToeAsync(an.Id, lopend.Klassen.Single().Id);
        await StelAanAsync(an.Id, lopend.Id, "K3");

        using var client = _factory.MaakClientVoor(an.Id);
        using var inhoud = ImportAanvraag();
        using var import = await client.PostAsync("/api/opstap-import", inhoud);
        using var stand = await client.GetAsync("/api/opstap-import/stand");

        Assert.Equal(HttpStatusCode.Forbidden, import.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, stand.StatusCode);
    }

    [PostgresFact]
    public async Task Het_curriculumbeheer_laat_een_directie_uit_de_database_door()
    {
        var directie = await BewaarGebruikerAsync(directie: true);

        using var client = _factory.MaakClientVoor(directie.Id);
        using var inhoud = ImportAanvraag();
        using var import = await client.PostAsync("/api/opstap-import", inhoud);

        // It reaches the controller, which refuses the request for having no file.
        Assert.Equal(HttpStatusCode.BadRequest, import.StatusCode);
    }

    [PostgresFact]
    public async Task Het_curriculumbeheer_weigert_wie_niet_aangemeld_is()
    {
        using var inhoud = ImportAanvraag();
        using var import = await _factory.MaakAnoniemeClient().PostAsync("/api/opstap-import", inhoud);

        Assert.Equal(HttpStatusCode.Unauthorized, import.StatusCode);
    }

    // --- The maker of an activiteit (R26), and what removing a gebruiker leaves (I17). ---

    [PostgresFact]
    public async Task Een_met_de_hand_gemaakte_activiteit_draagt_haar_maker()
    {
        var an = await BewaarBouwerAsync("K3");
        using var client = _factory.MaakClientVoor(an.Id);
        var subthemaId = await MaakSubthemaAsync(client, "K3");

        var activiteit = await MaakActiviteitAsync(client, subthemaId);

        Assert.Equal(an.Id, activiteit.MakerId);
        await using var context = _db.MaakContext();
        Assert.Equal(an.Id, (await context.Activiteiten.SingleAsync(a => a.Id == activiteit.Id)).MakerId);
    }

    [PostgresFact]
    public async Task Zonder_gebruikersrij_krijgt_een_activiteit_geen_maker()
    {
        // The default test identity has no row; the create must not fail on the FK, and must record no maker.
        using var client = _factory.CreateClient();
        var subthemaId = await MaakSubthemaAsync(client, "K3");

        var activiteit = await MaakActiviteitAsync(client, subthemaId);

        Assert.Null(activiteit.MakerId);
    }

    [PostgresFact]
    public async Task Een_gebruiker_verwijderen_maakt_zijn_activiteiten_gedeeld_en_ruimt_zijn_rechten_op()
    {
        var an = await BewaarGebruikerAsync(themabeheer: true);
        var lopend = await BewaarSchooljaarAsync(Vandaag.AddDays(-30), Vandaag.AddDays(200), "K3");
        await WijsToeAsync(an.Id, lopend.Klassen.Single().Id);
        await StelAanAsync(an.Id, lopend.Id, "K3");
        using var client = _factory.MaakClientVoor(an.Id);
        var activiteit = await MaakActiviteitAsync(client, await MaakSubthemaAsync(client, "K3"));

        await using (var verwijder = _db.MaakContext())
        {
            await verwijder.Gebruikers.Where(g => g.Id == an.Id).ExecuteDeleteAsync();
        }

        await using var context = _db.MaakContext();
        var bewaard = await context.Activiteiten.SingleAsync(a => a.Id == activiteit.Id);
        Assert.Null(bewaard.MakerId);
        Assert.False(await context.Klastoewijzingen.AnyAsync(t => t.GebruikerId == an.Id));
        Assert.False(await context.Hoofdleerkrachtaanstellingen.AnyAsync(a => a.GebruikerId == an.Id));
    }

    [PostgresFact]
    public async Task Een_klas_verwijderen_ruimt_haar_klastoewijzingen_op()
    {
        var an = await BewaarGebruikerAsync();
        var lopend = await BewaarSchooljaarAsync(Vandaag.AddDays(-30), Vandaag.AddDays(200), "K2");
        var klasId = lopend.Klassen.Single().Id;
        await WijsToeAsync(an.Id, klasId);

        await using (var verwijder = _db.MaakContext())
        {
            await verwijder.Klassen.Where(k => k.Id == klasId).ExecuteDeleteAsync();
        }

        await using var context = _db.MaakContext();
        Assert.False(await context.Klastoewijzingen.AnyAsync(t => t.KlasId == klasId));
        Assert.True(await context.Gebruikers.AnyAsync(g => g.Id == an.Id));
    }

    [PostgresFact]
    public async Task Een_schooljaar_verwijderen_ruimt_zijn_hoofdleerkrachtaanstellingen_op()
    {
        var an = await BewaarGebruikerAsync();
        var jaar = await BewaarSchooljaarAsync(Vandaag.AddDays(200), Vandaag.AddDays(500));
        var ander = await BewaarSchooljaarAsync(Vandaag.AddDays(-30), Vandaag.AddDays(190));
        await StelAanAsync(an.Id, jaar.Id, "K3");
        await StelAanAsync(an.Id, ander.Id, "L2");

        // No route deletes a schooljaar yet. A tracked removal is how a future delete (E6-03) may take the owned
        // closures with it; the appointment is not loaded, so only the database cascade can remove it.
        await using (var verwijder = _db.MaakContext())
        {
            verwijder.Schooljaren.Remove(await verwijder.Schooljaren.SingleAsync(s => s.Id == jaar.Id));
            await verwijder.SaveChangesAsync();
        }

        await using var context = _db.MaakContext();
        Assert.False(await context.Hoofdleerkrachtaanstellingen.AnyAsync(a => a.SchooljaarId == jaar.Id));
        Assert.True(await context.Hoofdleerkrachtaanstellingen.AnyAsync(a => a.SchooljaarId == ander.Id));
        Assert.True(await context.Gebruikers.AnyAsync(g => g.Id == an.Id));
    }

    // --- Uniqueness (R5, R15). ---

    [PostgresFact]
    public async Task Een_klastoewijzing_bestaat_een_keer_per_gebruiker_en_klas()
    {
        var an = await BewaarGebruikerAsync();
        var bert = await BewaarGebruikerAsync();
        var lopend = await BewaarSchooljaarAsync(Vandaag.AddDays(-30), Vandaag.AddDays(200), "L1");
        var klasId = lopend.Klassen.Single().Id;
        await WijsToeAsync(an.Id, klasId);

        // A second leerkracht on the same klas is fine (R15: a co-teacher, a duobaan).
        await WijsToeAsync(bert.Id, klasId);
        await Assert.ThrowsAsync<DbUpdateException>(() => WijsToeAsync(an.Id, klasId));
    }

    [PostgresFact]
    public async Task Meerdere_hoofdleerkrachten_per_jaarfase_maar_een_aanstelling_per_gebruiker()
    {
        var an = await BewaarGebruikerAsync();
        var bert = await BewaarGebruikerAsync();
        var lopend = await BewaarSchooljaarAsync(Vandaag.AddDays(-30), Vandaag.AddDays(200));

        await StelAanAsync(an.Id, lopend.Id, "K3");
        await StelAanAsync(bert.Id, lopend.Id, "K3");
        await StelAanAsync(an.Id, lopend.Id, "K2");
        await Assert.ThrowsAsync<DbUpdateException>(() => StelAanAsync(an.Id, lopend.Id, "K3"));
    }

    // --- The rights service on the database, with the school's clock. ---

    [PostgresFact]
    public async Task Een_aanstelling_telt_tot_middernacht_Belgische_tijd_op_de_laatste_schooldag()
    {
        var an = await BewaarGebruikerAsync();
        var jaar = await BewaarSchooljaarAsync(new DateOnly(2026, 9, 1), new DateOnly(2027, 6, 30), "L2");
        await StelAanAsync(an.Id, jaar.Id, "K3");
        await WijsToeAsync(an.Id, jaar.Klassen.Single().Id);

        // 30 June 23:59 in Brussels (summer time, UTC+2).
        var laatsteMinuut = await RechtenOpAsync(an.Id, new DateTimeOffset(2027, 6, 30, 21, 59, 0, TimeSpan.Zero));
        // 1 July 00:30 in Brussels, while it is still 30 June in UTC: a UTC "today" would wrongly still count it.
        var naMiddernacht = await RechtenOpAsync(an.Id, new DateTimeOffset(2027, 6, 30, 22, 30, 0, TimeSpan.Zero));

        Assert.Equal(["K3"], laatsteMinuut.HoofdleerkrachtLeeftijden);
        Assert.Equal(["L2"], laatsteMinuut.LeerkrachtLeeftijden);
        Assert.Empty(naMiddernacht.HoofdleerkrachtLeeftijden);
        Assert.Empty(naMiddernacht.LeerkrachtLeeftijden);
        Assert.Equal([jaar.Klassen.Single().Id], naMiddernacht.EigenKlasIds);
    }

    [PostgresFact]
    public async Task Een_klas_zonder_gestelde_jaarfase_geeft_uit_de_database_geen_leeftijd()
    {
        // Only a legacy row can hold no jaarfase (the domain refuses it now), so the row is altered underneath.
        var an = await BewaarGebruikerAsync();
        var lopend = await BewaarSchooljaarAsync(Vandaag.AddDays(-30), Vandaag.AddDays(200), "K3");
        var klasId = lopend.Klassen.Single().Id;
        await WijsToeAsync(an.Id, klasId);
        await using (var context = _db.MaakContext())
        {
            await context.Klassen.Where(k => k.Id == klasId)
                .ExecuteUpdateAsync(zet => zet.SetProperty(k => k.Jaarfase, (string?)null));
        }

        var rechten = await RechtenOpAsync(an.Id, DateTimeOffset.UtcNow);

        Assert.Empty(rechten.LeerkrachtLeeftijden);
        Assert.Equal([klasId], rechten.EigenKlasIds);
    }

    [PostgresFact]
    public async Task Een_gebruiker_die_niet_bestaat_heeft_geen_rechten()
    {
        var niemand = Guid.NewGuid();

        var rechten = await RechtenOpAsync(niemand, DateTimeOffset.UtcNow);

        Assert.False(rechten.IsDirectie);
        Assert.Empty(rechten.EigenKlasIds);
        Assert.Equal(niemand, rechten.GebruikerId);
    }

    // --- The resources slice 3 will authorise against. ---

    [PostgresFact]
    public async Task De_rechtenbronnen_geven_leeftijd_maker_en_of_er_een_doel_aan_hangt()
    {
        var an = await BewaarBouwerAsync("L3");
        using var client = _factory.MaakClientVoor(an.Id);
        var subthemaId = await MaakSubthemaAsync(client, "L3");
        var zonder = await MaakActiviteitAsync(client, subthemaId);
        var met = await MaakActiviteitAsync(client, subthemaId);
        using (var koppel = await client.PostAsJsonAsync($"/api/activiteiten/{met.Id}/doelkoppelingen", new { leerplandoelCode = Doelcode }))
        {
            Assert.Equal(HttpStatusCode.OK, koppel.StatusCode);
        }

        await using var context = _db.MaakContext();
        var bronnen = new EfRechtenbronnen(context, TimeProvider.System);

        Assert.Equal(new Leeftijdsinhoud("L3"), await bronnen.VoorSubthemaAsync(subthemaId));
        Assert.Null(await bronnen.VoorSubthemaAsync(Guid.NewGuid()));
        Assert.Equal(new Activiteitbron(zonder.Id, "L3", an.Id, false), await bronnen.VoorActiviteitAsync(zonder.Id));
        Assert.Equal(new Activiteitbron(met.Id, "L3", an.Id, true), await bronnen.VoorActiviteitAsync(met.Id));
        Assert.Null(await bronnen.VoorActiviteitAsync(Guid.NewGuid()));
    }

    // --- Seeding. ---

    private async Task<Rechten> RechtenOpAsync(Guid gebruikerId, DateTimeOffset nu)
    {
        await using var context = _db.MaakContext();
        return await new RechtenService(context, new VasteTijd(nu), NullLogger<RechtenService>.Instance)
            .HaalRechtenOpAsync(gebruikerId);
    }

    private async Task<Gebruiker> BewaarGebruikerAsync(bool directie = false, bool themabeheer = false)
    {
        var gebruiker = new Gebruiker($"{Guid.NewGuid():N}@school.be", "Test", isDirectie: directie);
        if (themabeheer)
        {
            gebruiker.GeefThemabeheer();
        }

        await using var context = _db.MaakContext();
        context.Gebruikers.Add(gebruiker);
        await context.SaveChangesAsync();
        return gebruiker;
    }

    /// <summary>
    /// A gebruiker who may build content at <paramref name="leeftijd"/> by hand since slice 3 enforces the matrix:
    /// themabeheer for the thema, and the hoofdleerkracht right of that leeftijd for the subthema, its activiteiten and
    /// their goal links.
    /// </summary>
    private async Task<Gebruiker> BewaarBouwerAsync(string leeftijd)
    {
        var gebruiker = await BewaarGebruikerAsync(themabeheer: true);
        var jaar = await BewaarSchooljaarAsync(Vandaag.AddDays(-30), Vandaag.AddDays(200));
        await StelAanAsync(gebruiker.Id, jaar.Id, leeftijd);
        return gebruiker;
    }

    private async Task<Schooljaar> BewaarSchooljaarAsync(DateOnly start, DateOnly eind, params string[] klasJaarfasen)
    {
        var schooljaar = new Schooljaar(TestSchooljaar.UniekeNaam("rechten"), start, eind);
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
        var thema = await themaAntwoord.Content.ReadFromJsonAsync<IdDto>();

        using var subthemaAntwoord = await client.PostAsJsonAsync(
            $"/api/themas/{thema!.Id}/subthemas", new { naam = "Regen", duurWeken = 2, leeftijd });
        Assert.Equal(HttpStatusCode.Created, subthemaAntwoord.StatusCode);
        return (await subthemaAntwoord.Content.ReadFromJsonAsync<IdDto>())!.Id;
    }

    private static async Task<ActiviteitDto> MaakActiviteitAsync(HttpClient client, Guid subthemaId)
    {
        using var antwoord = await client.PostAsJsonAsync(
            $"/api/subthemas/{subthemaId}/activiteiten",
            new { naam = $"Proef {Guid.NewGuid():N}", activiteitType = nameof(ActiviteitType.Experiment) });
        Assert.Equal(HttpStatusCode.Created, antwoord.StatusCode);
        return (await antwoord.Content.ReadFromJsonAsync<ActiviteitDto>())!;
    }

    private static MultipartFormDataContent ImportAanvraag()
    {
        var inhoud = new MultipartFormDataContent();
        inhoud.Add(new StringContent("2"), "disciplineNummer");
        return inhoud;
    }

    private sealed record IdDto(Guid Id);

    private sealed record ActiviteitDto(Guid Id, Guid? MakerId);

    private sealed record IkDto(
        Guid Id,
        string Naam,
        string Email,
        bool IsDirectie,
        bool HeeftThemabeheer,
        string[] HoofdleerkrachtLeeftijden,
        string[] LeerkrachtLeeftijden,
        Guid[] EigenKlasIds);

    private sealed class VasteTijd : TimeProvider
    {
        private readonly DateTimeOffset _nu;

        public VasteTijd(DateTimeOffset nu) => _nu = nu;

        public override DateTimeOffset GetUtcNow() => _nu;
    }
}
