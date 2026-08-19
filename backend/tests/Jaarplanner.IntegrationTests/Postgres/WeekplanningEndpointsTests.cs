using System.Net;
using System.Net.Http.Json;
using Jaarplanner.Application.Planning;
using Jaarplanner.Application.Planning.Generatie;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Jaarplanner.IntegrationTests.Postgres;

/// <summary>
/// E9-03 (FR-6.2/FR-7.2): an activiteit is scheduled onto a day over HTTP, against real PostgreSQL.
/// <para>
/// <b>Real PostgreSQL is load-bearing here rather than ceremony, for three reasons the unit tests cannot cover:</b>
/// </para>
/// <list type="number">
/// <item>
/// <b>The <c>Include</c>.</b> <c>Activiteitplaatsing</c> is a regular navigation, not an owned collection, so it does
/// <b>not</b> load with its owner. Forget the <c>Include</c> in <c>EfWeekplanningOpslag</c> and every day renders empty
/// while every unit test still passes, because the fake holds the aggregate in memory. That is the missing-navigation
/// failure E5-01's audit recorded, and only a real round trip catches it.
/// </item>
/// <item>
/// <b>The two Restrict FKs.</b> The in-memory provider enforces no foreign key, so the class delete guard and the
/// activiteit delete guard would both pass over a database that would have refused them anyway — or, worse, would not.
/// </item>
/// <item>
/// <b>The join projection.</b> <c>Bevraag</c> joins activiteit → subthema → thema in SQL because none of them carries a
/// navigation property. E5-01's own <c>Concat</c>-over-owned-collections defect was green on in-memory and threw on
/// Postgres, which is exactly this shape.
/// </item>
/// </list>
/// <para>
/// The starting content is seeded <b>over the API</b> (<c>POST /api/themas</c>, <c>…/subthemas</c>,
/// <c>…/activiteiten</c>) rather than through the DbContext, so nothing here passes over rows no screen can produce.
/// </para>
/// </summary>
public sealed class WeekplanningEndpointsTests : IAsyncLifetime
{
    private PostgresTestDatabase _db = null!;
    private PostgresApiFactory _factory = null!;

