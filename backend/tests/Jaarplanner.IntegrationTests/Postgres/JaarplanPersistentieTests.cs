using Jaarplanner.Application.Planning.Generatie;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.Infrastructure.Planning;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.IntegrationTests.Postgres;

/// <summary>
/// Persistence of <see cref="Jaarplan"/> + its owned <see cref="Themaplaatsing"/> collection, and the Schooljaar↔Klas
/// containment, against real PostgreSQL (Art. IX.3, ADR-0049). Owned collections, the <c>DateOnly</c> → <c>date</c>
/// mapping of a placement's days, the enum-as-name columns, the unique indexes and the FK behaviours are all things the
/// EF in-memory provider cannot honestly verify.
/// </summary>
public sealed class JaarplanPersistentieTests : IAsyncLifetime
{
    private PostgresTestDatabase _db = null!;

    public async Task InitializeAsync()
    {
        if (!PostgresTestDatabase.IsBeschikbaar)
        {
            return;
        }

        _db = await PostgresTestDatabase.MaakAsync("jaarplan");
    }

    public async Task DisposeAsync()
    {
        if (_db is not null)
        {
            await _db.DisposeAsync();
        }
    }

    /// <summary>The whole aggregate round-trips: a placement's days, its status, its motivation and its lock.</summary>
    [PostgresFact]
    public async Task Jaarplan_met_plaatsingen_rondtript()
    {
        var (klasId, themaId) = await SeedAsync();

        await using (var context = _db.MaakContext())
        {
            var jaarplan = new Jaarplan(klasId);
            jaarplan.VoegPlaatsingToe(themaId, D(2026, 9, 1), D(2026, 9, 30), KoppelingStatus.Voorgesteld, "seizoen past hier");
            var vergrendeld = jaarplan.VoegPlaatsingToe(
                themaId, D(2026, 10, 5), D(2026, 10, 16), KoppelingStatus.Aanvaard, "later");
            vergrendeld.StelVergrendelingIn(true);

            context.Jaarplannen.Add(jaarplan);
            await context.SaveChangesAsync();
        }

        await using (var context = _db.MaakContext())
        {
            var opnieuw = await context.Jaarplannen.SingleAsync();

            Assert.Equal(klasId, opnieuw.KlasId);
            Assert.Equal(2, opnieuw.Plaatsingen.Count);

            var eerste = opnieuw.Plaatsingen[0];
            Assert.Equal((D(2026, 9, 1), D(2026, 9, 30)), (eerste.Van, eerste.Tot));
            Assert.Equal(KoppelingStatus.Voorgesteld, eerste.Status);
            Assert.Equal("seizoen past hier", eerste.AiMotivatie);
            Assert.False(eerste.Vergrendeld);

            var tweede = opnieuw.Plaatsingen[1];
            Assert.Equal((D(2026, 10, 5), D(2026, 10, 16)), (tweede.Van, tweede.Tot));
            Assert.True(tweede.Vergrendeld);
            Assert.Equal(KoppelingStatus.Aanvaard, tweede.Status);
        }
    }

    /// <summary>
    /// A placement's days are real <c>date</c> columns and nothing of the old period key is left (ADR-0049 decision 1).
    /// </summary>
    [PostgresFact]
    public async Task De_dagen_zijn_datums_en_er_is_geen_periodesleutel()
    {
        var (klasId, themaId) = await SeedAsync();

        await using (var context = _db.MaakContext())
        {
            var jaarplan = new Jaarplan(klasId);
            jaarplan.VoegPlaatsingToe(themaId, D(2026, 9, 1), D(2026, 9, 30), KoppelingStatus.Voorgesteld, "x");
            context.Jaarplannen.Add(jaarplan);
            await context.SaveChangesAsync();
        }

        await using (var context = _db.MaakContext())
        {
            var kolommen = await context.Database
                .SqlQueryRaw<string>(
                    """
                    SELECT column_name || ':' || data_type AS "Value" FROM information_schema.columns
                    WHERE table_name = 'themaplaatsingen' ORDER BY column_name
                    """)
                .ToListAsync();

            Assert.Contains("Van:date", kolommen);
            Assert.Contains("Tot:date", kolommen);
            Assert.DoesNotContain(kolommen, k => k.StartsWith("BlokStart:") || k.StartsWith("BlokNiveau:"));
            Assert.DoesNotContain(kolommen, k => k.Contains("Ordinaal"));

            var statussen = await context.Database
                .SqlQueryRaw<string>("""SELECT "Status" AS "Value" FROM themaplaatsingen""")
                .ToListAsync();
            Assert.Equal(["Voorgesteld"], statussen);
        }
    }

