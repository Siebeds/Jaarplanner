using Jaarplanner.Application.Planning.Beheer;
using Jaarplanner.Application.Schoolcontent.Beheer;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.Infrastructure.Persistence;
using Jaarplanner.Infrastructure.PlanningBeheer;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.UnitTests.Planning;

/// <summary>
/// <b>The guard above the jaarplan cascade.</b> Deleting a <see cref="Klas"/> takes its <see cref="Jaarplan"/> and
/// every <see cref="Themaplaatsing"/> with it (<c>JaarplanConfiguration</c> maps it <c>Cascade</c>), so the delete
/// must be refused while any placement is a persisted human decision — accepted, rejected, adjusted or locked. Art.
/// IV.2 makes such a decision the human's to discard, not a side effect of removing the class.
/// <para>
/// This gap shipped once and shipped silently: <c>VerwijderKlasAsync</c> guarded only on <c>Subthemas</c>, so a
/// class whose sole content was a fully reviewed, locked plan deleted without complaint — while the same endpoint
/// refused with a 400 to protect a bare subthema. No test covered it, because the existing cascade test deletes the
/// <i>jaarplan</i> and never the <i>klas</i>. These run in-memory, so they execute here rather than waiting for CI.
/// </para>
/// </summary>
public sealed class KlasVerwijderenTests
{
    private readonly DbContextOptions<AppDbContext> _options =
        new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"klas_verwijderen_{Guid.NewGuid():N}")
            .Options;

    private AppDbContext Context() => new(_options);

    /// <summary>Seeds a schooljaar + klas + thema and returns their ids.</summary>
    private async Task<(Guid KlasId, Guid ThemaId)> SeedAsync()
    {
        await using var context = Context();

        var schooljaar = TestSchooljaar.MetVakanties();
        var klas = schooljaar.VoegKlasToe("L3 — derde leerjaar", "L3");
        context.Schooljaren.Add(schooljaar);

        var thema = new Thema("Herfst", duurWeken: 5);
        context.Themas.Add(thema);

        await context.SaveChangesAsync();

        return (klas.Id, thema.Id);
    }

    private async Task MetJaarplanAsync(Guid klasId, Action<Jaarplan> vul)
    {
        await using var context = Context();

        var jaarplan = new Jaarplan(klasId);
        vul(jaarplan);
        context.Jaarplannen.Add(jaarplan);

        await context.SaveChangesAsync();
    }

    /// <summary>
    /// The three human-committed states, each individually blocking. `Manueel` and `Vergrendeld` matter as much as
    /// `Aanvaard`: a locked placement is an explicit "leave this alone", and a rejected one is a decision the teacher
    /// may still want to see.
    /// </summary>
    [Theory]
    [InlineData(KoppelingStatus.Aanvaard, false)]
    [InlineData(KoppelingStatus.Geweigerd, false)]
    [InlineData(KoppelingStatus.Manueel, false)]
    [InlineData(KoppelingStatus.Voorgesteld, true)]  // untouched proposal, but LOCKED
    public async Task Een_klas_met_een_beoordeelde_of_vergrendelde_plaatsing_kan_niet_verwijderd_worden(
        KoppelingStatus status,
        bool vergrendeld)
    {
        var (klasId, themaId) = await SeedAsync();
        await MetJaarplanAsync(klasId, plan =>
        {
            var plaatsing = plan.VoegPlaatsingToe(
                themaId, Planningsblokniveau.Themaperiode, new DateOnly(2026, 9, 1), status, "motivatie");
            plaatsing.StelVergrendelingIn(vergrendeld);
        });

        await using var context = Context();
        var service = new KlasBeheerService(context);

        var fout = await Assert.ThrowsAsync<SchoolcontentValidatieFout>(() => service.VerwijderKlasAsync(klasId));

        // Reports the count the way the subthema guard does, so the teacher knows what is blocking.
        Assert.Contains("1", fout.Message);
        Assert.Contains("jaarplan", fout.Message);

        // And nothing was destroyed.
        await using var na = Context();
        Assert.NotNull(await na.Klassen.FirstOrDefaultAsync(k => k.Id == klasId));
        Assert.NotNull(await na.Jaarplannen.FirstOrDefaultAsync(j => j.KlasId == klasId));
    }

    /// <summary>The count is real, not a hard-coded 1 — three blocking placements are reported as three.</summary>
    [Fact]
    public async Task Het_gerapporteerde_aantal_is_het_werkelijke_aantal()
    {
        var (klasId, themaId) = await SeedAsync();
        await MetJaarplanAsync(klasId, plan =>
        {
            plan.VoegPlaatsingToe(themaId, Planningsblokniveau.Themaperiode, new DateOnly(2026, 9, 1), KoppelingStatus.Aanvaard);
            plan.VoegPlaatsingToe(themaId, Planningsblokniveau.Themaperiode, new DateOnly(2026, 10, 6), KoppelingStatus.Manueel);
            plan.VoegPlaatsingToe(themaId, Planningsblokniveau.Themaperiode, new DateOnly(2026, 11, 9), KoppelingStatus.Geweigerd);

            // Plus one bare proposal, which must NOT be counted.
            plan.VoegPlaatsingToe(themaId, Planningsblokniveau.Themaperiode, new DateOnly(2027, 1, 4), KoppelingStatus.Voorgesteld);
        });

        await using var context = Context();
        var fout = await Assert.ThrowsAsync<SchoolcontentValidatieFout>(
            () => new KlasBeheerService(context).VerwijderKlasAsync(klasId));

        Assert.Contains("3", fout.Message);
    }

    /// <summary>
    /// The other half: a plan holding only untouched, unlocked proposals carries no human decision, so the delete
    /// proceeds and the cascade takes the plan and its placements. Without this the guard could have been written as
    /// "refuse whenever a jaarplan exists", which would strand every generated-but-unreviewed class forever.
    /// </summary>
    [Fact]
    public async Task Een_klas_met_alleen_onaangeroerde_voorstellen_kan_wel_verwijderd_worden()
    {
        var (klasId, themaId) = await SeedAsync();
        await MetJaarplanAsync(klasId, plan =>
        {
            plan.VoegPlaatsingToe(themaId, Planningsblokniveau.Themaperiode, new DateOnly(2026, 9, 1), KoppelingStatus.Voorgesteld, "voorstel");
            plan.VoegPlaatsingToe(themaId, Planningsblokniveau.Themaperiode, new DateOnly(2026, 10, 6), KoppelingStatus.Voorgesteld, "voorstel");
        });

        await using (var context = Context())
        {
            await new KlasBeheerService(context).VerwijderKlasAsync(klasId);
        }

        await using var na = Context();
        Assert.Null(await na.Klassen.FirstOrDefaultAsync(k => k.Id == klasId));

        // The plan went with the class. (The relational ON DELETE CASCADE itself is asserted by a [PostgresFact];
        // here the guard's own load makes the plan tracked, so EF cascades it through the change tracker.)
        Assert.Null(await na.Jaarplannen.FirstOrDefaultAsync(j => j.KlasId == klasId));
    }

    /// <summary>A class with no plan at all still deletes cleanly — the guard must not fire on a null plan.</summary>
    [Fact]
    public async Task Een_klas_zonder_jaarplan_kan_verwijderd_worden()
    {
        var (klasId, _) = await SeedAsync();

        await using (var context = Context())
        {
            await new KlasBeheerService(context).VerwijderKlasAsync(klasId);
        }

        await using var na = Context();
        Assert.Null(await na.Klassen.FirstOrDefaultAsync(k => k.Id == klasId));
    }

    /// <summary>
    /// <b>The escape hatch the guard depends on.</b> Removing the blocking placements makes the class deletable again.
    /// <para>
    /// Without this the guard was a trap, not a safeguard: one accepted or rejected placement made
    /// <c>DELETE /api/klassen/{id}</c> return 400 <b>forever</b>, and the guard's own message instructed an action the
    /// API did not offer. This test is the proof that the loop actually closes — it drives the exact remediation the
    /// message names.
    /// </para>
    /// </summary>
    [Fact]
    public async Task Na_het_verwijderen_van_de_plaatsingen_kan_de_klas_wel_verwijderd_worden()
    {
        var (klasId, themaId) = await SeedAsync();
        await MetJaarplanAsync(klasId, plan =>
        {
            var aanvaard = plan.VoegPlaatsingToe(
                themaId, Planningsblokniveau.Themaperiode, new DateOnly(2026, 9, 1), KoppelingStatus.Aanvaard);
            var geweigerd = plan.VoegPlaatsingToe(
                themaId, Planningsblokniveau.Themaperiode, new DateOnly(2026, 10, 6), KoppelingStatus.Geweigerd);
            geweigerd.StelVergrendelingIn(true);
            _ = aanvaard;
        });

        // Refused first — the precondition this test is about.
        await using (var context = Context())
        {
            await Assert.ThrowsAsync<SchoolcontentValidatieFout>(
                () => new KlasBeheerService(context).VerwijderKlasAsync(klasId));
        }

        // The teacher removes them (what DELETE …/jaarplan/plaatsingen/{id} does).
        await using (var context = Context())
        {
            var jaarplan = await context.Jaarplannen.FirstAsync(j => j.KlasId == klasId);
            foreach (var plaatsing in jaarplan.MenselijkBeslotenPlaatsingen)
            {
                jaarplan.VerwijderPlaatsing(plaatsing);
            }

            await context.SaveChangesAsync();
        }

        // Now it goes through.
        await using (var context = Context())
        {
            await new KlasBeheerService(context).VerwijderKlasAsync(klasId);
        }

        await using var na = Context();
        Assert.Null(await na.Klassen.FirstOrDefaultAsync(k => k.Id == klasId));
    }

    /// <summary>
    /// The guard is expressed as the complement of <see cref="Themaplaatsing.IsVervangbaar"/>, the one predicate that
    /// also decides what a regeneration may discard. Pinned so the two cannot drift: a second, independently written
    /// "is this a human decision?" test is exactly how a plan ends up protected against regeneration but not against
    /// deletion — which is the bug this whole file exists for.
    /// </summary>
    /// <summary>
    /// <b>The day-level half of the same guard, and the case whose absence let a real defect ship.</b>
    /// <para>
    /// Every other test in this class places a <see cref="Themaplaatsing"/>. None placed an
    /// <see cref="Activiteitplaatsing"/> — so when <c>VerwijderKlasAsync</c> loaded the jaarplan without
    /// <c>Include("_activiteitplaatsingen")</c>, the day-level count was always 0, the refusal never fired, and deleting
    /// a klas destroyed a teacher's scheduled term through the database cascade. This class exercises the **real
    /// service** over the in-memory provider, and it seeds through a separate context, so a non-owned navigation is not
    /// populated without the <c>Include</c> here either: **this test would have failed, in milliseconds, from the day
    /// the guard was written.**
    /// </para>
    /// <para>
    /// It exists because the fix's first write-up claimed the opposite — that a missing <c>Include</c> on a regular
    /// navigation is only catchable by a Postgres integration test. That was wrong, and the wrong version is the
    /// dangerous one: it tells the next reader the cheap gate does not exist. The Postgres sibling
    /// (<c>WeekplanningEndpointsTests.Een_klas_zonder_subthemas_maar_met_dagplanning_kan_niet_verwijderd_worden</c>)
    /// stays, because it pins two things this cannot: the E1-19 re-scoping route that is the only way to reach this
    /// guard in production, and the real <c>ON DELETE</c> cascade.
    /// </para>
    /// <para>
    /// The subthema guard is deliberately left unsatisfied-by-content here: this klas has no subthema rows, so the
    /// message asserted below can only be the day-level one.
    /// </para>
    /// </summary>
    [Fact]
    public async Task Klas_met_een_ingeplande_activiteit_kan_niet_verwijderd_worden()
    {
        var (klasId, _) = await SeedAsync();
        var activiteitId = Guid.NewGuid();

        await MetJaarplanAsync(klasId, plan =>
            plan.PlaatsActiviteit(activiteitId, new DateOnly(2026, 9, 7), KoppelingStatus.Manueel));

        await using var context = Context();
        var service = new KlasBeheerService(context);

        var fout = await Assert.ThrowsAsync<SchoolcontentValidatieFout>(() => service.VerwijderKlasAsync(klasId));

        // The day-level sentence, not the thema one: it must send the teacher to the weekplanning, which is where the
        // remediation lives. Asserting only "it threw" would pass on either message.
        Assert.Contains("weekplanning", fout.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("1", fout.Message);

        // And nothing was destroyed.
        await using var na = Context();
        Assert.NotNull(await na.Klassen.FirstOrDefaultAsync(k => k.Id == klasId));
        Assert.Equal(1, await na.Activiteitplaatsingen.CountAsync());
    }

    /// <summary>
    /// The complement, so the guard above is a boundary rather than a blanket refusal: a <c>Voorgesteld</c> day
    /// placement is replaceable (<see cref="Activiteitplaatsing.IsVervangbaar"/>) and must not block the delete. Without
    /// this, widening the guard to "any placement at all" would go unnoticed.
    /// </summary>
    [Fact]
    public async Task Klas_met_alleen_een_voorgestelde_dagplaatsing_kan_wel_verwijderd_worden()
    {
        var (klasId, _) = await SeedAsync();

        await MetJaarplanAsync(klasId, plan =>
            plan.PlaatsActiviteit(Guid.NewGuid(), new DateOnly(2026, 9, 7), KoppelingStatus.Voorgesteld));

        await using var context = Context();
        await new KlasBeheerService(context).VerwijderKlasAsync(klasId);

        await using var na = Context();
        Assert.Null(await na.Klassen.FirstOrDefaultAsync(k => k.Id == klasId));
    }

    [Fact]
    public void De_verwijdergrens_is_precies_het_complement_van_de_hergeneratiegrens()
    {
        var jaarplan = new Jaarplan(Guid.NewGuid());
        var themaId = Guid.NewGuid();
        var datum = new DateOnly(2026, 9, 1);
        var dag = 0;

        foreach (var status in Enum.GetValues<KoppelingStatus>())
        {
            foreach (var vergrendeld in (bool[])[false, true])
            {
                var plaatsing = jaarplan.VoegPlaatsingToe(
                    themaId, Planningsblokniveau.Themaperiode, datum.AddDays(dag++ * 40), status);
                plaatsing.StelVergrendelingIn(vergrendeld);
            }
        }

        var besloten = jaarplan.MenselijkBeslotenPlaatsingen.Select(p => p.Id).ToHashSet();
        var vervangbaar = jaarplan.Plaatsingen.Where(p => p.IsVervangbaar).Select(p => p.Id).ToHashSet();

        Assert.Empty(besloten.Intersect(vervangbaar));
        Assert.Equal(jaarplan.Plaatsingen.Count, besloten.Count + vervangbaar.Count);
    }
}
