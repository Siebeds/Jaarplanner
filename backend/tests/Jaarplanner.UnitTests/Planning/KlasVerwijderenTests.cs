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
        var klas = schooljaar.VoegKlasToe("L3 — derde leerjaar", leerjaar: 3);
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
    /// The guard is expressed as the complement of <see cref="Themaplaatsing.IsVervangbaar"/>, the one predicate that
    /// also decides what a regeneration may discard. Pinned so the two cannot drift: a second, independently written
    /// "is this a human decision?" test is exactly how a plan ends up protected against regeneration but not against
    /// deletion — which is the bug this whole file exists for.
    /// </summary>
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
