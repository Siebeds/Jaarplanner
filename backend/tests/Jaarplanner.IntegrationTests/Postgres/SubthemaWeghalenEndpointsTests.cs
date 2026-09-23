using System.Net;
using System.Net.Http.Json;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.IntegrationTests.Postgres;

/// <summary>
/// FB-096 over HTTP, against real PostgreSQL: a leerkracht takes a planned subthema out of her klas's agenda. Postgres
/// because three claims live there and nowhere else: the hoekverrijkingen of the window go with it through a real FK,
/// the dekking a separate request computes no longer counts the subthema's goals, and a colleague who only reads the
/// klas is refused by the rights check itself.
/// </summary>
public sealed class SubthemaWeghalenEndpointsTests : IAsyncLifetime
{
    private const string Doelcode = "WEG-01";

    private PostgresTestDatabase _db = null!;
    private PostgresApiFactory _factory = null!;

    public async Task InitializeAsync()
    {
        if (!PostgresTestDatabase.IsBeschikbaar)
        {
            return;
        }

        _db = await PostgresTestDatabase.MaakAsync("subthemaweghalen");
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

    [PostgresFact]
    public async Task De_leerkracht_haalt_het_subthema_weg_met_zijn_activiteiten_en_verrijkingen_en_de_dekking_volgt()
    {
        var opzet = new RechtenTestOpzet(_db, _factory);
        var school = await opzet.SchoolAsync();
        var klas = school.K3Groen;
        using var leerkracht = opzet.Als(await opzet.GebruikerAsync(school, klassen: [klas]));

        var herfst = await opzet.SubthemaAsync("K3");
        var winter = await opzet.SubthemaAsync("K3");
        var bladeren = await opzet.ActiviteitAsync(herfst);
        await opzet.KoppelAsync(bladeren.Id, Doelcode);
        var sneeuw = await opzet.ActiviteitAsync(winter);

        var maandag = VolgendeMaandag();
        var vrijdag = maandag.AddDays(4);
        await VerwachtOkAsync(leerkracht.PostAsJsonAsync(
            $"/api/klassen/{klas}/jaarplan/subthemaperiodes", new { subthemaId = herfst, van = maandag, tot = vrijdag }));
        await PlanAsync(leerkracht, klas, bladeren.Id, maandag);
        await PlanAsync(leerkracht, klas, sneeuw.Id, maandag);
        await VoegHoekverrijkingToeAsync(klas, herfst);
        Assert.Equal(1, await GedektAsync(leerkracht, klas));

        var bereik = $"subthemaId={herfst}&van={maandag:yyyy-MM-dd}&tot={vrijdag:yyyy-MM-dd}";
        var gevolg = await leerkracht.GetFromJsonAsync<WeghalingDto>($"/api/klassen/{klas}/jaarplan/subthemaperiodes/weghaling?{bereik}");
        Assert.Equal(new WeghalingDto(1, 1, true, false), gevolg);

        await VerwachtOkAsync(leerkracht.DeleteAsync($"/api/klassen/{klas}/jaarplan/subthemaperiodes?{bereik}"));

        // A second request: the database, not the aggregate the delete mutated.
        var week = await leerkracht.GetFromJsonAsync<WeekDto>(
            $"/api/klassen/{klas}/jaarplan/weekplanning?van={maandag:yyyy-MM-dd}&tot={vrijdag:yyyy-MM-dd}");
        Assert.Empty(week!.Subthemaperiodes);
        Assert.Equal([sneeuw.Id], week.Dagen.SelectMany(d => d.Activiteiten).Select(a => a.ActiviteitId));
        Assert.Equal(0, await GedektAsync(leerkracht, klas));

        await using var context = _db.MaakContext();
        Assert.False(await context.Hoekverrijkingen.AnyAsync(v => context.Hoeken.Any(h => h.Id == v.HoekId && h.KlasId == klas)));
    }

    /// <summary>A colleague of the same jaarfase reads the klas (ADR-0040) and may not take anything out of it.</summary>
    [PostgresFact]
    public async Task Wie_de_klas_alleen_inkijkt_wordt_geweigerd_en_er_verandert_niets()
    {
        var opzet = new RechtenTestOpzet(_db, _factory);
        var school = await opzet.SchoolAsync();
        var klas = school.K3Groen;
        using var admin = opzet.Admin();
        using var collega = opzet.Als(await opzet.GebruikerAsync(school, klassen: [school.K3Blauw]));

        var herfst = await opzet.SubthemaAsync("K3");
        var maandag = VolgendeMaandag();
        await VerwachtOkAsync(admin.PostAsJsonAsync(
            $"/api/klassen/{klas}/jaarplan/subthemaperiodes", new { subthemaId = herfst, van = maandag, tot = maandag.AddDays(4) }));

        var bereik = $"subthemaId={herfst}&van={maandag:yyyy-MM-dd}&tot={maandag.AddDays(4):yyyy-MM-dd}";
        Assert.Equal(HttpStatusCode.OK, await RechtenTestOpzet.StatusAsync(collega.GetAsync(
            $"/api/klassen/{klas}/jaarplan/weekplanning?van={maandag:yyyy-MM-dd}&tot={maandag:yyyy-MM-dd}")));
        await RechtenTestOpzet.VerwachtAsync(
            collega.GetAsync($"/api/klassen/{klas}/jaarplan/subthemaperiodes/weghaling?{bereik}"),
            HttpStatusCode.Forbidden,
            RechtenTestOpzet.GeenToegang);
        await RechtenTestOpzet.VerwachtAsync(
            collega.DeleteAsync($"/api/klassen/{klas}/jaarplan/subthemaperiodes?{bereik}"),
            HttpStatusCode.Forbidden,
            RechtenTestOpzet.GeenToegang);

        await using var context = _db.MaakContext();
        Assert.True(await context.Subthemaplaatsingen.AnyAsync(p => p.SubthemaId == herfst));
    }

    private static DateOnly VolgendeMaandag()
    {
        var dag = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(1);
        while (dag.DayOfWeek != DayOfWeek.Monday)
        {
            dag = dag.AddDays(1);
        }

        return dag;
    }

    private static async Task VerwachtOkAsync(Task<HttpResponseMessage> verzoek)
    {
        using var antwoord = await verzoek;
        Assert.True(antwoord.StatusCode == HttpStatusCode.OK, await antwoord.Content.ReadAsStringAsync());
    }

    private static Task PlanAsync(HttpClient client, Guid klasId, Guid activiteitId, DateOnly datum) =>
        VerwachtOkAsync(client.PostAsJsonAsync(
            $"/api/klassen/{klasId}/jaarplan/weekplanning",
            new { activiteitId, datum, begin = "09:00:00", einde = "09:50:00" }));

    private async Task VoegHoekverrijkingToeAsync(Guid klasId, Guid subthemaId)
    {
        await using var context = _db.MaakContext();
        var hoek = new Hoek(klasId, "Boekenhoek");
        context.Hoeken.Add(hoek);
        var venster = await context.Subthemaplaatsingen.SingleAsync(p => p.SubthemaId == subthemaId);
        context.Hoekverrijkingen.Add(new Hoekverrijking(hoek.Id, venster.Id, "Boeken over bladeren"));
        await context.SaveChangesAsync();
    }

    private static async Task<int?> GedektAsync(HttpClient client, Guid klasId) =>
        (await client.GetFromJsonAsync<VoortgangDto>($"/api/klassen/{klasId}/dekking/voortgang"))!.AantalGedekt;

    private sealed record WeghalingDto(int AantalActiviteiten, int AantalHoekverrijkingen, bool HeeftPeriode, bool BlijftElders);

    private sealed record WeekDto(IReadOnlyList<DagDto> Dagen, IReadOnlyList<PeriodeDto> Subthemaperiodes);

    private sealed record DagDto(DateOnly Datum, IReadOnlyList<ActiviteitDto> Activiteiten);

    private sealed record ActiviteitDto(Guid ActiviteitId);

    private sealed record PeriodeDto(Guid SubthemaId);

    private sealed record VoortgangDto(int? AantalGedekt);
}