    /// <summary>
    /// <b>A placement added to an ALREADY PERSISTED plan is inserted, not "updated"</b> — the
    /// <c>ValueGeneratedNever</c> key defect found on 2026-07-30 (a constructor-assigned Guid read as an existing row).
    /// </summary>
    [PostgresFact]
    public async Task Een_plaatsing_toevoegen_aan_een_bestaand_plan_slaagt()
    {
        var (klasId, themaId) = await SeedAsync();

        await using (var context = _db.MaakContext())
        {
            var jaarplan = new Jaarplan(klasId);
            jaarplan.VoegPlaatsingToe(themaId, D(2026, 9, 1), D(2026, 9, 30), KoppelingStatus.Voorgesteld, "eerste");
            context.Jaarplannen.Add(jaarplan);
            await context.SaveChangesAsync();
        }

        await using (var context = _db.MaakContext())
        {
            var jaarplan = await context.Jaarplannen.SingleAsync();
            jaarplan.VoegPlaatsingToe(themaId, D(2026, 11, 9), D(2026, 11, 20), KoppelingStatus.Voorgesteld, "tweede");
            await context.SaveChangesAsync();
        }

        await using (var context = _db.MaakContext())
        {
            var jaarplan = await context.Jaarplannen.SingleAsync();
            Assert.Equal(2, jaarplan.Plaatsingen.Count);
            Assert.Contains(jaarplan.Plaatsingen, p => p.AiMotivatie == "tweede");

            Assert.Equal(2, await TelRijenAsync(context));
        }
    }

    /// <summary>
    /// A hand-placement through the production service creates the plan when the class has none, and stores the thema
    /// in two rows when a vacation lies inside it (ADR-0049 R3). The herfstvakantie runs 2–8 November; a 5-week thema
    /// from Monday 19 October ends before Monday 30 November, split around it.
    /// </summary>
    [PostgresFact]
    public async Task Een_handmatige_plaatsing_maakt_het_jaarplan_en_splitst_rond_een_vakantie()
    {
        var (klasId, themaId) = await SeedAsync();

        await using (var context = _db.MaakContext())
        {
            Assert.Empty(await context.Jaarplannen.Where(j => j.KlasId == klasId).ToListAsync());
        }

        await using (var context = _db.MaakContext())
        {
            var weergave = await MaakService(context).PlaatsThemaAsync(klasId, themaId, D(2026, 10, 19), tot: null);

            Assert.Equal(2, weergave.Plaatsingen.Count);
            Assert.All(weergave.Plaatsingen, p => Assert.Equal("Manueel", p.Status));
            Assert.All(weergave.Plaatsingen, p => Assert.Null(p.AiMotivatie));
        }

        await using (var context = _db.MaakContext())
        {
            var jaarplan = await context.Jaarplannen.SingleAsync(j => j.KlasId == klasId);
            Assert.Equal(
                [(D(2026, 10, 19), D(2026, 10, 30)), (D(2026, 11, 9), D(2026, 11, 27))],
                jaarplan.Plaatsingen.Select(p => (p.Van, p.Tot)));
            Assert.All(jaarplan.Plaatsingen, p => Assert.Equal(KoppelingStatus.Manueel, p.Status));

            Assert.Equal(2, await TelRijenAsync(context));
        }
    }

