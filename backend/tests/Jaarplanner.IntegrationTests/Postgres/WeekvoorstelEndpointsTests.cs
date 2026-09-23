using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Jaarplanner.IntegrationTests.Postgres;

/// <summary>
/// FB-027 (ADR-0067) end to end against PostgreSQL: a leerkracht asks the AI to propose her week, the tool fits its
/// picks into the free time as open proposals, and only an accepted one counts for the dekking. Only the AI is the
/// factory's stub (Art. IV.6).
/// </summary>
public sealed class WeekvoorstelEndpointsTests : IAsyncLifetime
{
    private const string Doel = "WV-K3-01";

    private static readonly JsonSerializerOptions Json =
        new(JsonSerializerDefaults.Web) { Converters = { new JsonStringEnumConverter() } };

    private static readonly DateOnly Vandaag = DateOnly.FromDateTime(DateTime.UtcNow);

    /// <summary>Next week's Monday: every day of that week is still ahead (ADR-0067 D2).</summary>
    private static readonly DateOnly Maandag = Vandaag.AddDays(7 - (((int)Vandaag.DayOfWeek + 6) % 7));

    private static readonly DateOnly Vrijdag = Maandag.AddDays(4);

    private PostgresTestDatabase _db = null!;
    private PostgresApiFactory _factory = null!;