    public async Task InitializeAsync()
    {
        if (!PostgresTestDatabase.IsBeschikbaar)
        {
            return;
        }

        _db = await PostgresTestDatabase.MaakAsync("weekplanning");
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
    /// The story's central claim end to end: a teacher plans an activiteit on a day, and <b>re-reading it in a
    /// separate request</b> still finds it there.
    /// <para>
    /// The re-read is the point. Asserting only the POST response would pass with the <c>Include</c> missing, because
    /// that response is projected from the aggregate the same request just mutated in memory.
    /// </para>
    /// </summary>
    [PostgresFact]
    public async Task Een_activiteit_op_een_dag_plannen_overleeft_een_herlezing()
    {
        var opzet = await ZetOpAsync();
        var client = _factory.CreateClient();
        var activiteitId = await MaakActiviteitAsync(client, opzet, "Bladeren zoeken");

        var geplant = await client.PostAsJsonAsync(
            $"/api/klassen/{opzet.KlasId}/jaarplan/weekplanning",
            new { activiteitId, datum = opzet.EersteLesdag, volgorde = 0 });
        Assert.Equal(HttpStatusCode.OK, geplant.StatusCode);

        // A SECOND request, so the answer comes from the database rather than from the tracked aggregate.
        var week = await client.GetFromJsonAsync<WeekDto>(
            $"/api/klassen/{opzet.KlasId}/jaarplan/weekplanning?van={opzet.EersteLesdag:yyyy-MM-dd}&tot={opzet.EersteLesdag:yyyy-MM-dd}");

        var dag = Assert.Single(week!.Dagen);
        var activiteit = Assert.Single(dag.Activiteiten);
        Assert.Equal("Bladeren zoeken", activiteit.ActiviteitNaam);
        Assert.Equal("De plas", activiteit.SubthemaNaam);
        Assert.StartsWith("Water", activiteit.ThemaNaam, StringComparison.Ordinal);
        Assert.Equal(nameof(KoppelingStatus.Manueel), activiteit.Status);
        Assert.Equal(["VER-01"], activiteit.Doelcodes);
    }

    /// <summary>
    /// The unique index on <c>(JaarplanId, ActiviteitId, Datum)</c> holds in the database, and the service refuses the
    /// duplicate <b>before</b> it gets there — a raw 23505 would surface as a 500 with an English detail.
    /// </summary>
    [PostgresFact]
    public async Task Dezelfde_activiteit_twee_keer_op_een_dag_wordt_geweigerd_met_400()
    {
        var opzet = await ZetOpAsync();
        var client = _factory.CreateClient();
        var activiteitId = await MaakActiviteitAsync(client, opzet, "Bladeren zoeken");

        await PlanAsync(client, opzet.KlasId, activiteitId, opzet.EersteLesdag);
        var tweede = await client.PostAsJsonAsync(
            $"/api/klassen/{opzet.KlasId}/jaarplan/weekplanning",
            new { activiteitId, datum = opzet.EersteLesdag, volgorde = 1 });

        Assert.Equal(HttpStatusCode.BadRequest, tweede.StatusCode);
        var probleem = await tweede.Content.ReadFromJsonAsync<ProbleemDto>();
        Assert.Contains("staat al", probleem!.Detail, StringComparison.Ordinal);
    }

    /// <summary>
    /// A vakantie day is refused with the closure named, and the day is written in Dutch rather than as an ISO string —
    /// this <c>detail</c> is teacher-facing (Art. II.3).
    /// </summary>
    [PostgresFact]
    public async Task Een_vakantiedag_wordt_geweigerd_met_400_en_noemt_de_sluiting()
    {
        var opzet = await ZetOpAsync();
        var client = _factory.CreateClient();
        var activiteitId = await MaakActiviteitAsync(client, opzet, "Bladeren zoeken");

        var resp = await client.PostAsJsonAsync(
            $"/api/klassen/{opzet.KlasId}/jaarplan/weekplanning",
            new { activiteitId, datum = new DateOnly(2026, 11, 3), volgorde = 0 });

        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
        var probleem = await resp.Content.ReadFromJsonAsync<ProbleemDto>();
        Assert.Contains("Herfstvakantie", probleem!.Detail, StringComparison.Ordinal);
        Assert.Contains("3 november 2026", probleem.Detail, StringComparison.Ordinal);
    }

    /// <summary>
    /// Art. IX.2's class boundary over HTTP. Reachable only by a hand-built request — every screen offers a teacher the
    /// activiteiten of the class whose plan they are editing — but it is refused rather than trusted, which is the
    /// lesson E1-19 records about a boundary left open by a second route.
    /// </summary>
    [PostgresFact]
    public async Task Een_activiteit_van_een_andere_klas_wordt_geweigerd_met_400()
    {
        var opzet = await ZetOpAsync();
        var client = _factory.CreateClient();
        var vreemde = await MaakActiviteitAsync(client, opzet, "Windvaan", opzet.AndereKlasId, "Lucht", "De wind");

        var resp = await client.PostAsJsonAsync(
            $"/api/klassen/{opzet.KlasId}/jaarplan/weekplanning",
            new { activiteitId = vreemde, datum = opzet.EersteLesdag, volgorde = 0 });

        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
        var probleem = await resp.Content.ReadFromJsonAsync<ProbleemDto>();
        Assert.Contains("andere klas", probleem!.Detail, StringComparison.Ordinal);
    }

    /// <summary>
    /// The move persists, and the placement leaves its old day — asserted by re-reading a range covering both, so the
    /// test cannot pass on a copy that was added without the original being removed.
    /// </summary>
    [PostgresFact]
    public async Task Een_activiteit_verplaatsen_naar_een_andere_dag_persisteert()
    {
        var opzet = await ZetOpAsync();
        var client = _factory.CreateClient();
        var activiteitId = await MaakActiviteitAsync(client, opzet, "Bladeren zoeken");
        var plaatsingId = await PlanAsync(client, opzet.KlasId, activiteitId, opzet.EersteLesdag);
        var doeldag = opzet.EersteLesdag.AddDays(1);

        var verplaatst = await client.PutAsJsonAsync(
            $"/api/klassen/{opzet.KlasId}/jaarplan/weekplanning/{plaatsingId}/dag",
            new { datum = doeldag, volgorde = 0 });
        Assert.Equal(HttpStatusCode.OK, verplaatst.StatusCode);

        var week = await client.GetFromJsonAsync<WeekDto>(
            $"/api/klassen/{opzet.KlasId}/jaarplan/weekplanning?van={opzet.EersteLesdag:yyyy-MM-dd}&tot={doeldag:yyyy-MM-dd}");

        Assert.Empty(Assert.Single(week!.Dagen, d => d.Datum == opzet.EersteLesdag).Activiteiten);
        Assert.Single(Assert.Single(week.Dagen, d => d.Datum == doeldag).Activiteiten);
    }

    /// <summary>
    /// <b>The remediation the two Restrict guards name has to exist and work</b>, or both guards are traps rather than
    /// safeguards — the mistake this codebase made once already, when a class with one accepted placement became
    /// permanently undeletable and the guard's own message instructed an impossible action.
    /// </summary>
    [PostgresFact]
    public async Task Een_plaatsing_verwijderen_maakt_de_activiteit_weer_verwijderbaar()
    {
        var opzet = await ZetOpAsync();
        var client = _factory.CreateClient();
        var activiteitId = await MaakActiviteitAsync(client, opzet, "Bladeren zoeken");
        var plaatsingId = await PlanAsync(client, opzet.KlasId, activiteitId, opzet.EersteLesdag);

        // While it is scheduled, the FK is Restrict — and the refusal is a Dutch 400, not a raw FK 500.
        var geweigerd = await client.DeleteAsync($"/api/activiteiten/{activiteitId}");
        Assert.Equal(HttpStatusCode.BadRequest, geweigerd.StatusCode);
        var probleem = await geweigerd.Content.ReadFromJsonAsync<ProbleemDto>();
        Assert.Contains("weekplanning", probleem!.Detail, StringComparison.Ordinal);

        // Clear the weekplanning, exactly as that message instructs, and the delete goes through.
        var opgeruimd = await client.DeleteAsync(
            $"/api/klassen/{opzet.KlasId}/jaarplan/weekplanning/{plaatsingId}");
        Assert.Equal(HttpStatusCode.OK, opgeruimd.StatusCode);

        var verwijderd = await client.DeleteAsync($"/api/activiteiten/{activiteitId}");
        Assert.Equal(HttpStatusCode.NoContent, verwijderd.StatusCode);
    }

    /// <summary>
    /// A class holding scheduled activiteiten is not deletable — and this test records <b>which</b> guard refuses it,
    /// because that turned out not to be the one this story added.
    /// <para>
    /// <b>The subthema guard fires first, and it always will.</b> An activiteitplaatsing requires an activiteit, which
    /// requires a subthema scoped to this same klas, so a class with a scheduled activiteit necessarily has a subthema.
    /// The new day-level guard in <c>KlasBeheerService</c> is therefore a backstop for the <b>E1-19</b> re-scoping hole
    /// rather than a message a teacher will meet. An earlier version of this test asserted the new message and failed,
    /// which is how that was established — asserting the message it actually produces is the point, since a test that
    /// names a guard it never exercises is worse than no test (the E5-05 lesson of 2026-08-19).
    /// </para>
    /// </summary>
    [PostgresFact]
    public async Task Een_klas_met_ingeplande_activiteiten_kan_niet_verwijderd_worden()
    {
        var opzet = await ZetOpAsync();
        var client = _factory.CreateClient();
        var activiteitId = await MaakActiviteitAsync(client, opzet, "Bladeren zoeken");
        await PlanAsync(client, opzet.KlasId, activiteitId, opzet.EersteLesdag);

        var resp = await client.DeleteAsync($"/api/klassen/{opzet.KlasId}");

        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
        var probleem = await resp.Content.ReadFromJsonAsync<ProbleemDto>();

        // The subthema guard, reported honestly rather than the one this story wrote.
        Assert.Contains("subthema", probleem!.Detail, StringComparison.Ordinal);
    }

    /// <summary>
    /// A subthema whose activiteiten are scheduled onto days cannot be deleted, because the cascade to its activiteiten
    /// would hit the Restrict FK on <c>activiteitplaatsingen</c>.
    /// <para>
    /// <b>Without this guard the delete threw a raw 23503 — an unhandled 500 for an ordinary teacher action.</b> Exactly
    /// the shape <c>VerwijderThemaAsync</c> already guarded for themaplaatsingen, and the same shape this story had to
    /// add at two more levels once the class-guard test showed how the cascade propagates.
    /// </para>
    /// </summary>
    [PostgresFact]
    public async Task Een_subthema_met_ingeplande_activiteiten_kan_niet_verwijderd_worden()
    {
        var opzet = await ZetOpAsync();
        var client = _factory.CreateClient();
        var inhoud = await MaakActiviteitMetIdsAsync(client, opzet, "Bladeren zoeken");
        await PlanAsync(client, opzet.KlasId, inhoud.ActiviteitId, opzet.EersteLesdag);

        var resp = await client.DeleteAsync($"/api/subthemas/{inhoud.SubthemaId}");

        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
        var probleem = await resp.Content.ReadFromJsonAsync<ProbleemDto>();
        Assert.Contains("weekplanning", probleem!.Detail, StringComparison.Ordinal);
    }

    /// <summary>
    /// The same, one level further up: a thema cascades through its subthema's to their activiteiten, so the Restrict FK
    /// is reachable from a thema delete too — <b>two</b> levels away from the row that refuses.
    /// </summary>
    [PostgresFact]
    public async Task Een_thema_met_ingeplande_activiteiten_kan_niet_verwijderd_worden()
    {
        var opzet = await ZetOpAsync();
        var client = _factory.CreateClient();
        var inhoud = await MaakActiviteitMetIdsAsync(client, opzet, "Bladeren zoeken");
        await PlanAsync(client, opzet.KlasId, inhoud.ActiviteitId, opzet.EersteLesdag);

        var resp = await client.DeleteAsync($"/api/themas/{inhoud.ThemaId}");

        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
        var probleem = await resp.Content.ReadFromJsonAsync<ProbleemDto>();
        Assert.Contains("weekplanning", probleem!.Detail, StringComparison.Ordinal);
    }

    /// <summary>
    /// Closed days come back <b>in</b> the week with their closure named, never omitted — a week view that silently
    /// dropped Herfstvakantie would show a short week with no explanation.
    /// </summary>
    [PostgresFact]
    public async Task Een_vakantieweek_komt_volledig_terug_met_de_sluitingsnaam()
    {
        var opzet = await ZetOpAsync();
        var client = _factory.CreateClient();

        var week = await client.GetFromJsonAsync<WeekDto>(
            $"/api/klassen/{opzet.KlasId}/jaarplan/weekplanning?van=2026-11-02&tot=2026-11-08");

        Assert.Equal(7, week!.Dagen.Count);
        Assert.All(week.Dagen, d => Assert.False(d.IsLesdag));
        Assert.All(week.Dagen, d => Assert.Equal("Herfstvakantie", d.Sluitingsnaam));
    }

    /// <summary>
    /// The schema carries no block key for a day-level placement. Asserted against the live database rather than
    /// against the model, because this is the structural promise the whole story rests on: a week is a rendering
    /// grouping of dates, never a planningsblok tier (Art. IX.3, ADR-0013).
    /// </summary>
    [PostgresFact]
    public async Task De_tabel_heeft_geen_blokkolommen()
    {
        await ZetOpAsync();
        await using var context = _db.MaakContext();

        var kolommen = await context.Database
            .SqlQuery<string>(
                $"select column_name from information_schema.columns where table_name = 'activiteitplaatsingen'")
            .ToListAsync();

        Assert.Contains("Datum", kolommen);
        Assert.DoesNotContain("BlokStart", kolommen);
        Assert.DoesNotContain("BlokNiveau", kolommen);
        Assert.DoesNotContain("Ordinaal", kolommen);
    }

    private async Task<Guid> PlanAsync(HttpClient client, Guid klasId, Guid activiteitId, DateOnly datum)
    {
        var resp = await client.PostAsJsonAsync(
            $"/api/klassen/{klasId}/jaarplan/weekplanning",
            new { activiteitId, datum, volgorde = 0 });
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);

        var week = await resp.Content.ReadFromJsonAsync<WeekDto>();

        return week!.Dagen.SelectMany(d => d.Activiteiten).Single(a => a.ActiviteitId == activiteitId).PlaatsingId;
    }