    /// <summary>
    /// A second hand-placement, onto a plan already in the database, is inserted — the path whose failure
    /// (<c>DbUpdateConcurrencyException</c>) shipped once while every in-memory test stayed green.
    /// </summary>
    [PostgresFact]
    public async Task Een_tweede_handmatige_plaatsing_op_een_bestaand_plan_wordt_ingevoegd()
    {
        var (klasId, themaId) = await SeedAsync();

        await using (var context = _db.MaakContext())
        {
            await MaakService(context).PlaatsThemaAsync(klasId, themaId, D(2026, 9, 1), D(2026, 9, 30));
        }

        await using (var context = _db.MaakContext())
        {
            var weergave = await MaakService(context).PlaatsThemaAsync(klasId, themaId, D(2027, 1, 4), D(2027, 1, 29));
            Assert.Equal(2, weergave.Plaatsingen.Count);
        }

        await using (var context = _db.MaakContext())
        {
            var jaarplan = await context.Jaarplannen.SingleAsync(j => j.KlasId == klasId);
            Assert.Equal(2, jaarplan.Plaatsingen.Count);
            Assert.Equal(2, await TelRijenAsync(context));
        }
    }

    /// <summary>Giving a placement new days through the service updates its row, and a shift writes the new days.</summary>
    [PostgresFact]
    public async Task Nieuwe_dagen_en_een_verschuiving_bereiken_de_rij()
    {
        var (klasId, themaId) = await SeedAsync();
        Guid plaatsingId;

        await using (var context = _db.MaakContext())
        {
            var weergave = await MaakService(context).PlaatsThemaAsync(klasId, themaId, D(2026, 9, 7), D(2026, 9, 18));
            plaatsingId = Assert.Single(weergave.Plaatsingen).Id;
        }

        await using (var context = _db.MaakContext())
        {
            await MaakService(context).WijzigDatumsAsync(klasId, plaatsingId, D(2026, 9, 7), D(2026, 9, 25));
        }

        await using (var context = _db.MaakContext())
        {
            // Fifteen schooldagen, moved two weeks later.
            await MaakService(context).VerschuifAsync(klasId, plaatsingId, D(2026, 9, 21));
        }

        await using (var context = _db.MaakContext())
        {
            var plaatsing = Assert.Single((await context.Jaarplannen.SingleAsync(j => j.KlasId == klasId)).Plaatsingen);
            Assert.Equal(plaatsingId, plaatsing.Id);
            Assert.Equal((D(2026, 9, 21), D(2026, 10, 9)), (plaatsing.Van, plaatsing.Tot));
        }
    }

    /// <summary>Art. IX.3: a Klas "has one Jaarplan" — enforced by the database, not merely by the service.</summary>
    [PostgresFact]
    public async Task Een_klas_heeft_ten_hoogste_een_jaarplan()
    {
        var (klasId, _) = await SeedAsync();

        await using (var context = _db.MaakContext())
        {
            context.Jaarplannen.Add(new Jaarplan(klasId));
            await context.SaveChangesAsync();
        }

        await using (var context = _db.MaakContext())
        {
            context.Jaarplannen.Add(new Jaarplan(klasId));

            var ex = await Assert.ThrowsAsync<DbUpdateException>(() => context.SaveChangesAsync());
            Assert.Equal("23505", Assert.IsType<Npgsql.PostgresException>(ex.InnerException).SqlState);
        }
    }

