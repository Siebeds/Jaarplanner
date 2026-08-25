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
    /// The unique index on <c>(JaarplanId, ActiviteitId, Datum, Volgorde)</c> holds in the database, and the service
    /// refuses the duplicate <b>before</b> it gets there — a raw 23505 would surface as a 500 with an English detail.
    /// <para>
    /// <b>The SLOT, not the day.</b> This test asserted the day-level rule, and went on asserting it after
    /// <c>ActiviteitplaatsingPerLesuur</c> put <c>Volgorde</c> in that index: it planned lesuur 1, asked for lesuur 2,
    /// and called the resulting <c>200</c> a failure. That is the one test that had CI red on this branch for two
    /// commits, and it is worth recording rather than quietly rewriting, because a stale test does not read as stale.
    /// It reads as a rule, and the rule it stated is one a teacher would have noticed was gone. The companion below
    /// covers the half the change exists for.
    /// </para>
    /// </summary>
    [PostgresFact]
    public async Task Dezelfde_activiteit_twee_keer_in_hetzelfde_lesuur_wordt_geweigerd_met_400()
    {
        var opzet = await ZetOpAsync();
        var client = _factory.CreateClient();
        var activiteitId = await MaakActiviteitAsync(client, opzet, "Bladeren zoeken");

        // PlanAsync takes volgorde 0, so this asks for the slot that is already occupied.
        await PlanAsync(client, opzet.KlasId, activiteitId, opzet.EersteLesdag);
        var tweede = await client.PostAsJsonAsync(
            $"/api/klassen/{opzet.KlasId}/jaarplan/weekplanning",
            new { activiteitId, datum = opzet.EersteLesdag, volgorde = 0 });

        Assert.Equal(HttpStatusCode.BadRequest, tweede.StatusCode);
        var probleem = await tweede.Content.ReadFromJsonAsync<ProbleemDto>();
        Assert.Contains("staat al", probleem!.Detail, StringComparison.Ordinal);

        // The refusal names the LESUUR and counts it from one. Asserted because that wording is the whole point of
        // the per-slot rule: telling a teacher to pick another day when picking the next hour would do sends them
        // away from the fix.
        Assert.Contains("lesuur 1", probleem.Detail, StringComparison.Ordinal);
    }

    /// <summary>
    /// The same activiteit in two lesuren of one day is allowed, which is what a hoek running two hours looks like.
    /// <para>
    /// Two rows for one activiteit on one day is by itself proof that they sit in different slots: the unique index
    /// includes <c>Volgorde</c>, so a second row in the same lesuur cannot exist to be counted.
    /// </para>
    /// </summary>
    [PostgresFact]
    public async Task Dezelfde_activiteit_in_een_ander_lesuur_van_dezelfde_dag_mag()
    {
        var opzet = await ZetOpAsync();
        var client = _factory.CreateClient();
        var activiteitId = await MaakActiviteitAsync(client, opzet, "Bladeren zoeken");

        await PlanAsync(client, opzet.KlasId, activiteitId, opzet.EersteLesdag);
        var tweede = await client.PostAsJsonAsync(
            $"/api/klassen/{opzet.KlasId}/jaarplan/weekplanning",
            new { activiteitId, datum = opzet.EersteLesdag, volgorde = 1 });

        Assert.Equal(HttpStatusCode.OK, tweede.StatusCode);
        var week = await tweede.Content.ReadFromJsonAsync<WeekDto>();
        Assert.Equal(2, week!.Dagen.SelectMany(d => d.Activiteiten).Count(a => a.ActiviteitId == activiteitId));
    }

    /// <summary>
    /// A marked-off subthemaperiode is stored and comes back on the read (owner ruling, 2026-08-25).
    /// <para>
    /// <b>This test exists because the feature shipped broken in exactly the way the fake cannot see.</b> The endpoint
    /// stored the window, the row was in the database, every unit test passed, and the calendar drew nothing:
    /// <c>EfWeekplanningOpslag.LaadJaarplanAsync</c> had no <c>Include</c> for the new collection, so it came back
    /// empty. That file's own docstring had already written down that the <c>Include</c> is the one thing which can
    /// silently break the feature. Only a real-database round trip catches it, which is why this asserts the READ and
    /// not the write.
    /// </para>
    /// </summary>
    [PostgresFact]
    public async Task Een_subthemaperiode_wordt_bewaard_en_komt_terug_op_de_weekplanning()
    {
        var opzet = await ZetOpAsync();
        var client = _factory.CreateClient();
        var inhoud = await MaakActiviteitMetIdsAsync(client, opzet, "Bladeren zoeken");

        var van = opzet.EersteLesdag;
        var tot = van.AddDays(4);

        var gezet = await client.PostAsJsonAsync(
            $"/api/klassen/{opzet.KlasId}/jaarplan/subthemaperiodes",
            new { subthemaId = inhoud.SubthemaId, van, tot });
        Assert.Equal(HttpStatusCode.OK, gezet.StatusCode);

        // A SECOND request, not the response of the first: the write path holds the aggregate it just mutated in
        // memory, so it would have answered correctly even with the Include missing. The read is the thing under test.
        var week = await client.GetFromJsonAsync<WeekDto>(
            $"/api/klassen/{opzet.KlasId}/jaarplan/weekplanning?van={van:yyyy-MM-dd}&tot={tot:yyyy-MM-dd}");

        var periode = Assert.Single(week!.Subthemaperiodes);
        Assert.Equal(inhoud.SubthemaId, periode.SubthemaId);
        Assert.Equal(van, periode.Van);
        Assert.Equal(tot, periode.Tot);

        // The window carries its own names, so a calendar can label a band for a subthema it holds no content for.
        Assert.Equal("De plas", periode.SubthemaNaam);
        Assert.StartsWith("Water", periode.ThemaNaam, StringComparison.Ordinal);

        // And it says nothing about activiteiten: five days are marked off with none placed in them at all.
        Assert.All(week.Dagen, dag => Assert.Empty(dag.Activiteiten));
    }

    /// <summary>
    /// Re-planning a subthema over an overlapping stretch MOVES its window instead of adding a second one.
    /// </summary>
    [PostgresFact]
    public async Task Een_overlappende_subthemaperiode_verplaatst_het_venster()
    {
        var opzet = await ZetOpAsync();
        var client = _factory.CreateClient();
        var inhoud = await MaakActiviteitMetIdsAsync(client, opzet, "Bladeren zoeken");

        var van = opzet.EersteLesdag;
        await client.PostAsJsonAsync(
            $"/api/klassen/{opzet.KlasId}/jaarplan/subthemaperiodes",
            new { subthemaId = inhoud.SubthemaId, van, tot = van.AddDays(4) });

        // Two days later and two days shorter: the teacher saying "these days instead".
        await client.PostAsJsonAsync(
            $"/api/klassen/{opzet.KlasId}/jaarplan/subthemaperiodes",
            new { subthemaId = inhoud.SubthemaId, van = van.AddDays(2), tot = van.AddDays(4) });

        var week = await client.GetFromJsonAsync<WeekDto>(
            $"/api/klassen/{opzet.KlasId}/jaarplan/weekplanning?van={van:yyyy-MM-dd}&tot={van.AddDays(10):yyyy-MM-dd}");

        var periode = Assert.Single(week!.Subthemaperiodes);
        Assert.Equal(van.AddDays(2), periode.Van);
    }

    /// <summary>
    /// A subthemaperiode running backwards is a Dutch 400, not the aggregate's bare ArgumentException as a 500.
    /// </summary>
    [PostgresFact]
    public async Task Een_subthemaperiode_die_achteruit_loopt_wordt_geweigerd_met_400()
    {
        var opzet = await ZetOpAsync();
        var client = _factory.CreateClient();
        var inhoud = await MaakActiviteitMetIdsAsync(client, opzet, "Bladeren zoeken");

        var resp = await client.PostAsJsonAsync(
            $"/api/klassen/{opzet.KlasId}/jaarplan/subthemaperiodes",
            new { subthemaId = inhoud.SubthemaId, van = opzet.EersteLesdag.AddDays(4), tot = opzet.EersteLesdag });

        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
        var probleem = await resp.Content.ReadFromJsonAsync<ProbleemDto>();
        Assert.Contains("voor de eerste dag", probleem!.Detail, StringComparison.Ordinal);
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
    /// <b>The day-level guard actually fires — through the one route that reaches it, and against the production load
    /// path.</b> Written for the 2026-08-20 audit's sharpest finding.
    /// <para>
    /// The guard shipped unable to fire at all. <c>KlasBeheerService</c> loaded the jaarplan without
    /// <c>Include("_activiteitplaatsingen")</c>, and unlike <c>Themaplaatsing</c> — an EF <i>owned</i> collection that
    /// arrives with its owner — <c>Activiteitplaatsing</c> is a regular navigation that does not. So
    /// <c>MenselijkBeslotenActiviteitplaatsingen</c> counted an empty list, the refusal never happened, and the delete
    /// cascaded through to <c>activiteitplaatsingen</c> at the database level: a teacher's scheduled term destroyed
    /// silently by the very operation a guard was written to refuse.
    /// </para>
    /// <para>
    /// <b>Why no test caught it, corrected — because the first version of this paragraph got it wrong.</b> It said
    /// <c>KlasVerwijderenTests</c> was a domain test that never touched the production load path, and concluded that
    /// only a Postgres integration test could catch a missing <c>Include</c>. Neither half holds: that class builds a
    /// real <c>KlasBeheerService</c> over the in-memory provider, and it missed this because <b>not one of its cases ever
    /// placed an activiteit</b>. A single added case fails in milliseconds, and it now exists as
    /// <c>KlasVerwijderenTests.Klas_met_een_ingeplande_activiteit_kan_niet_verwijderd_worden</c>. <i>Publishing "only an
    /// integration test can catch this" is how the next missing navigation ships.</i>
    /// </para>
    /// <para>
    /// <b>This test still earns its place, for the two things the cheap one cannot reach:</b> the E1-19 re-scoping route,
    /// which is the only route that reaches this guard in production, and the real database <c>ON DELETE</c> cascade
    /// that the in-memory provider does not enforce.
    /// </para>
    /// <para>
    /// <b>Reached over the E1-19 hole, because nothing else reaches it.</b> The subthema guard fires first in every
    /// ordinary case (see the test above): an activiteitplaatsing needs an activiteit, which needs a subthema of this
    /// same klas. <c>Subthema.WijzigScope</c> moves that subthema — and every activiteit in it — to another klas,
    /// leaving this plan holding a placement whose activiteit now belongs elsewhere and this klas holding no subthema
    /// at all. That is exactly the state the guard exists for, and it is why the guard is kept rather than deleted.
    /// </para>
    /// </summary>
    [PostgresFact]
    public async Task Een_klas_zonder_subthemas_maar_met_dagplanning_kan_niet_verwijderd_worden()
    {
        var opzet = await ZetOpAsync();
        var client = _factory.CreateClient();
        var inhoud = await MaakActiviteitMetIdsAsync(client, opzet, "Bladeren zoeken");
        await PlanAsync(client, opzet.KlasId, inhoud.ActiviteitId, opzet.EersteLesdag);

        // The E1-19 route, applied directly because no screen offers it: the subthema (and its activiteit) move to the
        // other klas, so this klas keeps the day placement and loses the subthema that shielded it.
        await using (var context = _db.MaakContext())
        {
            var subthema = await context.Subthemas.FirstAsync(s => s.Id == inhoud.SubthemaId);
            subthema.WijzigScope(opzet.AndereKlasId, "K3");
            await context.SaveChangesAsync();
        }

        // Precondition, asserted rather than assumed: the subthema guard can no longer be the one that answers.
        await using (var context = _db.MaakContext())
        {
            Assert.Equal(0, await context.Subthemas.CountAsync(s => s.KlasId == opzet.KlasId));
        }

        var resp = await client.DeleteAsync($"/api/klassen/{opzet.KlasId}");

        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
        var probleem = await resp.Content.ReadFromJsonAsync<ProbleemDto>();

        // The day-level sentence, named: it points at the weekplanning, which is where the remediation lives. Asserting
        // "a 400" alone would have passed on the subthema message too, which is the mistake the sibling test records.
        Assert.Contains("weekplanning", probleem!.Detail, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("subthema", probleem.Detail, StringComparison.OrdinalIgnoreCase);

        // **The assertion the missing Include actually broke.** Reverting it turns the delete into a 204 and takes the
        // row with it; a status-only assertion would catch that, but this says what was at stake.
        await using (var context = _db.MaakContext())
        {
            Assert.Equal(HttpStatusCode.OK, (await client.GetAsync($"/api/klassen/{opzet.KlasId}")).StatusCode);
            Assert.Equal(1, await context.Activiteitplaatsingen.CountAsync());
        }

        // **And the remediation the Dutch message names actually works from this state**, which is not free: the
        // orphaned placement is only still reachable because `ProjecteerAsync` applies no klas filter and `Bevraag`
        // resolves the activiteit by id whatever its subthema now says. A guard whose instruction cannot be followed is
        // the trap `ActiviteitplaatsingConfiguration` records shipping once already, so the sentence is proven end to
        // end rather than trusted.
        var week = await client.GetFromJsonAsync<WeekDto>(
            $"/api/klassen/{opzet.KlasId}/jaarplan/weekplanning?van={opzet.EersteLesdag:yyyy-MM-dd}&tot={opzet.EersteLesdag:yyyy-MM-dd}");
        var plaatsingId = Assert.Single(Assert.Single(week!.Dagen).Activiteiten).PlaatsingId;

        Assert.Equal(
            HttpStatusCode.OK,
            (await client.DeleteAsync($"/api/klassen/{opzet.KlasId}/jaarplan/weekplanning/{plaatsingId}")).StatusCode);
        Assert.Equal(
            HttpStatusCode.NoContent,
            (await client.DeleteAsync($"/api/klassen/{opzet.KlasId}")).StatusCode);
    }

    /// <summary>
    /// <b>A day card lists the doelen the teacher stands behind, and no others</b> (Art. IV.1/IV.2) — the second backend
    /// MAJOR of the 2026-08-20 audit.
    /// <para>
    /// <c>EfWeekplanningOpslag</c> projected <c>Doelkoppelingen</c> unfiltered, so a <c>Geweigerd</c> link arrived on the
    /// card beside an accepted one with nothing to tell them apart. The link's status is the whole record of a teacher
    /// decision; presenting a rejected doel as one this activiteit works toward tells them their rejection did nothing.
    /// </para>
    /// <para>
    /// Three statuses in one activiteit, so the assertion is a real partition rather than one code surviving: mutating
    /// the predicate in either direction (dropping it, or narrowing it to <c>Aanvaard</c> alone) changes this list.
    /// </para>
    /// </summary>
    [PostgresFact]
    public async Task Een_geweigerde_of_voorgestelde_doelkoppeling_staat_niet_op_de_dagkaart()
    {
        var opzet = await ZetOpAsync();
        var client = _factory.CreateClient();
        var inhoud = await MaakActiviteitMetIdsAsync(client, opzet, "Bladeren zoeken");
        await PlanAsync(client, opzet.KlasId, inhoud.ActiviteitId, opzet.EersteLesdag);

        // **Written through the DbContext, against this class's own "seed over the API" rule, and that bypass IS the
        // evidence.** Two of these three statuses are unreachable over the API by construction:
        // `KoppelActiviteitAanDoelAsync` hard-codes `Manueel` and `ActiviteitenController` has no status route. So the
        // defect being fixed is latent — the filter lands before E8's activiteit-level matching makes `Voorgesteld` and
        // `Geweigerd` reachable — and there is no screen-producible row that could exercise it. Disclosed the way the
        // klas test above discloses its own E1-19 bypass, rather than left for a reader to notice.
        //
        // MaakActiviteitMetIdsAsync leaves one Manueel link on VER-01. Three more, one per remaining status, so every
        // branch of the predicate is populated.
        await using (var context = _db.MaakContext())
        {
            foreach (var code in new[] { "BLA-02", "VER-03", "VER-04" })
            {
                if (!await context.Leerplandoelen.AnyAsync(l => l.Code == code))
                {
                    context.Leerplandoelen.Add(new Leerplandoel(
                        code,
                        Doelsoort.Gemeenschappelijk,
                        "K3",
                        "Natuur",
                        "Levende natuur",
                        "9.1",
                        tekst: $"Tekst van {code}"));
                }
            }

            await context.SaveChangesAsync();

            var activiteit = await context.Activiteiten
                .Include(a => a.Doelkoppelingen)
                .FirstAsync(a => a.Id == inhoud.ActiviteitId);
            activiteit.VoegDoelkoppelingToe(new DoelKoppeling("BLA-02", KoppelingStatus.Aanvaard));
            activiteit.VoegDoelkoppelingToe(new DoelKoppeling("VER-03", KoppelingStatus.Geweigerd));
            activiteit.VoegDoelkoppelingToe(new DoelKoppeling("VER-04", KoppelingStatus.Voorgesteld));
            await context.SaveChangesAsync();
        }

        var week = await client.GetFromJsonAsync<WeekDto>(
            $"/api/klassen/{opzet.KlasId}/jaarplan/weekplanning?van={opzet.EersteLesdag:yyyy-MM-dd}&tot={opzet.EersteLesdag:yyyy-MM-dd}");

        var kaart = Assert.Single(Assert.Single(week!.Dagen).Activiteiten);

        // **This pins the STATUS filter. It does NOT pin the `OrderBy`, and the comment says so rather than implying
        // otherwise.** Two attempts to pin it both stayed green with the `OrderBy` deleted, and the second one explains
        // the first: `DoelKoppeling.Id` is a fresh `Guid`, so the unordered projection's row order is *already*
        // arbitrary — it came out sorted here by luck, and a test asserting a specific order would pass or fail on a
        // coin flip per run. A flaky guard is worse than an absent one. `BLA-02` is nonetheless kept over `VER-02`
        // because it makes the expected list differ from the insertion order, so the assertion is at least not a
        // tautology. The `OrderBy` stays for determinism on screen; its justification is the comment at the projection,
        // not this test.
        Assert.Equal(["BLA-02", "VER-01"], kaart.Doelcodes);
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

    private sealed record WeekDto(
        DateOnly Van,
        DateOnly Tot,
        IReadOnlyList<DagDto> Dagen,
        IReadOnlyList<SubthemaperiodeDto> Subthemaperiodes);

    private sealed record SubthemaperiodeDto(
        Guid SubthemaId,
        string SubthemaNaam,
        Guid ThemaId,
        string ThemaNaam,
        DateOnly Van,
        DateOnly Tot);

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
