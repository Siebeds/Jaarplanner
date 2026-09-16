using System.Net;
using System.Net.Http.Json;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.IntegrationTests.Postgres;

/// <summary>
/// The jaarplan endpoints with a placement's own days (FB-035, ADR-0049), over HTTP against real PostgreSQL: the
/// proposed end, the split around a vacation, the refusal of overlap, new days, a drag, the refusal of a rejection as a
/// status, removal, the read's lesweken and runs, a placement that a new vacation makes vervallen, and the rights.
/// <para>
/// The school year is <see cref="TestSchooljaar.MetVakanties"/>: 1 September 2026 to 30 June 2027, with the
/// herfstvakantie on 2–8 November. Every date below is worked out from <c>Themakalender</c>'s rules by hand.
/// </para>
/// </summary>
public sealed class ThemaplaatsingEndpointsTests : IAsyncLifetime
{
    private PostgresTestDatabase _db = null!;
    private PostgresApiFactory _factory = null!;

    public async Task InitializeAsync()
    {
        if (!PostgresTestDatabase.IsBeschikbaar)
        {
            return;
        }

        _db = await PostgresTestDatabase.MaakAsync("themaplaatsing");
        _factory = new PostgresApiFactory(_db.ConnectionString);
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

    /// <summary>
    /// The proposal: a thema's duration in lesweken; cut before the next thema; split around the herfstvakantie; cut to
    /// the last schooldag of the year.
    /// </summary>
    [PostgresFact]
    public async Task Het_voorstel_volgt_de_duur_het_volgende_thema_de_vakantie_en_het_schooljaar()
    {
        var opzet = await ZetOpAsync();
        var client = _factory.CreateClient();

        // Monday 21 September + 5 lesweken: the last schooldag before Monday 26 October.
        var gewoon = await VoorstelAsync(client, opzet, opzet.Vijf, D(2026, 9, 21));
        Assert.Equal(D(2026, 10, 23), gewoon.Tot);
        Assert.Equal([new DeelDto(D(2026, 9, 21), D(2026, 10, 23))], gewoon.Delen);
        Assert.Null(gewoon.BeperktDoor);

        // Monday 19 October + 4 lesweken, the herfstvakantie week not counted: the last schooldag before 23 November.
        var vakantie = await VoorstelAsync(client, opzet, opzet.Vier, D(2026, 10, 19));
        Assert.Equal(D(2026, 11, 20), vakantie.Tot);
        Assert.Equal(
            [new DeelDto(D(2026, 10, 19), D(2026, 10, 30)), new DeelDto(D(2026, 11, 9), D(2026, 11, 20))],
            vakantie.Delen);

        // Monday 21 June + 5 lesweken runs past Wednesday 30 June, the year's last day.
        var jaareinde = await VoorstelAsync(client, opzet, opzet.Vijf, D(2027, 6, 21));
        Assert.Equal(D(2027, 6, 30), jaareinde.Tot);
        Assert.Equal("Schooljaar", jaareinde.BeperktDoor);

        // A thema placed from 12 October cuts the September proposal to Friday 9 October, and is named.
        await PlaatsAsync(client, opzet, opzet.Twee, D(2026, 10, 12), D(2026, 10, 16));
        var afgekapt = await VoorstelAsync(client, opzet, opzet.Vijf, D(2026, 9, 21));
        Assert.Equal(D(2026, 10, 9), afgekapt.Tot);
        Assert.Equal("VolgendThema", afgekapt.BeperktDoor);
        Assert.Equal("Twee weken", afgekapt.VolgendThemaNaam);

        // A first day that is no schooldag, or that another thema holds, is a 400.
        Assert.Equal(HttpStatusCode.BadRequest, (await client.GetAsync(
            $"/api/klassen/{opzet.KlasId}/jaarplan/voorstel?themaId={opzet.Vijf}&van=2026-09-19")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.GetAsync(
            $"/api/klassen/{opzet.KlasId}/jaarplan/voorstel?themaId={opzet.Vijf}&van=2026-10-13")).StatusCode);
    }

    /// <summary>A placement without an end takes the proposal, and a vacation inside it stores two parts of one run.</summary>
    [PostgresFact]
    public async Task Een_plaatsing_over_een_vakantie_wordt_twee_delen_van_een_reeks()
    {
        var opzet = await ZetOpAsync();
        var client = _factory.CreateClient();

        var plan = await PlaatsAsync(client, opzet, opzet.Vier, D(2026, 10, 19), tot: null);

        Assert.Equal(2, plan.Plaatsingen.Count);
        var (eerste, tweede) = (plan.Plaatsingen[0], plan.Plaatsingen[1]);
        Assert.Equal((D(2026, 10, 19), D(2026, 10, 30)), (eerste.Van, eerste.Tot));
        Assert.Equal((D(2026, 11, 9), D(2026, 11, 20)), (tweede.Van, tweede.Tot));
        Assert.All(plan.Plaatsingen, p => Assert.Equal("Manueel", p.Status));

        Assert.Equal((1, 2), (eerste.Reeks!.Deel, eerste.Reeks.AantalDelen));
        Assert.Equal((2, 2), (tweede.Reeks!.Deel, tweede.Reeks.AantalDelen));
        Assert.False(tweede.Reeks.EindeAangepast);
        Assert.Equal(4, tweede.Reeks.Weken);
        Assert.Equal((D(2026, 10, 19), D(2026, 11, 20)), (tweede.Reeks.ReeksVan, tweede.Reeks.ReeksTot));
    }

    /// <summary>No two thema's share a day: the refusal names the thema in the way, and the day after it is free.</summary>
    [PostgresFact]
    public async Task Een_overlappende_plaatsing_wordt_geweigerd_met_de_naam_van_het_andere_thema()
    {
        var opzet = await ZetOpAsync();
        var client = _factory.CreateClient();
        await PlaatsAsync(client, opzet, opzet.Vijf, D(2026, 9, 21), tot: null);

        using var botsing = await client.PostAsJsonAsync(
            $"/api/klassen/{opzet.KlasId}/jaarplan/plaatsingen",
            new { themaId = opzet.Twee, van = D(2026, 10, 22) });

        Assert.Equal(HttpStatusCode.BadRequest, botsing.StatusCode);
        var detail = await RechtenTestOpzet.DetailAsync(botsing);
        Assert.Contains("'Vijf weken'", detail);
        Assert.Single((await LeesAsync(client, opzet)).Plaatsingen);

        // From Monday 26 October two lesweken run to Friday 13 November, in two parts around the herfstvakantie.
        var vrij = await PlaatsAsync(client, opzet, opzet.Twee, D(2026, 10, 26), tot: null);
        Assert.Equal(3, vrij.Plaatsingen.Count);
    }

    /// <summary>
    /// New days for a part: its run now ends a week before the duration proposes, so the read marks the end as changed
    /// and counts three whole lesweken.
    /// </summary>
    [PostgresFact]
    public async Task Nieuwe_dagen_markeren_een_aangepast_einde()
    {
        var opzet = await ZetOpAsync();
        var client = _factory.CreateClient();
        var plan = await PlaatsAsync(client, opzet, opzet.Vier, D(2026, 10, 19), tot: null);
        var tweede = plan.Plaatsingen[1];

        using var wijziging = await client.PutAsJsonAsync(
            $"/api/klassen/{opzet.KlasId}/jaarplan/plaatsingen/{tweede.Id}/datums",
            new { van = D(2026, 11, 9), tot = D(2026, 11, 13) });
        Assert.Equal(HttpStatusCode.OK, wijziging.StatusCode);

        var na = await LeesAsync(client, opzet);
        var deel = Assert.Single(na.Plaatsingen, p => p.Id == tweede.Id);
        Assert.Equal((D(2026, 11, 9), D(2026, 11, 13)), (deel.Van, deel.Tot));
        Assert.True(deel.Reeks!.EindeAangepast);
        Assert.Equal(3, deel.Reeks.Weken);

        // An end before the begin is a 400 and changes nothing.
        using var omgekeerd = await client.PutAsJsonAsync(
            $"/api/klassen/{opzet.KlasId}/jaarplan/plaatsingen/{tweede.Id}/datums",
            new { van = D(2026, 11, 13), tot = D(2026, 11, 9) });
        Assert.Equal(HttpStatusCode.BadRequest, omgekeerd.StatusCode);
    }

    /// <summary>
    /// A drag keeps the placement's ten schooldagen and splits it around the herfstvakantie; the placement keeps its id
    /// for the first part, and a proposal that is dragged becomes the teacher's.
    /// </summary>
    [PostgresFact]
    public async Task Een_verschuiving_behoudt_de_schooldagen_en_splitst_bij_een_vakantie()
    {
        var opzet = await ZetOpAsync();
        var plaatsingId = await VoegVoorstelToeAsync(opzet, D(2026, 10, 12), D(2026, 10, 23));
        var client = _factory.CreateClient();

        using var sleep = await client.PutAsJsonAsync(
            $"/api/klassen/{opzet.KlasId}/jaarplan/plaatsingen/{plaatsingId}/verschuiving",
            new { van = D(2026, 10, 26) });
        Assert.Equal(HttpStatusCode.OK, sleep.StatusCode);

        var plan = await LeesAsync(client, opzet);
        Assert.Equal(
            [(D(2026, 10, 26), D(2026, 10, 30)), (D(2026, 11, 9), D(2026, 11, 13))],
            plan.Plaatsingen.Select(p => (p.Van, p.Tot)));
        Assert.Equal(plaatsingId, plan.Plaatsingen[0].Id);
        Assert.All(plan.Plaatsingen, p => Assert.Equal("Manueel", p.Status));
        Assert.All(plan.Plaatsingen, p => Assert.Null(p.AiMotivatie));

        // A first day in a weekend moves forward to the Monday.
        using var weekend = await client.PutAsJsonAsync(
            $"/api/klassen/{opzet.KlasId}/jaarplan/plaatsingen/{plaatsingId}/verschuiving",
            new { van = D(2026, 9, 5) });
        Assert.Equal(HttpStatusCode.OK, weekend.StatusCode);
        Assert.Contains((await LeesAsync(client, opzet)).Plaatsingen, p => p.Id == plaatsingId && p.Van == D(2026, 9, 7));
    }

    /// <summary>
    /// A rejection is not a status any more (ADR-0049 R12): it is a 400; deleting the proposal rejects it, and deleting
    /// one part leaves the other, whose run is now shorter than the thema.
    /// </summary>
    [PostgresFact]
    public async Task Weigeren_is_verwijderen_en_een_deel_verwijderen_laat_het_andere_staan()
    {
        var opzet = await ZetOpAsync();
        var voorstel = await VoegVoorstelToeAsync(opzet, D(2026, 9, 7), D(2026, 9, 25));
        var client = _factory.CreateClient();

        using var weiger = await client.PutAsJsonAsync(
            $"/api/klassen/{opzet.KlasId}/jaarplan/plaatsingen/{voorstel}/status", new { status = "Geweigerd" });
        Assert.Equal(HttpStatusCode.BadRequest, weiger.StatusCode);

        using var verwijder = await client.DeleteAsync($"/api/klassen/{opzet.KlasId}/jaarplan/plaatsingen/{voorstel}");
        Assert.Equal(HttpStatusCode.OK, verwijder.StatusCode);
        Assert.Empty((await LeesAsync(client, opzet)).Plaatsingen);

        var plan = await PlaatsAsync(client, opzet, opzet.Vier, D(2026, 10, 19), tot: null);
        using var deel = await client.DeleteAsync(
            $"/api/klassen/{opzet.KlasId}/jaarplan/plaatsingen/{plan.Plaatsingen[1].Id}");
        Assert.Equal(HttpStatusCode.OK, deel.StatusCode);

        var over = Assert.Single((await LeesAsync(client, opzet)).Plaatsingen);
        Assert.Equal((1, 1), (over.Reeks!.Deel, over.Reeks.AantalDelen));
        Assert.True(over.Reeks.EindeAangepast);
    }

    /// <summary>
    /// The read carries the lesweken and the balance, and a vacation added inside a placement makes it vervallen
    /// without moving it; saving its days again splits it and clears the state (ADR-0049 decision 5).
    /// </summary>
    [PostgresFact]
    public async Task Een_nieuwe_vakantie_maakt_een_plaatsing_vervallen_tot_ze_opnieuw_bewaard_wordt()
    {
        var opzet = await ZetOpAsync();
        var client = _factory.CreateClient();
        var plan = await PlaatsAsync(client, opzet, opzet.Twee, D(2026, 9, 7), D(2026, 9, 25));
        var plaatsingId = Assert.Single(plan.Plaatsingen).Id;

        Assert.Equal(38, plan.Lesweken.Count);
        Assert.Equal(new BalansDto(38, 3, 35), plan.Balans);
        Assert.False(plan.Plaatsingen[0].IsVervallen);

        await using (var context = _db.MaakContext())
        {
            var schooljaar = await context.Schooljaren.SingleAsync(s => s.Id == opzet.SchooljaarId);
            schooljaar.VoegSluitingToe(new Schoolsluiting(
                "Extra week", D(2026, 9, 14), D(2026, 9, 18), Sluitingssoort.Vakantie));
            await context.SaveChangesAsync();
        }

        var vervallen = await LeesAsync(client, opzet);
        var plaatsing = Assert.Single(vervallen.Plaatsingen);
        Assert.True(plaatsing.IsVervallen);
        Assert.Equal((D(2026, 9, 7), D(2026, 9, 25)), (plaatsing.Van, plaatsing.Tot));
        Assert.Equal(37, vervallen.Lesweken.Count);
        Assert.DoesNotContain(vervallen.Lesweken, w => w.Maandag == D(2026, 9, 14));

        using var opnieuw = await client.PutAsJsonAsync(
            $"/api/klassen/{opzet.KlasId}/jaarplan/plaatsingen/{plaatsingId}/datums",
            new { van = D(2026, 9, 7), tot = D(2026, 9, 25) });
        Assert.Equal(HttpStatusCode.OK, opnieuw.StatusCode);

        var hersteld = await LeesAsync(client, opzet);
        Assert.Equal(
            [(D(2026, 9, 7), D(2026, 9, 11)), (D(2026, 9, 21), D(2026, 9, 25))],
            hersteld.Plaatsingen.Select(p => (p.Van, p.Tot)));
        Assert.All(hersteld.Plaatsingen, p => Assert.False(p.IsVervallen));
    }

    /// <summary>
    /// A leerkracht of K3 blauw reads K3 groen's plan and changes nothing in it: every new write route answers the
    /// authorisation's 403, while her own plan's routes reach the service.
    /// </summary>
    [PostgresFact]
    public async Task Wie_de_planning_alleen_mag_lezen_krijgt_403_op_de_nieuwe_routes()
    {
        var opzet = new RechtenTestOpzet(_db, _factory);
        var school = await opzet.SchoolAsync();
        var themaId = await opzet.ThemaAsync();
        using var blauw = opzet.Als(await opzet.GebruikerAsync(school, klassen: [school.K3Blauw]));

        Guid plaatsingId;
        DateOnly eerste;
        using (var directie = opzet.Directie())
        {
            eerste = (await directie.GetFromJsonAsync<PlanDto>($"/api/klassen/{school.K3Groen}/jaarplan"))!.EersteSchooldag;
            using var geplaatst = await directie.PostAsJsonAsync(
                $"/api/klassen/{school.K3Groen}/jaarplan/plaatsingen", new { themaId, van = eerste, tot = eerste });
            Assert.Equal(HttpStatusCode.OK, geplaatst.StatusCode);
            plaatsingId = (await geplaatst.Content.ReadFromJsonAsync<PlanDto>())!.Plaatsingen[0].Id;
        }

        var groen = $"/api/klassen/{school.K3Groen}/jaarplan";
        Assert.Equal(HttpStatusCode.OK, await RechtenTestOpzet.StatusAsync(blauw.GetAsync(groen)));

        await RechtenTestOpzet.VerwachtAsync(
            blauw.GetAsync($"{groen}/voorstel?themaId={themaId}&van={eerste:yyyy-MM-dd}"),
            HttpStatusCode.Forbidden,
            RechtenTestOpzet.GeenToegang);
        await RechtenTestOpzet.VerwachtAsync(
            blauw.PostAsJsonAsync($"{groen}/plaatsingen", new { themaId, van = eerste }),
            HttpStatusCode.Forbidden,
            RechtenTestOpzet.GeenToegang);
        await RechtenTestOpzet.VerwachtAsync(
            blauw.PutAsJsonAsync($"{groen}/plaatsingen/{plaatsingId}/datums", new { van = eerste, tot = eerste }),
            HttpStatusCode.Forbidden,
            RechtenTestOpzet.GeenToegang);
        await RechtenTestOpzet.VerwachtAsync(
            blauw.PutAsJsonAsync($"{groen}/plaatsingen/{plaatsingId}/verschuiving", new { van = eerste }),
            HttpStatusCode.Forbidden,
            RechtenTestOpzet.GeenToegang);
        await RechtenTestOpzet.VerwachtAsync(
            blauw.PutAsJsonAsync($"{groen}/plaatsingen/{plaatsingId}/status", new { status = "Aanvaard" }),
            HttpStatusCode.Forbidden,
            RechtenTestOpzet.GeenToegang);

        // Her own klas has no plan yet, so the service answers for it: the right was granted.
        Assert.Equal(HttpStatusCode.NotFound, await RechtenTestOpzet.StatusAsync(blauw.PutAsJsonAsync(
            $"/api/klassen/{school.K3Blauw}/jaarplan/plaatsingen/{Guid.NewGuid()}/verschuiving", new { van = eerste })));
    }

    private static DateOnly D(int jaar, int maand, int dag) => new(jaar, maand, dag);

    private static async Task<VoorstelDto> VoorstelAsync(HttpClient client, Opzet opzet, Guid themaId, DateOnly van)
    {
        using var response = await client.GetAsync(
            $"/api/klassen/{opzet.KlasId}/jaarplan/voorstel?themaId={themaId}&van={van:yyyy-MM-dd}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        return (await response.Content.ReadFromJsonAsync<VoorstelDto>())!;
    }

    private static async Task<PlanDto> PlaatsAsync(
        HttpClient client,
        Opzet opzet,
        Guid themaId,
        DateOnly van,
        DateOnly? tot)
    {
        using var response = await client.PostAsJsonAsync(
            $"/api/klassen/{opzet.KlasId}/jaarplan/plaatsingen", new { themaId, van, tot });
        Assert.True(
            response.StatusCode == HttpStatusCode.OK,
            $"{response.StatusCode}: {await response.Content.ReadAsStringAsync()}");

        return (await response.Content.ReadFromJsonAsync<PlanDto>())!;
    }

    private static async Task<PlanDto> LeesAsync(HttpClient client, Opzet opzet) =>
        (await client.GetFromJsonAsync<PlanDto>($"/api/klassen/{opzet.KlasId}/jaarplan"))!;

    /// <summary>An open AI proposal, as a generation run left it.</summary>
    private async Task<Guid> VoegVoorstelToeAsync(Opzet opzet, DateOnly van, DateOnly tot)
    {
        await using var context = _db.MaakContext();
        var jaarplan = new Jaarplan(opzet.KlasId);
        var plaatsing = jaarplan.VoegPlaatsingToe(opzet.Twee, van, tot, KoppelingStatus.Voorgesteld, "seizoen");
        context.Jaarplannen.Add(jaarplan);
        await context.SaveChangesAsync();

        return plaatsing.Id;
    }

    private async Task<Opzet> ZetOpAsync()
    {
        await using var context = _db.MaakContext();

        var schooljaar = TestSchooljaar.MetVakanties(TestSchooljaar.UniekeNaam("plaatsing"));
        var klas = schooljaar.VoegKlasToe($"L3-{Guid.NewGuid():N}", "L3");
        context.Schooljaren.Add(schooljaar);

        var vijf = new Thema("Vijf weken", duurWeken: 5);
        var vier = new Thema("Vier weken", duurWeken: 4);
        var twee = new Thema("Twee weken", duurWeken: 2);
        context.Themas.AddRange(vijf, vier, twee);

        await context.SaveChangesAsync();

        return new Opzet(schooljaar.Id, klas.Id, vijf.Id, vier.Id, twee.Id);
    }

    private sealed record Opzet(Guid SchooljaarId, Guid KlasId, Guid Vijf, Guid Vier, Guid Twee);

    private sealed record VoorstelDto(
        DateOnly Van,
        DateOnly Tot,
        List<DeelDto> Delen,
        string? BeperktDoor,
        string? VolgendThemaNaam);

    private sealed record DeelDto(DateOnly Van, DateOnly Tot);

    private sealed record PlanDto(
        DateOnly EersteSchooldag,
        DateOnly LaatsteSchooldag,
        List<PlaatsingDto> Plaatsingen,
        List<LesweekDto> Lesweken,
        BalansDto Balans);

    private sealed record PlaatsingDto(
        Guid Id,
        string ThemaNaam,
        DateOnly Van,
        DateOnly Tot,
        bool IsVervallen,
        string Status,
        string? AiMotivatie,
        ReeksDto? Reeks);

    private sealed record ReeksDto(
        int Deel,
        int AantalDelen,
        DateOnly ReeksVan,
        DateOnly ReeksTot,
        int Weken,
        bool EindeAangepast,
        bool StoptBijEindeSchooljaar);

    private sealed record LesweekDto(DateOnly Maandag, bool HeeftThema);

    private sealed record BalansDto(int Lesweken, int MetThema, int ZonderThema);
}