    /// <summary>
    /// Two placements of one plan cannot start on the same day: the part of "no overlap" the database holds itself.
    /// </summary>
    [PostgresFact]
    public async Task Twee_plaatsingen_kunnen_niet_op_dezelfde_dag_beginnen()
    {
        var (klasId, themaId) = await SeedAsync();
        Guid jaarplanId;

        await using (var context = _db.MaakContext())
        {
            var jaarplan = new Jaarplan(klasId);
            jaarplan.VoegPlaatsingToe(themaId, D(2026, 9, 1), D(2026, 9, 30), KoppelingStatus.Voorgesteld, "eerste");
            context.Jaarplannen.Add(jaarplan);
            await context.SaveChangesAsync();
            jaarplanId = jaarplan.Id;
        }

        await using (var context = _db.MaakContext())
        {
            // Inserted around the aggregate on purpose: the point is that the DATABASE refuses it, not the entity.
            var ex = await Assert.ThrowsAsync<Npgsql.PostgresException>(() => context.Database.ExecuteSqlAsync(
                $"""
                INSERT INTO themaplaatsingen ("Id", "JaarplanId", "ThemaId", "Van", "Tot", "Status", "Vergrendeld")
                VALUES ({Guid.NewGuid()}, {jaarplanId}, {themaId}, {D(2026, 9, 1)}, {D(2026, 9, 4)}, 'Voorgesteld', false)
                """));

            Assert.Equal("23505", ex.SqlState);
        }
    }

    /// <summary>
    /// Removing one placement deletes its <b>row</b>, whatever its status or lock, and leaves the rest of the plan alone.
    /// </summary>
    [PostgresFact]
    public async Task Een_plaatsing_verwijderen_verwijdert_haar_rij()
    {
        var (klasId, themaId) = await SeedAsync();
        Guid teVerwijderen;

        await using (var context = _db.MaakContext())
        {
            var jaarplan = new Jaarplan(klasId);
            var eerste = jaarplan.VoegPlaatsingToe(
                themaId, D(2026, 9, 1), D(2026, 9, 30), KoppelingStatus.Aanvaard, "aanvaard");
            eerste.StelVergrendelingIn(true);
            jaarplan.VoegPlaatsingToe(themaId, D(2026, 10, 5), D(2026, 10, 16), KoppelingStatus.Voorgesteld, "blijft");

            context.Jaarplannen.Add(jaarplan);
            await context.SaveChangesAsync();
            teVerwijderen = eerste.Id;
        }

        await using (var context = _db.MaakContext())
        {
            await MaakService(context).VerwijderPlaatsingAsync(klasId, teVerwijderen);
        }

        await using (var context = _db.MaakContext())
        {
            var jaarplan = await context.Jaarplannen.SingleAsync();
            var overgebleven = Assert.Single(jaarplan.Plaatsingen);
            Assert.Equal("blijft", overgebleven.AiMotivatie);
            Assert.Null(jaarplan.VindPlaatsing(teVerwijderen));

            Assert.Equal(1, await TelRijenAsync(context));
        }
    }

    /// <summary>A thema still placed in a jaarplan cannot be deleted: the RESTRICT FK on <c>ThemaId</c> is real.</summary>
    [PostgresFact]
    public async Task Een_geplaatst_thema_kan_niet_uit_de_database_verwijderd_worden()
    {
        var (klasId, themaId) = await SeedAsync();

        await using (var context = _db.MaakContext())
        {
            var jaarplan = new Jaarplan(klasId);
            jaarplan.VoegPlaatsingToe(themaId, D(2026, 9, 1), D(2026, 9, 30), KoppelingStatus.Voorgesteld, "voorstel");
            context.Jaarplannen.Add(jaarplan);
            await context.SaveChangesAsync();
        }

        await using (var context = _db.MaakContext())
        {
            context.Themas.Remove(await context.Themas.SingleAsync(t => t.Id == themaId));

            var ex = await Assert.ThrowsAsync<DbUpdateException>(() => context.SaveChangesAsync());
            Assert.Equal("23503", Assert.IsType<Npgsql.PostgresException>(ex.InnerException).SqlState);
        }
    }