    private async Task<Opzet> ZetOpAsync()
    {
        await using var context = _db.MaakContext();

        if (!await context.Leerplandoelen.AnyAsync(l => l.Code == "VER-01"))
        {
            context.Leerplandoelen.Add(new Leerplandoel(
                "VER-01",
                Doelsoort.Gemeenschappelijk,
                "K3",
                "Natuur",
                "Levende natuur",
                "9.1",
                tekst: "Tekst van VER-01"));
        }

        // Truncated to fit Schooljaar.Naam's varchar(32), as its siblings do.
        var schooljaar = new Schooljaar(
            $"2026-2027-{Guid.NewGuid():N}"[..20],
            new DateOnly(2026, 9, 1),
            new DateOnly(2027, 6, 30));

        // One real closure, so the refusal path has something to name.
        schooljaar.VoegSluitingToe(
            new Schoolsluiting("Herfstvakantie", new DateOnly(2026, 11, 2), new DateOnly(2026, 11, 8)));

        var klas = schooljaar.VoegKlasToe($"K3-{Guid.NewGuid():N}", leerjaar: 0);
        var andere = schooljaar.VoegKlasToe($"L1-{Guid.NewGuid():N}", leerjaar: 1);
        context.Schooljaren.Add(schooljaar);

        await context.SaveChangesAsync();

        using var scope = _factory.Services.CreateScope();
        var indeling = scope.ServiceProvider.GetRequiredService<IPlanningsblokIndeling>();
        var blokken = indeling.Blokken(schooljaar, JaarplanGeneratieService.GeneratieNiveau);

        return new Opzet(klas.Id, andere.Id, blokken[0].Start);
    }