    public async Task InitializeAsync()
    {
        if (!PostgresTestDatabase.IsBeschikbaar)
        {
            return;
        }

        _db = await PostgresTestDatabase.MaakAsync("weekvoorstel");
        _factory = new PostgresApiFactory(_db.ConnectionString);
        await RechtenTestOpzet.ZaaiDoelAsync(_db, Doel);
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
    public async Task Het_voorstel_staat_als_voorgestelde_blokken_binnen_de_schooluren_en_telt_nog_niet_mee()
    {
        var opzet = await OpzetAsync();
        using var leerkracht = Opzet.Als(opzet.LeerkrachtId);
        _factory.AiAntwoord = Antwoord(("A1", Maandag), ("A2", Maandag), ("A3", Dinsdag), ("A9", Dinsdag));

        var resultaat = await StelVoorAsync(leerkracht, opzet.KlasId);

        Assert.Equal(3, resultaat.AantalVoorgesteld);
        Assert.Equal(1, resultaat.AantalOvergeslagen);

        // W3: her own activiteit and the shared ones are candidates; a colleague's own is not.
        var prompt = _factory.LaatsteAiVerzoek!.UserPrompt;
        Assert.Contains(opzet.EigenNaam, prompt, StringComparison.Ordinal);
        Assert.DoesNotContain(opzet.VanCollegaNaam, prompt, StringComparison.Ordinal);

        var blokken = await BlokkenAsync(leerkracht, opzet.KlasId);
        Assert.Equal(3, blokken.Count(b => b.Status == "Voorgesteld"));
        foreach (var blok in blokken.Where(b => b.Status == "Voorgesteld"))
        {
            Assert.False(string.IsNullOrWhiteSpace(blok.AiMotivatie));
            Assert.True(blok.Begin >= new TimeOnly(8, 30) && blok.Einde <= new TimeOnly(15, 30), $"{blok.Begin}-{blok.Einde}");
            Assert.True(blok.Einde <= new TimeOnly(12, 0) || blok.Begin >= new TimeOnly(13, 15), $"{blok.Begin}-{blok.Einde} in de pauze");
        }

        // The block she planned by hand on Monday morning stays where it was, and nothing is proposed over it.
        var handmatig = Assert.Single(blokken, b => b.Status == "Manueel");
        Assert.Equal(new TimeOnly(8, 30), handmatig.Begin);
        Assert.DoesNotContain(blokken, b => b.Datum == Maandag && b.Status == "Voorgesteld" && b.Begin < handmatig.Einde);

        // W4, Art. V.1: an open proposal of her own activiteit counts for nothing yet.
        Assert.False(await IsGedektAsync(leerkracht, opzet.KlasId));

        // FB-076: an open proposal is not "al ingepland".
        var ingepland = await leerkracht.GetFromJsonAsync<Ingepland>($"/api/klassen/{opzet.KlasId}/jaarplan/activiteitplaatsingen", Json);
        Assert.Equal([handmatig.ActiviteitId], ingepland!.Activiteiten.Select(a => a.ActiviteitId).ToList());
    }

    [PostgresFact]
    public async Task Aanvaarden_plant_het_blok_weigeren_haalt_het_weg_en_opnieuw_vragen_laat_het_aanvaarde_staan()
    {
        var opzet = await OpzetAsync();
        using var leerkracht = Opzet.Als(opzet.LeerkrachtId);
        _factory.AiAntwoord = Antwoord(("A1", Dinsdag), ("A2", Woensdag), ("A3", Donderdag));
        await StelVoorAsync(leerkracht, opzet.KlasId);

        var voorstellen = (await BlokkenAsync(leerkracht, opzet.KlasId)).Where(b => b.Status == "Voorgesteld").ToList();
        var eigen = Assert.Single(voorstellen, b => b.ActiviteitId == opzet.EigenId);
        var weg = voorstellen.First(b => b.ActiviteitId != opzet.EigenId);

        await BeslisAsync(leerkracht, opzet.KlasId, eigen.PlaatsingId, aanvaard: true);
        await BeslisAsync(leerkracht, opzet.KlasId, weg.PlaatsingId, aanvaard: false);

        var na = await BlokkenAsync(leerkracht, opzet.KlasId);
        Assert.Equal("Aanvaard", Assert.Single(na, b => b.PlaatsingId == eigen.PlaatsingId).Status);
        Assert.DoesNotContain(na, b => b.PlaatsingId == weg.PlaatsingId);

        // Accepted, her own activiteit now counts (Art. V.1).
        Assert.True(await IsGedektAsync(leerkracht, opzet.KlasId));

        // W5: asking again replaces the open proposal that is left, and leaves the accepted and the manual block.
        var nogOpen = na.Single(b => b.Status == "Voorgesteld");
        _factory.AiAntwoord = Antwoord(("A1", Vrijdag));
        await StelVoorAsync(leerkracht, opzet.KlasId);

        var daarna = await BlokkenAsync(leerkracht, opzet.KlasId);
        Assert.Contains(daarna, b => b.PlaatsingId == eigen.PlaatsingId && b.Status == "Aanvaard");
        Assert.Contains(daarna, b => b.Status == "Manueel");
        Assert.DoesNotContain(daarna, b => b.PlaatsingId == nogOpen.PlaatsingId);
        Assert.Single(daarna, b => b.Status == "Voorgesteld");

        // A decided block is no proposal to decide again.
        await RechtenTestOpzet.VerwachtAsync(
            leerkracht.PutAsJsonAsync($"/api/klassen/{opzet.KlasId}/jaarplan/weekplanning/{eigen.PlaatsingId}/beslissing", new { aanvaard = true }),
            HttpStatusCode.BadRequest,
            "Over dit voorstel is al beslist. Vernieuw de pagina om te zien wat er nu staat.");
    }

    [PostgresFact]
    public async Task Alles_aanvaarden_aanvaardt_de_open_voorstellen_van_de_week()
    {
        var opzet = await OpzetAsync();
        using var leerkracht = Opzet.Als(opzet.LeerkrachtId);
        _factory.AiAntwoord = Antwoord(("A1", Dinsdag), ("A2", Woensdag));
        await StelVoorAsync(leerkracht, opzet.KlasId);

        using var antwoord = await leerkracht.PostAsJsonAsync(
            $"/api/klassen/{opzet.KlasId}/jaarplan/weekvoorstel/aanvaard", new { van = Maandag, tot = Vrijdag });
        Assert.True(antwoord.StatusCode == HttpStatusCode.OK, await antwoord.Content.ReadAsStringAsync());

        var blokken = await BlokkenAsync(leerkracht, opzet.KlasId);
        Assert.DoesNotContain(blokken, b => b.Status == "Voorgesteld");
        Assert.Equal(2, blokken.Count(b => b.Status == "Aanvaard"));
    }

    [PostgresFact]
    public async Task Een_verplaatst_voorstel_wordt_haar_eigen_planning()
    {
        var opzet = await OpzetAsync();
        using var leerkracht = Opzet.Als(opzet.LeerkrachtId);
        _factory.AiAntwoord = Antwoord(("A1", Dinsdag));
        await StelVoorAsync(leerkracht, opzet.KlasId);
        var voorstel = Assert.Single(await BlokkenAsync(leerkracht, opzet.KlasId), b => b.Status == "Voorgesteld");

        using var antwoord = await leerkracht.PutAsJsonAsync(
            $"/api/klassen/{opzet.KlasId}/jaarplan/weekplanning/{voorstel.PlaatsingId}/dag",
            new { datum = Woensdag, begin = new TimeOnly(10, 0), einde = new TimeOnly(10, 50) });
        Assert.True(antwoord.StatusCode == HttpStatusCode.OK, await antwoord.Content.ReadAsStringAsync());

        var verplaatst = Assert.Single(await BlokkenAsync(leerkracht, opzet.KlasId), b => b.PlaatsingId == voorstel.PlaatsingId);
        Assert.Equal("Manueel", verplaatst.Status);
        Assert.Null(verplaatst.AiMotivatie);
    }

    [PostgresFact]
    public async Task Alleen_wie_de_planning_van_de_klas_bewerkt_vraagt_en_beslist()
    {
        var opzet = await OpzetAsync();
        _factory.AiAntwoord = Antwoord(("A1", Dinsdag));

        // A leerkracht of another K3 klas reads this klas (ADR-0040) but does not edit its planning.
        var ander = await Opzet.GebruikerAsync(opzet.School, klassen: [opzet.School.K3Groen]);
        using var anderClient = Opzet.Als(ander);
        Assert.Equal(HttpStatusCode.Forbidden, await RechtenTestOpzet.StatusAsync(
            anderClient.PostAsJsonAsync($"/api/klassen/{opzet.KlasId}/jaarplan/weekvoorstel", new { datum = Maandag })));

        // A co-teacher of the klas may ask, but her colleague's own activiteit is proposed only to its owner (W3), and
        // she does not accept a proposal of it (W6).
        var collega = await Opzet.GebruikerAsync(opzet.School, klassen: [opzet.KlasId]);
        using var collegaClient = Opzet.Als(collega);
        using var leerkracht = Opzet.Als(opzet.LeerkrachtId);
        _factory.AiAntwoord = Antwoord(("A1", Dinsdag), ("A2", Dinsdag), ("A3", Dinsdag));
        await StelVoorAsync(leerkracht, opzet.KlasId);
        var eigen = Assert.Single(await BlokkenAsync(leerkracht, opzet.KlasId), b => b.ActiviteitId == opzet.EigenId);

        await RechtenTestOpzet.VerwachtAsync(
            collegaClient.PutAsJsonAsync($"/api/klassen/{opzet.KlasId}/jaarplan/weekplanning/{eigen.PlaatsingId}/beslissing", new { aanvaard = true }),
            HttpStatusCode.BadRequest,
            "Dit voorstel is een eigen activiteit van een collega. Alleen zij of een admin kan het aanvaarden.");
    }

    [PostgresFact]
    public async Task Een_week_zonder_subthema_heeft_niets_om_voor_te_stellen()
    {
        var opzet = await OpzetAsync();
        using var leerkracht = Opzet.Als(opzet.LeerkrachtId);
        _factory.AiAntwoord = Antwoord(("A1", Maandag));

        await RechtenTestOpzet.VerwachtAsync(
            leerkracht.PostAsJsonAsync($"/api/klassen/{opzet.KlasId}/jaarplan/weekvoorstel", new { datum = Maandag.AddDays(21) }),
            HttpStatusCode.BadRequest,
            "In deze week loopt geen subthema. Plan eerst een subthema in de agenda, dan kan de AI er activiteiten voor voorstellen.");
        Assert.Null(_factory.LaatsteAiVerzoek);
    }

    [PostgresFact]
    public async Task Een_onleesbaar_antwoord_is_een_422_en_verandert_niets()
    {
        var opzet = await OpzetAsync();
        using var leerkracht = Opzet.Als(opzet.LeerkrachtId);
        _factory.AiAntwoord = Antwoord(("A1", Dinsdag));
        await StelVoorAsync(leerkracht, opzet.KlasId);
        var voor = await BlokkenAsync(leerkracht, opzet.KlasId);

        _factory.AiAntwoord = "dit is geen json";
        Assert.Equal(HttpStatusCode.UnprocessableEntity, await RechtenTestOpzet.StatusAsync(
            leerkracht.PostAsJsonAsync($"/api/klassen/{opzet.KlasId}/jaarplan/weekvoorstel", new { datum = Maandag })));

        Assert.Equal(
            voor.Select(b => (b.PlaatsingId, b.Status)).Order(),
            (await BlokkenAsync(leerkracht, opzet.KlasId)).Select(b => (b.PlaatsingId, b.Status)).Order());
    }

    private static DateOnly Dinsdag => Maandag.AddDays(1);

    private static DateOnly Woensdag => Maandag.AddDays(2);

    private static DateOnly Donderdag => Maandag.AddDays(3);

    /// <summary>
    /// A K3 klas with its leerkracht, the school's hours (8:30 to 15:30, pause 12:00 to 13:15), a K3 subthema marked
    /// off for next week with two shared activiteiten, her own activiteit linked to <see cref="Doel"/>, a colleague's
    /// own activiteit, and one block she planned by hand on Monday at 8:30.
    /// </summary>
    private async Task<Opstelling> OpzetAsync()
    {
        var school = await Opzet.SchoolAsync();
        var subthemaId = await Opzet.SubthemaAsync("K3");
        var leerkrachtId = await Opzet.GebruikerAsync(school, klassen: [school.K3Blauw]);
        var collegaId = await Opzet.GebruikerAsync(school, klassen: [school.K3Groen]);

        using var admin = Opzet.Admin();
        Assert.Equal(HttpStatusCode.OK, await RechtenTestOpzet.StatusAsync(admin.PutAsJsonAsync(
            "/api/schooluren",
            new
            {
                dagen = Enumerable.Range(1, 5).Select(d => new
                {
                    weekdag = d,
                    begin = new TimeOnly(8, 30),
                    einde = new TimeOnly(15, 30),
                    middagpauzeBegin = new TimeOnly(12, 0),
                    middagpauzeEinde = new TimeOnly(13, 15),
                }),
            })));

        await Opzet.GedeeldeActiviteitMetMakerAsync(subthemaId, leerkrachtId);
        await Opzet.GedeeldeActiviteitMetMakerAsync(subthemaId, leerkrachtId);

        using var leerkracht = Opzet.Als(leerkrachtId);
        var eigen = await Opzet.ActiviteitAsync(subthemaId, leerkracht);
        Assert.Equal(leerkrachtId, eigen.EigenaarId);
        await Opzet.KoppelAsync(eigen.Id, Doel);

        using var collega = Opzet.Als(collegaId);
        var vanCollega = await Opzet.ActiviteitAsync(subthemaId, collega);

        Assert.Equal(HttpStatusCode.OK, await RechtenTestOpzet.StatusAsync(leerkracht.PostAsJsonAsync(
            $"/api/klassen/{school.K3Blauw}/jaarplan/subthemaperiodes",
            new { subthemaId, van = Maandag, tot = Vrijdag })));

        // A shared activiteit she planned herself; it stays out of the candidates and nothing lands over it.
        var handmatig = await Opzet.GedeeldeActiviteitMetMakerAsync(subthemaId, leerkrachtId);
        Assert.Equal(HttpStatusCode.OK, await RechtenTestOpzet.StatusAsync(leerkracht.PostAsJsonAsync(
            $"/api/klassen/{school.K3Blauw}/jaarplan/weekplanning",
            new { activiteitId = handmatig.Id, datum = Maandag, begin = new TimeOnly(8, 30), einde = new TimeOnly(9, 20) })));

        return new Opstelling(
            school,
            school.K3Blauw,
            leerkrachtId,
            eigen.Id,
            await NaamAsync(eigen.Id),
            await NaamAsync(vanCollega.Id));
    }

    private async Task<string> NaamAsync(Guid activiteitId)
    {
        await using var context = _db.MaakContext();
        return context.Activiteiten.Single(a => a.Id == activiteitId).Naam;
    }

    private static async Task<Resultaat> StelVoorAsync(HttpClient client, Guid klasId)
    {
        using var antwoord = await client.PostAsJsonAsync($"/api/klassen/{klasId}/jaarplan/weekvoorstel", new { datum = Maandag });
        Assert.True(antwoord.StatusCode == HttpStatusCode.OK, await antwoord.Content.ReadAsStringAsync());
        return (await antwoord.Content.ReadFromJsonAsync<Resultaat>(Json))!;
    }

    private static async Task BeslisAsync(HttpClient client, Guid klasId, Guid plaatsingId, bool aanvaard)
    {
        using var antwoord = await client.PutAsJsonAsync(
            $"/api/klassen/{klasId}/jaarplan/weekplanning/{plaatsingId}/beslissing", new { aanvaard });
        Assert.True(antwoord.StatusCode == HttpStatusCode.OK, await antwoord.Content.ReadAsStringAsync());
    }

    private static async Task<List<Blok>> BlokkenAsync(HttpClient client, Guid klasId)
    {
        var week = await client.GetFromJsonAsync<Week>(
            $"/api/klassen/{klasId}/jaarplan/weekplanning?van={Maandag:yyyy-MM-dd}&tot={Vrijdag:yyyy-MM-dd}", Json);
        return week!.Dagen.SelectMany(d => d.Activiteiten.Select(a => a with { Datum = d.Datum })).ToList();
    }

    private static async Task<bool> IsGedektAsync(HttpClient client, Guid klasId)
    {
        var dekking = await client.GetFromJsonAsync<Dekking>($"/api/klassen/{klasId}/dekking", Json);
        return dekking!.Doelen.Any(d => d.Code == Doel && d.IsGedekt);
    }

    private static string Antwoord(params (string Sleutel, DateOnly Dag)[] keuzes) =>
        "{\"activiteiten\": [" + string.Join(",", keuzes.Select(k =>
            $"{{\"activiteit\": \"{k.Sleutel}\", \"dag\": \"{k.Dag:yyyy-MM-dd}\", \"motivatie\": \"Past op die dag.\"}}")) + "]}";

    private sealed record Opstelling(
        RechtenTestOpzet.School School,
        Guid KlasId,
        Guid LeerkrachtId,
        Guid EigenId,
        string EigenNaam,
        string VanCollegaNaam);

    private sealed record Resultaat(int AantalVoorgesteld, IReadOnlyList<string> PastNiet, int AantalOvergeslagen);

    private sealed record Week(IReadOnlyList<Dag> Dagen);

    private sealed record Dag(DateOnly Datum, IReadOnlyList<Blok> Activiteiten);

    private sealed record Blok(
        Guid PlaatsingId,
        Guid ActiviteitId,
        string Status,
        TimeOnly Begin,
        TimeOnly Einde,
        string? AiMotivatie,
        DateOnly Datum = default);

    private sealed record Ingepland(IReadOnlyList<IngeplandeActiviteit> Activiteiten);

    private sealed record IngeplandeActiviteit(Guid ActiviteitId);

    private sealed record Dekking(IReadOnlyList<Doelstand> Doelen);

    private sealed record Doelstand(string Code, bool IsGedekt);
}