    /// <summary>Deleting a plan takes its placements with it — they are owned and have no independent lifetime.</summary>
    [PostgresFact]
    public async Task Verwijderen_neemt_de_plaatsingen_mee()
    {
        var (klasId, themaId) = await SeedAsync();

        await using (var context = _db.MaakContext())
        {
            var jaarplan = new Jaarplan(klasId);
            jaarplan.VoegPlaatsingToe(themaId, D(2026, 9, 1), D(2026, 9, 30), KoppelingStatus.Voorgesteld, "x");
            context.Jaarplannen.Add(jaarplan);
            await context.SaveChangesAsync();
        }

        await using (var context = _db.MaakContext())
        {
            context.Jaarplannen.Remove(await context.Jaarplannen.SingleAsync());
            await context.SaveChangesAsync();
        }

        await using (var context = _db.MaakContext())
        {
            Assert.Empty(await context.Jaarplannen.ToListAsync());
            Assert.Equal(0, await TelRijenAsync(context));
        }
    }

    /// <summary>
    /// The relational cascade itself: deleting the <b>klas</b> row removes its jaarplan and every placement — the
    /// destructive behaviour <c>KlasBeheerService.VerwijderKlasAsync</c> guards against for decided placements.
    /// </summary>
    [PostgresFact]
    public async Task Een_klas_verwijderen_neemt_haar_jaarplan_en_plaatsingen_mee()
    {
        var (klasId, themaId) = await SeedAsync();

        await using (var context = _db.MaakContext())
        {
            var jaarplan = new Jaarplan(klasId);
            jaarplan.VoegPlaatsingToe(themaId, D(2026, 9, 1), D(2026, 9, 30), KoppelingStatus.Voorgesteld, "voorstel");
            context.Jaarplannen.Add(jaarplan);
            await context.SaveChangesAsync();
        }

        await using (var context = _db.MaakContext())
        {
            // No quotes around the hole: ExecuteSqlAsync turns it into a parameter.
            var verwijderd = await context.Database.ExecuteSqlAsync($"""DELETE FROM klassen WHERE "Id" = {klasId}""");
            Assert.Equal(1, verwijderd);
        }

        await using (var context = _db.MaakContext())
        {
            Assert.Empty(await context.Jaarplannen.Where(j => j.KlasId == klasId).ToListAsync());
            Assert.Equal(0, await TelRijenAsync(context));
        }
    }

    /// <summary>
    /// Art. IX.3's "Schooljaar contains multiple klassen", as a real FK: deleting the year is <b>refused</b> while it
    /// still holds classes.
    /// </summary>
    [PostgresFact]
    public async Task Een_schooljaar_bevat_klassen_en_kan_niet_zomaar_verdwijnen()
    {
        Guid schooljaarId;

        await using (var context = _db.MaakContext())
        {
            var schooljaar = TestSchooljaar.MetVakanties(TestSchooljaar.UniekeNaam("containment"));
            schooljaar.VoegKlasToe($"L1-{Guid.NewGuid():N}", "L1");
            schooljaar.VoegKlasToe($"L2-{Guid.NewGuid():N}", "L2");
            context.Schooljaren.Add(schooljaar);
            await context.SaveChangesAsync();
            schooljaarId = schooljaar.Id;
        }

        await using (var context = _db.MaakContext())
        {
            var opnieuw = await context.Schooljaren
                .Include("_klassen")
                .SingleAsync(s => s.Id == schooljaarId);

            Assert.Equal(2, opnieuw.Klassen.Count);
            Assert.All(opnieuw.Klassen, k => Assert.Equal(schooljaarId, k.SchooljaarId));
        }

        await using (var context = _db.MaakContext())
        {
            context.Schooljaren.Remove(await context.Schooljaren.SingleAsync(s => s.Id == schooljaarId));

            var ex = await Assert.ThrowsAsync<DbUpdateException>(() => context.SaveChangesAsync());
            Assert.Equal("23503", Assert.IsType<Npgsql.PostgresException>(ex.InnerException).SqlState);
        }
    }

    /// <summary>A klas without an existing school year is refused by the FK — the containment is not advisory.</summary>
    [PostgresFact]
    public async Task Een_klas_zonder_bestaand_schooljaar_wordt_geweigerd()
    {
        await using var context = _db.MaakContext();
        context.Klassen.Add(new Klas(Guid.NewGuid(), $"Zwevend-{Guid.NewGuid():N}", "L3"));

        var ex = await Assert.ThrowsAsync<DbUpdateException>(() => context.SaveChangesAsync());
        Assert.Equal("23503", Assert.IsType<Npgsql.PostgresException>(ex.InnerException).SqlState);
    }