    private static async Task<Guid> MaakActiviteitAsync(
        HttpClient client,
        Opzet opzet,
        string naam,
        Guid? klasId = null,
        string themaNaam = "Water",
        string subthemaNaam = "De plas") =>
        (await MaakActiviteitMetIdsAsync(client, opzet, naam, klasId, themaNaam, subthemaNaam)).ActiviteitId;

    private static async Task<Inhoud> MaakActiviteitMetIdsAsync(
        HttpClient client,
        Opzet opzet,
        string naam,
        Guid? klasId = null,
        string themaNaam = "Water",
        string subthemaNaam = "De plas")
    {
        var themaResp = await client.PostAsJsonAsync("/api/themas", new { naam = $"{themaNaam} {Guid.NewGuid():N}"[..20], duurWeken = 4 });
        Assert.Equal(HttpStatusCode.Created, themaResp.StatusCode);
        var thema = await themaResp.Content.ReadFromJsonAsync<IdDto>();

        var subResp = await client.PostAsJsonAsync($"/api/themas/{thema!.Id}/subthemas", new
        {
            naam = subthemaNaam,
            duurWeken = 2,
            klasId = klasId ?? opzet.KlasId,
            leeftijd = "K3",
        });
        Assert.Equal(HttpStatusCode.Created, subResp.StatusCode);
        var subthema = await subResp.Content.ReadFromJsonAsync<IdDto>();

        var actResp = await client.PostAsJsonAsync($"/api/subthemas/{subthema!.Id}/activiteiten", new
        {
            naam,
            activiteitType = nameof(ActiviteitType.Experiment),
            hoek = (string?)null,
            verwachteUitkomsten = (string?)null,
        });
        Assert.Equal(HttpStatusCode.Created, actResp.StatusCode);
        var activiteit = await actResp.Content.ReadFromJsonAsync<IdDto>();

        var koppel = await client.PostAsJsonAsync(
            $"/api/activiteiten/{activiteit!.Id}/doelkoppelingen",
            new { leerplandoelCode = "VER-01" });
        Assert.Equal(HttpStatusCode.OK, koppel.StatusCode);

        return new Inhoud(thema.Id, subthema.Id, activiteit.Id);
    }

    private sealed record Opzet(Guid KlasId, Guid AndereKlasId, DateOnly EersteLesdag);

    private sealed record Inhoud(Guid ThemaId, Guid SubthemaId, Guid ActiviteitId);

    private sealed record IdDto(Guid Id);

    private sealed record ProbleemDto(string Detail);

    private sealed record WeekDto(DateOnly Van, DateOnly Tot, IReadOnlyList<DagDto> Dagen);

    private sealed record DagDto(
        DateOnly Datum,
        bool IsLesdag,
        string? Sluitingsnaam,
        IReadOnlyList<GeplandDto> Activiteiten);

    private sealed record GeplandDto(
        Guid PlaatsingId,
        Guid ActiviteitId,
        string ActiviteitNaam,
        string SubthemaNaam,
        string ThemaNaam,
        string Status,
        IReadOnlyList<string> Doelcodes,
        bool ValtBuitenThemaperiode);
}