    /// <summary>
    /// The plain read, from a fresh context, carries the lesweken and the balance (ADR-0049 decision 6). The year with
    /// its four vacations has 38 lesweken; a 5-week placement from Tuesday 1 September covers the first six (it ends on
    /// Monday 5 October, the last schooldag before Tuesday 6 October).
    /// </summary>
    [PostgresFact]
    public async Task Het_leespad_levert_de_lesweken_en_de_balans()
    {
        var (klasId, themaId) = await SeedAsync();

        await using (var context = _db.MaakContext())
        {
            var jaarplan = new Jaarplan(klasId);
            jaarplan.VoegPlaatsingToe(themaId, D(2026, 9, 1), D(2026, 10, 5), KoppelingStatus.Aanvaard, "september");
            context.Jaarplannen.Add(jaarplan);
            await context.SaveChangesAsync();
        }

        await using (var context = _db.MaakContext())
        {
            var weergave = await MaakService(context).HaalJaarplanAsync(klasId);

            Assert.Equal(D(2026, 9, 1), weergave.EersteSchooldag);
            Assert.Equal(D(2027, 6, 30), weergave.LaatsteSchooldag);
            Assert.Equal(38, weergave.Lesweken.Count);
            Assert.Equal(new JaarbalansWeergave(38, 6, 32), weergave.Balans);
            Assert.Equal(D(2026, 8, 31), weergave.Lesweken[0].Maandag);
            Assert.True(weergave.Lesweken[5].HeeftThema);
            Assert.False(weergave.Lesweken[6].HeeftThema);

            var plaatsing = Assert.Single(weergave.Plaatsingen);
            Assert.False(plaatsing.IsVervallen);
            Assert.Equal(5, plaatsing.DuurWeken);
            Assert.NotNull(plaatsing.Reeks);
            Assert.False(plaatsing.Reeks!.EindeAangepast);
            Assert.Equal(5, plaatsing.Reeks.Weken);
        }
    }

    private static DateOnly D(int jaar, int maand, int dag) => new(jaar, maand, dag);

    private static async Task<int> TelRijenAsync(Jaarplanner.Infrastructure.Persistence.AppDbContext context) =>
        await context.Database
            .SqlQueryRaw<int>("""SELECT COUNT(*)::int AS "Value" FROM themaplaatsingen""")
            .SingleAsync();

    /// <summary>
    /// Seeds a school year with the four standard vacations, a class inside it, a leerplandoel and a 5-week thema.
    /// </summary>
    private async Task<(Guid KlasId, Guid ThemaId)> SeedAsync()
    {
        await using var context = _db.MaakContext();

        var schooljaar = TestSchooljaar.MetVakanties(TestSchooljaar.UniekeNaam("jaarplan"));
        var klas = schooljaar.VoegKlasToe($"L3-{Guid.NewGuid():N}", "L3");
        context.Schooljaren.Add(schooljaar);

        var code = $"NAT-{Guid.NewGuid():N}"[..16];
        context.Leerplandoelen.Add(new Leerplandoel(
            code, Doelsoort.Minimumdoel, "K3", "Natuur", "Levende natuur", "3", tekst: "herkent bomen."));

        var thema = new Thema($"Herfst-{Guid.NewGuid():N}", duurWeken: 5);
        thema.VoegThemadoelToe(new DoelKoppeling(code, KoppelingStatus.Aanvaard, "anchor"));
        context.Themas.Add(thema);

        await context.SaveChangesAsync();

        return (klas.Id, thema.Id);
    }

    /// <summary>The production planning service over the production storage port.</summary>
    private static JaarplanService MaakService(Jaarplanner.Infrastructure.Persistence.AppDbContext context) =>
        new(new EfJaarplanOpslag(context));
}
