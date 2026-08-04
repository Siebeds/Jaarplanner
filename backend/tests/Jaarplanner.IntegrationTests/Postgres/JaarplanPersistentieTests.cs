using Jaarplanner.Application.Ai;
using Jaarplanner.Application.Planning;
using Jaarplanner.Application.Planning.Generatie;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.Infrastructure.Planning;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.IntegrationTests.Postgres;

/// <summary>
/// Persistence of <see cref="Jaarplan"/> + its owned <see cref="Themaplaatsing"/> collection, and the Schooljaar↔Klas
/// containment, against real PostgreSQL (E3-01, Art. IX.3). Owned collections, the <c>DateOnly</c> → <c>date</c>
/// mapping of the block key, the enum-as-name columns, the unique indexes and the FK behaviours are all things the
/// EF in-memory provider cannot honestly verify — the E1 reopening proved exactly that.
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

    /// <summary>
    /// The whole aggregate round-trips: the placement's block <b>start date</b>, its tier, its status, its motivation
    /// and — the flag E4 consumes — its <c>vergrendeld</c> value.
    /// </summary>
    [PostgresFact]
    public async Task Jaarplan_met_plaatsingen_rondtript()
    {
        var (klasId, themaId, blokStart) = await SeedAsync();

        await using (var context = _db.MaakContext())
        {
            var jaarplan = new Jaarplan(klasId);
            jaarplan.VoegPlaatsingToe(
                themaId, Planningsblokniveau.Themaperiode, blokStart, KoppelingStatus.Voorgesteld, "seizoen past hier");
            var vergrendeld = jaarplan.VoegPlaatsingToe(
                themaId, Planningsblokniveau.Subthemaperiode, blokStart, KoppelingStatus.Aanvaard, "fijnere periode");
            vergrendeld.StelVergrendelingIn(true);

            context.Jaarplannen.Add(jaarplan);
            await context.SaveChangesAsync();
        }

        await using (var context = _db.MaakContext())
        {
            var opnieuw = await context.Jaarplannen.SingleAsync();

            Assert.Equal(klasId, opnieuw.KlasId);
            Assert.Equal(2, opnieuw.Plaatsingen.Count);

            var grof = opnieuw.Plaatsingen.Single(p => p.BlokNiveau == Planningsblokniveau.Themaperiode);
            Assert.Equal(blokStart, grof.BlokStart);
            Assert.Equal(KoppelingStatus.Voorgesteld, grof.Status);
            Assert.Equal("seizoen past hier", grof.AiMotivatie);
            Assert.False(grof.Vergrendeld);

            // The lock survived storage — without this, `vergrendeld` would be a flag that quietly resets and E4's
            // regeneration would overwrite a thema the teacher pinned.
            var fijn = opnieuw.Plaatsingen.Single(p => p.BlokNiveau == Planningsblokniveau.Subthemaperiode);
            Assert.True(fijn.Vergrendeld);
            Assert.Equal(KoppelingStatus.Aanvaard, fijn.Status);
        }
    }

    /// <summary>
    /// The block key is stored as a real <c>date</c> and the two enums by name — legible in the database, and, more
    /// to the point, there is <b>no ordinal column at all</b> (ADR-0020 §3): the schema offers no way to persist an
    /// unstable key even by mistake.
    /// </summary>
    [PostgresFact]
    public async Task De_bloksleutel_is_een_datum_en_er_is_geen_ordinaalkolom()
    {
        var (klasId, themaId, blokStart) = await SeedAsync();

        await using (var context = _db.MaakContext())
        {
            var jaarplan = new Jaarplan(klasId);
            jaarplan.VoegPlaatsingToe(
                themaId, Planningsblokniveau.Themaperiode, blokStart, KoppelingStatus.Voorgesteld, "x");
            context.Jaarplannen.Add(jaarplan);
            await context.SaveChangesAsync();
        }

        await using (var context = _db.MaakContext())
        {
            var kolommen = await context.Database
                .SqlQueryRaw<string>(
                    """
                    SELECT column_name AS "Value" FROM information_schema.columns
                    WHERE table_name = 'themaplaatsingen' ORDER BY column_name
                    """)
                .ToListAsync();

            Assert.Contains("BlokStart", kolommen);
            Assert.DoesNotContain("Ordinaal", kolommen);
            Assert.DoesNotContain("BlokOrdinaal", kolommen);

            var type = await context.Database
                .SqlQueryRaw<string>(
                    """
                    SELECT data_type AS "Value" FROM information_schema.columns
                    WHERE table_name = 'themaplaatsingen' AND column_name = 'BlokStart'
                    """)
                .SingleAsync();
            Assert.Equal("date", type);

            var niveaus = await context.Database
                .SqlQueryRaw<string>("""SELECT "BlokNiveau" AS "Value" FROM themaplaatsingen""")
                .ToListAsync();
            Assert.Equal(["Themaperiode"], niveaus);

            var statussen = await context.Database
                .SqlQueryRaw<string>("""SELECT "Status" AS "Value" FROM themaplaatsingen""")
                .ToListAsync();
            Assert.Equal(["Voorgesteld"], statussen);
        }
    }

    /// <summary>
    /// <b>A placement added to an ALREADY PERSISTED plan is inserted, not "updated".</b> This pins a real defect found
    /// on 2026-07-30 while building E3-04's persistence half: <c>Themaplaatsing.Id</c> is assigned in the constructor,
    /// and EF's default <c>OnAdd</c> value generation on a Guid key makes <c>DetectChanges</c> read "the key is already
    /// set" as "this row already exists". A brand-new placement on a loaded <see cref="Jaarplan"/> was therefore tracked
    /// as <c>Modified</c>, and <c>SaveChanges</c> issued an UPDATE for a row that did not exist:
    /// <c>DbUpdateConcurrencyException: Attempted to update or delete an entity that does not exist in the store</c>. The
    /// key is now <c>ValueGeneratedNever</c>.
    /// <para>
    /// <b>Why it was invisible.</b> Every green path so far either created the plan and its placements in one
    /// <c>SaveChanges</c>, or regenerated with an AI answer that added nothing (empty, refused or duplicate). A second
    /// generation run that actually adds a thema — the ordinary FR-8 case, and the case E3-04's kept parameters exist
    /// for — was never exercised. That is the whole lesson: the flow nobody tested was not an edge case, it was the
    /// second time a teacher presses the button.
    /// </para>
    /// </summary>
    [PostgresFact]
    public async Task Een_plaatsing_toevoegen_aan_een_bestaand_plan_slaagt()
    {
        var (klasId, themaId, blokStart) = await SeedAsync();

        await using (var context = _db.MaakContext())
        {
            var jaarplan = new Jaarplan(klasId);
            jaarplan.VoegPlaatsingToe(
                themaId, Planningsblokniveau.Themaperiode, blokStart, KoppelingStatus.Voorgesteld, "eerste run");
            context.Jaarplannen.Add(jaarplan);
            await context.SaveChangesAsync();
        }

        await using (var context = _db.MaakContext())
        {
            // The second run: the plan already exists in the database and gains a placement.
            var jaarplan = await context.Jaarplannen.SingleAsync();
            jaarplan.VoegPlaatsingToe(
                themaId, Planningsblokniveau.Themaperiode, blokStart.AddDays(70), KoppelingStatus.Voorgesteld, "tweede run");
            await context.SaveChangesAsync();
        }

        await using (var context = _db.MaakContext())
        {
            var jaarplan = await context.Jaarplannen.SingleAsync();
            Assert.Equal(2, jaarplan.Plaatsingen.Count);
            Assert.Contains(jaarplan.Plaatsingen, p => p.AiMotivatie == "tweede run");

            var aantal = await context.Database
                .SqlQueryRaw<int>("""SELECT COUNT(*)::int AS "Value" FROM themaplaatsingen""")
                .SingleAsync();
            Assert.Equal(2, aantal);
        }
    }

    /// <summary>
    /// <b>E4-06 / FR-8.4, on the real stack: a locked placement survives a full regeneration while an unlocked
    /// proposal beside it is replaced.</b>
    /// <para>
    /// The unit suite already pins the rule in <c>JaarplanGeneratieServiceTests.Hergeneratie_behoudt_vergrendelde_en_besliste_plaatsingen</c>,
    /// against a fake storage port that models no EF at all, and <c>JaarplanEndpointsTests.Beslissing_en_vergrendeling_overleven_een_herlaad</c>
    /// drives the endpoints over the in-memory provider. Neither proves this. The fake keeps the aggregate in a field,
    /// so "the placement survived" cannot fail there; and the endpoint test locks a placement it has <i>also</i> accepted
    /// and then regenerates with an <b>empty</b> AI answer, so <see cref="Themaplaatsing.Vergrendeld"/> is not the
    /// variable under test in either direction: the placement would have survived on its status alone, and nothing was
    /// proposed that could have displaced it.
    /// </para>
    /// <para>
    /// So this test isolates the flag. Both placements are <c>Voorgesteld</c> and differ <b>only</b> in the lock, and the
    /// model answers with a real plan, so the run genuinely discards one of the two. And it runs against real Postgres
    /// because the discard is a removal from an <i>owned collection</i>: the in-memory provider can accept that with no
    /// DELETE ever reaching a table, which is the exact class of defect this file exists for. Asserted on the rows, not
    /// only on the aggregate.
    /// </para>
    /// <para>
    /// <b>Full regeneration only.</b> Per-period regeneration is E4-05 and does not exist — <c>GenereerAsync</c> takes no
    /// period scope — so nothing here claims the partial half of FR-8.4.
    /// </para>
    /// </summary>
    [PostgresFact]
    public async Task Een_vergrendeld_voorstel_overleeft_een_volledige_hergeneratie()
    {
        var (klasId, vastThemaId, losThemaId, losThemaNaam) = await SeedTweeThemasAsync();
        var blokken = Blokken(await LaadSchooljaarAsync(klasId));
        Guid vastId;
        Guid losId;

        await using (var context = _db.MaakContext())
        {
            var jaarplan = new Jaarplan(klasId);

            // The two differ in ONE bit. Same status, same tier, both AI proposals.
            var vast = jaarplan.VoegPlaatsingToe(
                vastThemaId, Planningsblokniveau.Themaperiode, blokken[0].Start, KoppelingStatus.Voorgesteld, "vastgezet");
            vast.StelVergrendelingIn(true);

            var los = jaarplan.VoegPlaatsingToe(
                losThemaId, Planningsblokniveau.Themaperiode, blokken[1].Start, KoppelingStatus.Voorgesteld, "los voorstel");

            context.Jaarplannen.Add(jaarplan);
            await context.SaveChangesAsync();
            vastId = vast.Id;
            losId = los.Id;
        }

        await using (var context = _db.MaakContext())
        {
            // The production service on the production storage port; only the model is stubbed (Art. IV.6). It proposes
            // the loose thema in a THIRD period, so the run has something to place and something to discard.
            var service = new JaarplanGeneratieService(
                new VastAntwoordAiClient(
                    $$"""
                    {"plaatsingen":[{"blokStart":"{{blokken[2].Start:yyyy-MM-dd}}","thema":"{{losThemaNaam}}","motivatie":"nieuw voorstel"}]}
                    """),
                new GeconfigureerdePlanningsblokIndeling(new PlanningsblokOptions()),
                new EfJaarplanOpslag(context));

            var resultaat = await service.GenereerAsync(klasId);

            Assert.True(resultaat.IsGeslaagd);
            Assert.Equal(1, resultaat.AantalNieuw);

            // Exactly one placement was kept, and exactly one was thrown away — the lock is the only reason either way.
            Assert.Equal(1, resultaat.AantalBehouden);
            Assert.Equal(1, resultaat.AantalVervangen);
        }

        await using (var context = _db.MaakContext())
        {
            var jaarplan = await context.Jaarplannen.SingleAsync(j => j.KlasId == klasId);

            // The locked one is untouched: same id, same period, still locked, still carrying its motivation.
            var vast = jaarplan.VindPlaatsing(vastId);
            Assert.NotNull(vast);
            Assert.Equal(blokken[0].Start, vast!.BlokStart);
            Assert.True(vast.Vergrendeld);
            Assert.Equal(KoppelingStatus.Voorgesteld, vast.Status);
            Assert.Equal("vastgezet", vast.AiMotivatie);

            // The unlocked twin is gone, and gone from the TABLE — an owned element dropped from its parent's backing
            // list is exactly what the in-memory provider can appear to accept without issuing a DELETE.
            Assert.Null(jaarplan.VindPlaatsing(losId));
            var overlevendeIds = await context.Database
                .SqlQueryRaw<Guid>("""SELECT "Id" AS "Value" FROM themaplaatsingen""")
                .ToListAsync();
            Assert.Contains(vastId, overlevendeIds);
            Assert.DoesNotContain(losId, overlevendeIds);

            // And the run's own proposal landed, as an unlocked `voorgesteld` one (Art. IV.1/IV.2).
            var nieuw = Assert.Single(jaarplan.Plaatsingen, p => p.Id != vastId);
            Assert.Equal(blokken[2].Start, nieuw.BlokStart);
            Assert.False(nieuw.Vergrendeld);
            Assert.Equal(KoppelingStatus.Voorgesteld, nieuw.Status);
        }
    }

    /// <summary>
    /// <b>E4-03 / FR-7.2 on the real stack: a class with no jaarplan at all gets one from a hand-placement, and the AI
    /// is never reached.</b>
    /// <para>
    /// This is the case the unit suite cannot honestly verify, and E7-16 is the story that says so. Two distinct things
    /// happen in one <c>SaveChanges</c> here: a new <see cref="Jaarplan"/> is inserted <i>and</i> an owned
    /// <see cref="Themaplaatsing"/> is inserted with it, through <c>IJaarplanOpslag.VoegJaarplanToe</c> on a class that
    /// had no row. The fake storage port keeps the aggregate in a field, so "it was created" cannot fail there; and the
    /// Guid key on the owned element is the exact spot where <c>ValueGenerated.Never</c> is load-bearing (see
    /// <see cref="Een_plaatsing_toevoegen_aan_een_bestaand_plan_slaagt"/> for the defect that taught this project so).
    /// </para>
    /// <para>
    /// <b>The AI client throws rather than counting.</b> "Los van de AI" is the requirement, so the strongest available
    /// statement is a stack in which any model call fails the test outright, on the production service over the
    /// production storage port. Asserted on the rows, not only on the aggregate.
    /// </para>
    /// </summary>
    [PostgresFact]
    public async Task Een_handmatige_plaatsing_maakt_het_jaarplan_en_haar_rij_zonder_ai()
    {
        var (klasId, themaId, blokStart) = await SeedAsync();

        // The precondition, asserted rather than assumed: no plan exists for this class.
        await using (var context = _db.MaakContext())
        {
            Assert.Empty(await context.Jaarplannen.Where(j => j.KlasId == klasId).ToListAsync());
        }

        await using (var context = _db.MaakContext())
        {
            var weergave = await MaakService(context).VoegPlaatsingToeAsync(klasId, themaId, blokStart);

            var geplaatst = Assert.Single(weergave.Plaatsingen);
            Assert.Equal("Manueel", geplaatst.Status);
            Assert.Null(geplaatst.AiMotivatie);
        }

        await using (var context = _db.MaakContext())
        {
            // The plan itself was created by the hand-placement.
            var jaarplan = await context.Jaarplannen.SingleAsync(j => j.KlasId == klasId);
            var plaatsing = Assert.Single(jaarplan.Plaatsingen);
            Assert.Equal(themaId, plaatsing.ThemaId);
            Assert.Equal(blokStart, plaatsing.BlokStart);
            Assert.Equal(Planningsblokniveau.Themaperiode, plaatsing.BlokNiveau);
            Assert.Equal(KoppelingStatus.Manueel, plaatsing.Status);
            Assert.Null(plaatsing.AiMotivatie);
            Assert.False(plaatsing.Vergrendeld);

            // And the INSERT really reached the table, with the status stored as a name and no motivation column value.
            var rijen = await context.Database
                .SqlQueryRaw<string>("""SELECT "Status" AS "Value" FROM themaplaatsingen""")
                .ToListAsync();
            Assert.Equal(["Manueel"], rijen);

            var zonderMotivatie = await context.Database
                .SqlQueryRaw<int>(
                    """SELECT COUNT(*)::int AS "Value" FROM themaplaatsingen WHERE "AiMotivatie" IS NULL""")
                .SingleAsync();
            Assert.Equal(1, zonderMotivatie);
        }
    }

    /// <summary>
    /// A <b>second</b> hand-placement, onto a plan that is already in the database. Separated from the test above
    /// because it exercises a different EF path — growing an already-persisted aggregate rather than inserting a fresh
    /// one — and that is precisely the path whose failure (<c>DbUpdateConcurrencyException</c>) shipped to <c>main</c>
    /// once already while every in-memory test stayed green.
    /// </summary>
    [PostgresFact]
    public async Task Een_tweede_handmatige_plaatsing_op_een_bestaand_plan_wordt_ingevoegd()
    {
        var (klasId, themaId, _) = await SeedAsync();
        var blokken = Blokken(await LaadSchooljaarAsync(klasId));

        await using (var context = _db.MaakContext())
        {
            await MaakService(context).VoegPlaatsingToeAsync(klasId, themaId, blokken[0].Start);
        }

        await using (var context = _db.MaakContext())
        {
            // A different period, same thema: allowed, and it lands on a plan that already has a row.
            var weergave = await MaakService(context).VoegPlaatsingToeAsync(klasId, themaId, blokken[2].Start);
            Assert.Equal(2, weergave.Plaatsingen.Count);
        }

        await using (var context = _db.MaakContext())
        {
            var jaarplan = await context.Jaarplannen.SingleAsync(j => j.KlasId == klasId);
            Assert.Equal(2, jaarplan.Plaatsingen.Count);
            Assert.All(jaarplan.Plaatsingen, p => Assert.Equal(KoppelingStatus.Manueel, p.Status));

            var aantal = await context.Database
                .SqlQueryRaw<int>("""SELECT COUNT(*)::int AS "Value" FROM themaplaatsingen""")
                .SingleAsync();
            Assert.Equal(2, aantal);
        }
    }

    /// <summary>Art. IX.3: a Klas "has one Jaarplan" — enforced by the database, not merely by the service.</summary>
    [PostgresFact]
    public async Task Een_klas_heeft_ten_hoogste_een_jaarplan()
    {
        var (klasId, _, _) = await SeedAsync();

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

    /// <summary>The same thema cannot be placed twice in the same block — the domain invariant, held in the database.</summary>
    [PostgresFact]
    public async Task Dezelfde_plaatsing_kan_niet_twee_keer_bestaan()
    {
        var (klasId, themaId, blokStart) = await SeedAsync();
        Guid jaarplanId;

        await using (var context = _db.MaakContext())
        {
            var jaarplan = new Jaarplan(klasId);
            jaarplan.VoegPlaatsingToe(
                themaId, Planningsblokniveau.Themaperiode, blokStart, KoppelingStatus.Voorgesteld, "eerste");
            context.Jaarplannen.Add(jaarplan);
            await context.SaveChangesAsync();
            jaarplanId = jaarplan.Id;
        }

        await using (var context = _db.MaakContext())
        {
            // Inserted around the aggregate on purpose: the point is that the DATABASE refuses it, not the entity.
            var ex = await Assert.ThrowsAsync<Npgsql.PostgresException>(() => context.Database.ExecuteSqlRawAsync(
                """
                INSERT INTO themaplaatsingen ("Id", "JaarplanId", "ThemaId", "BlokNiveau", "BlokStart", "Status", "Vergrendeld")
                VALUES ({0}, {1}, {2}, 'Themaperiode', {3}, 'Voorgesteld', false)
                """.Replace("{0}", $"'{Guid.NewGuid()}'")
                   .Replace("{1}", $"'{jaarplanId}'")
                   .Replace("{2}", $"'{themaId}'")
                   .Replace("{3}", $"'{blokStart:yyyy-MM-dd}'")));

            Assert.Equal("23505", ex.SqlState);
        }
    }

    /// <summary>
    /// Removing one placement actually deletes its <b>row</b>, and leaves the rest of the plan alone. Asserted against
    /// real Postgres because an owned-collection element removed from its parent's backing list is exactly the kind of
    /// change the in-memory provider can appear to accept without a corresponding DELETE reaching a database.
    /// </summary>
    [PostgresFact]
    public async Task Een_plaatsing_verwijderen_verwijdert_haar_rij()
    {
        var (klasId, themaId, blokStart) = await SeedAsync();
        Guid teVerwijderen;

        await using (var context = _db.MaakContext())
        {
            var jaarplan = new Jaarplan(klasId);
            var eerste = jaarplan.VoegPlaatsingToe(
                themaId, Planningsblokniveau.Themaperiode, blokStart, KoppelingStatus.Aanvaard, "aanvaard");
            eerste.StelVergrendelingIn(true);
            jaarplan.VoegPlaatsingToe(
                themaId, Planningsblokniveau.Subthemaperiode, blokStart, KoppelingStatus.Voorgesteld, "blijft");

            context.Jaarplannen.Add(jaarplan);
            await context.SaveChangesAsync();
            teVerwijderen = eerste.Id;
        }

        await using (var context = _db.MaakContext())
        {
            var jaarplan = await context.Jaarplannen.SingleAsync();

            // Accepted AND locked — removal is an explicit human act and must not be blocked by either (Art. IV.2).
            jaarplan.VerwijderPlaatsing(jaarplan.VindPlaatsing(teVerwijderen)!);
            await context.SaveChangesAsync();
        }

        await using (var context = _db.MaakContext())
        {
            var jaarplan = await context.Jaarplannen.SingleAsync();
            var overgebleven = Assert.Single(jaarplan.Plaatsingen);
            Assert.Equal(Planningsblokniveau.Subthemaperiode, overgebleven.BlokNiveau);
            Assert.Null(jaarplan.VindPlaatsing(teVerwijderen));

            // One row, not two — the DELETE really reached the table.
            var aantal = await context.Database
                .SqlQueryRaw<int>("""SELECT COUNT(*)::int AS "Value" FROM themaplaatsingen""")
                .SingleAsync();
            Assert.Equal(1, aantal);
        }
    }

    /// <summary>
    /// A thema still placed in a jaarplan cannot be deleted: the RESTRICT FK on <c>themaplaatsingen.ThemaId</c> is
    /// real. This is the database half of the guard added to <c>SchoolcontentBeheerService.VerwijderThemaAsync</c> —
    /// the guard exists to turn this <c>23503</c> into an actionable 400 instead of an unhandled 500.
    /// </summary>
    [PostgresFact]
    public async Task Een_geplaatst_thema_kan_niet_uit_de_database_verwijderd_worden()
    {
        var (klasId, themaId, blokStart) = await SeedAsync();

        await using (var context = _db.MaakContext())
        {
            var jaarplan = new Jaarplan(klasId);
            jaarplan.VoegPlaatsingToe(
                themaId, Planningsblokniveau.Themaperiode, blokStart, KoppelingStatus.Voorgesteld, "voorstel");
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
        var (klasId, themaId, blokStart) = await SeedAsync();

        await using (var context = _db.MaakContext())
        {
            var jaarplan = new Jaarplan(klasId);
            jaarplan.VoegPlaatsingToe(
                themaId, Planningsblokniveau.Themaperiode, blokStart, KoppelingStatus.Voorgesteld, "x");
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
            var resterend = await context.Database
                .SqlQueryRaw<int>("""SELECT COUNT(*)::int AS "Value" FROM themaplaatsingen""")
                .SingleAsync();
            Assert.Equal(0, resterend);
        }
    }

    /// <summary>
    /// The relational cascade itself: deleting the <b>klas</b> row removes its jaarplan and every placement. This is
    /// the destructive behaviour <c>KlasBeheerService.VerwijderKlasAsync</c> guards against for reviewed/locked
    /// placements, and it is asserted here around the service on purpose — the guard is only worth having if the
    /// cascade underneath it is real, and the in-memory provider enforces no FK at all so it cannot show this.
    /// <para>
    /// Note the earlier <c>Verwijderen_neemt_de_plaatsingen_mee</c> deletes the <i>jaarplan</i>, never the
    /// <i>klas</i> — which is exactly why the silent-destruction defect went unnoticed.
    /// </para>
    /// </summary>
    [PostgresFact]
    public async Task Een_klas_verwijderen_neemt_haar_jaarplan_en_plaatsingen_mee()
    {
        var (klasId, themaId, blokStart) = await SeedAsync();

        await using (var context = _db.MaakContext())
        {
            var jaarplan = new Jaarplan(klasId);
            jaarplan.VoegPlaatsingToe(
                themaId, Planningsblokniveau.Themaperiode, blokStart, KoppelingStatus.Voorgesteld, "voorstel");
            context.Jaarplannen.Add(jaarplan);
            await context.SaveChangesAsync();
        }

        await using (var context = _db.MaakContext())
        {
            // Raw DELETE, so the database's own ON DELETE CASCADE is what is under test — not EF's change tracker.
            //
            // NOTE the interpolation hole carries NO surrounding quotes. ExecuteSqlAsync takes a FormattableString
            // and turns every hole into a DbParameter, splicing the placeholder NAME into the SQL. Quoting it would
            // emit `WHERE "Id" = '@p0'` — a text literal — which Postgres rejects with 22P02 (invalid input syntax
            // for type uuid: "@p0"), so the assertion below would never be reached. The first version of this test
            // had exactly that bug and could never have passed in CI.
            var verwijderd = await context.Database.ExecuteSqlAsync(
                $"""DELETE FROM klassen WHERE "Id" = {klasId}""");
            Assert.Equal(1, verwijderd);
        }

        await using (var context = _db.MaakContext())
        {
            Assert.Empty(await context.Jaarplannen.Where(j => j.KlasId == klasId).ToListAsync());

            var resterend = await context.Database
                .SqlQueryRaw<int>("""SELECT COUNT(*)::int AS "Value" FROM themaplaatsingen""")
                .SingleAsync();
            Assert.Equal(0, resterend);
        }
    }

    /// <summary>
    /// Art. IX.3's "Schooljaar contains multiple klassen", as a real FK: a class cannot exist without a school year,
    /// the containment loads back, and deleting the year is <b>refused</b> while it still holds classes rather than
    /// cascading away a class, its jaarplan and its school content.
    /// </summary>
    [PostgresFact]
    public async Task Een_schooljaar_bevat_klassen_en_kan_niet_zomaar_verdwijnen()
    {
        Guid schooljaarId;

        await using (var context = _db.MaakContext())
        {
            var schooljaar = TestSchooljaar.MetVakanties(TestSchooljaar.UniekeNaam("containment"));
            schooljaar.VoegKlasToe($"L1-{Guid.NewGuid():N}", leerjaar: 1);
            schooljaar.VoegKlasToe($"L2-{Guid.NewGuid():N}", leerjaar: 2);
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
        context.Klassen.Add(new Klas(Guid.NewGuid(), $"Zwevend-{Guid.NewGuid():N}", 3));

        var ex = await Assert.ThrowsAsync<DbUpdateException>(() => context.SaveChangesAsync());
        Assert.Equal("23503", Assert.IsType<Npgsql.PostgresException>(ex.InnerException).SqlState);
    }

    /// <summary>
    /// Seeds a school year, a class inside it, a leerplandoel and a thema, and returns (klasId, themaId, the first
    /// derived themaperiode's start date). The start date is taken from the year's own first teaching day, which the
    /// E3-05 suite pins as the first block's start.
    /// </summary>

    /// <summary>
    /// <b>E3-09 / FR-6.4 on the real stack: the te-vol figures reach the plain jaarplan read.</b>
    /// <para>
    /// This is the change most able to be silently wrong, because it is a payload field. Before E3-09 the weeks
    /// arithmetic existed only on the <i>generation</i> response, while the board renders from this read plus
    /// <c>/rooster</c> — which is why the kalender carried a threshold of its own that counted thema's and disagreed
    /// with the server for months. If <c>Blokken</c> arrives empty here, the board silently flags nothing and every
    /// frontend test still passes on its own fixture.
    /// </para>
    /// <para>
    /// Read through <c>HaalJaarplanAsync</c> on a fresh context, so the placements come back out of Postgres rather
    /// than out of the tracker that wrote them.
    /// </para>
    /// </summary>
    [PostgresFact]
    public async Task Het_leespad_levert_de_belasting_per_periode()
    {
        var (klasId, themaId, blokStart) = await SeedAsync();
        var schooljaar = await LaadSchooljaarAsync(klasId);
        var blokken = Blokken(schooljaar);

        // Two placements of the seeded 5-week thema: one in the first period, one in the second. 5 weeks against a
        // 4-to-6-week period is not te vol, which makes the negative half of the assertion meaningful.
        await using (var context = _db.MaakContext())
        {
            var jaarplan = new Jaarplan(klasId);
            jaarplan.VoegPlaatsingToe(
                themaId, Planningsblokniveau.Themaperiode, blokStart, KoppelingStatus.Aanvaard, "eerste");
            jaarplan.VoegPlaatsingToe(
                themaId, Planningsblokniveau.Themaperiode, blokken[1].Start, KoppelingStatus.Voorgesteld, "tweede");
            context.Jaarplannen.Add(jaarplan);
            await context.SaveChangesAsync();
        }

        await using (var context = _db.MaakContext())
        {
            var weergave = await MaakService(context).HaalJaarplanAsync(klasId);

            // Every period of the year is described, not only the filled ones: an empty period is where there is room.
            Assert.Equal(blokken.Count, weergave.Blokken.Count);
            Assert.Equal(
                blokken.Select(b => b.Start),
                weergave.Blokken.Select(b => b.Start));

            var eerste = weergave.Blokken.Single(b => b.Start == blokStart);
            Assert.Equal(5, eerste.BenodigdeWeken);
            Assert.True(eerste.BeschikbareWeken >= 4, $"a themaperiode offers 4-6 weeks, got {eerste.BeschikbareWeken}");
            Assert.False(eerste.IsOverbelast);

            // The thema's own length rides along on the placement, which is what lets the board predict a drop before
            // it happens rather than only report it afterwards.
            Assert.All(weergave.Plaatsingen, p => Assert.Equal(5, p.DuurWeken));

            // A period holding nothing needs no weeks. Stated because "0 needed" is what makes `IsOverbelast` false for
            // an empty period, and a null-ish default would have made every empty period te vol or none of them.
            var leeg = weergave.Blokken.First(b => b.AantalThemas == 0);
            Assert.Equal(0, leeg.BenodigdeWeken);
            Assert.False(leeg.IsOverbelast);
        }
    }

    /// <summary>
    /// A period is te vol on the read path too, and a <b>rejected</b> thema does not make it so.
    /// <para>
    /// Both halves in one test on purpose: they are the same arithmetic seen from either side, and separating them
    /// would let a filter defect pass whichever one was written first. The rejected placement is the one this project
    /// has already got wrong once, in the E3-02 code review, where a period was reported overbelast on the strength of
    /// a thema the teacher had thrown out.
    /// </para>
    /// </summary>
    [PostgresFact]
    public async Task Een_geweigerd_thema_maakt_een_periode_niet_te_vol_op_het_leespad()
    {
        var (klasId, _, blokStart) = await SeedAsync();
        Guid zwaarId;
        Guid geweigerdId;

        // 4 + 8 = 12 weeks in one period. The durations straddle the period's own length deliberately: the default
        // themaperiode is 5 weeks, so together they are over it and the surviving 4-week thema is comfortably under.
        // An earlier revision used 6 and 6, which left 6 weeks in a 5-week period after the rejection and so still
        // reported te vol — the test failed while the filter it was testing worked perfectly.
        await using (var context = _db.MaakContext())
        {
            var zwaar = new Thema($"Licht-{Guid.NewGuid():N}", duurWeken: 4);
            var geweigerd = new Thema($"Feesten-{Guid.NewGuid():N}", duurWeken: 8);
            context.Themas.AddRange(zwaar, geweigerd);
            await context.SaveChangesAsync();
            zwaarId = zwaar.Id;
            geweigerdId = geweigerd.Id;
        }

        await using (var context = _db.MaakContext())
        {
            var jaarplan = new Jaarplan(klasId);
            jaarplan.VoegPlaatsingToe(
                zwaarId, Planningsblokniveau.Themaperiode, blokStart, KoppelingStatus.Aanvaard, "zwaar");
            jaarplan.VoegPlaatsingToe(
                geweigerdId, Planningsblokniveau.Themaperiode, blokStart, KoppelingStatus.Voorgesteld, "ook zwaar");
            context.Jaarplannen.Add(jaarplan);
            await context.SaveChangesAsync();
        }

        // Both counted: 12 weeks in a period that offers 4 to 6.
        await using (var context = _db.MaakContext())
        {
            var blok = (await MaakService(context).HaalJaarplanAsync(klasId))
                .Blokken.Single(b => b.Start == blokStart);

            Assert.Equal(12, blok.BenodigdeWeken);
            Assert.True(blok.IsOverbelast);

            // Pinned rather than assumed, because the two durations above are chosen relative to it: if the configured
            // grain ever changes, this fails here with the reason instead of further down as a puzzling verdict.
            Assert.InRange(blok.BeschikbareWeken, 4, 6);
        }

        // The teacher rejects one. Nothing is taught in this period on its account, so the period stops being te vol.
        await using (var context = _db.MaakContext())
        {
            var jaarplan = await context.Jaarplannen.SingleAsync(j => j.KlasId == klasId);
            var plaatsing = jaarplan.Plaatsingen.Single(p => p.ThemaId == geweigerdId);
            await MaakService(context).WijzigPlaatsingStatusAsync(klasId, plaatsing.Id, KoppelingStatus.Geweigerd);
        }

        await using (var context = _db.MaakContext())
        {
            var weergave = await MaakService(context).HaalJaarplanAsync(klasId);
            var blok = weergave.Blokken.Single(b => b.Start == blokStart);

            Assert.Equal(4, blok.BenodigdeWeken);
            Assert.False(blok.IsOverbelast);

            // And the rejected card is still THERE — excluded from the arithmetic, not deleted from the plan. A human
            // decision is not the tool's to discard (Art. IV.1), and a teacher must be able to see what they threw out.
            Assert.Equal(2, weergave.Plaatsingen.Count);
            Assert.Contains(weergave.Plaatsingen, p => p.Status == "Geweigerd");
        }
    }

    private async Task<(Guid KlasId, Guid ThemaId, DateOnly BlokStart)> SeedAsync()
    {
        await using var context = _db.MaakContext();

        var schooljaar = TestSchooljaar.MetVakanties(TestSchooljaar.UniekeNaam("jaarplan"));
        var klas = schooljaar.VoegKlasToe($"L3-{Guid.NewGuid():N}", leerjaar: 3);
        context.Schooljaren.Add(schooljaar);

        var code = $"NAT-{Guid.NewGuid():N}"[..16];
        context.Leerplandoelen.Add(new Leerplandoel(
            code, Doelsoort.Minimumdoel, "K3", "Natuur", "Levende natuur", "3", tekst: "herkent bomen."));

        var thema = new Thema($"Herfst-{Guid.NewGuid():N}", duurWeken: 5);
        thema.VoegThemadoelToe(new DoelKoppeling(code, KoppelingStatus.Aanvaard, "anchor"));
        context.Themas.Add(thema);

        await context.SaveChangesAsync();

        return (klas.Id, thema.Id, schooljaar.Start);
    }

    /// <summary>
    /// Seeds a school year, a class inside it and <b>two</b> thema's, and returns the loose one's <i>name</i> as well as
    /// its id: the generation contract keys a proposal on the thema name (never an id, which no model can know), so the
    /// stubbed answer below has to speak that name. Names carry a guid because thema names are unique school-wide.
    /// </summary>
    private async Task<(Guid KlasId, Guid VastThemaId, Guid LosThemaId, string LosThemaNaam)> SeedTweeThemasAsync()
    {
        await using var context = _db.MaakContext();

        var schooljaar = TestSchooljaar.MetVakanties(TestSchooljaar.UniekeNaam("slot"));
        var klas = schooljaar.VoegKlasToe($"L3-{Guid.NewGuid():N}", leerjaar: 3);
        context.Schooljaren.Add(schooljaar);

        var vast = new Thema($"Herfst-{Guid.NewGuid():N}", duurWeken: 5);
        var los = new Thema($"Water-{Guid.NewGuid():N}", duurWeken: 4);
        context.Themas.AddRange(vast, los);

        await context.SaveChangesAsync();

        return (klas.Id, vast.Id, los.Id, los.Naam);
    }

    /// <summary>Reloads the class's school year with its closures, so the derived grid matches what the service sees.</summary>
    private async Task<Schooljaar> LaadSchooljaarAsync(Guid klasId)
    {
        await using var context = _db.MaakContext();
        var klas = await context.Klassen.SingleAsync(k => k.Id == klasId);

        return await context.Schooljaren
            .Include("_sluitingen")
            .SingleAsync(s => s.Id == klas.SchooljaarId);
    }

    /// <summary>The same configured grid seam the API resolves, so the test never hard-codes a period boundary.</summary>
    private static IReadOnlyList<Planningsblok> Blokken(Schooljaar schooljaar) =>
        new GeconfigureerdePlanningsblokIndeling(new PlanningsblokOptions())
            .Blokken(schooljaar, Planningsblokniveau.Themaperiode);

    /// <summary>
    /// The production service over the production storage port, with a model that must never be called (E4-03). Used by
    /// the hand-placement tests, which are about a path where the AI has no part to play.
    /// </summary>
    private static JaarplanGeneratieService MaakService(Jaarplanner.Infrastructure.Persistence.AppDbContext context) =>
        new(new OntploffendeAiClient(),
            new GeconfigureerdePlanningsblokIndeling(new PlanningsblokOptions()),
            new EfJaarplanOpslag(context));

    /// <summary>
    /// An <see cref="IAiClient"/> that fails the test if it is reached at all. Stronger than counting calls: FR-7.2's
    /// "los van de AI" is a claim about the path, and a path that cannot tolerate a model call is the claim itself.
    /// </summary>
    private sealed class OntploffendeAiClient : IAiClient
    {
        public Task<AiCompletion> CompleteAsync(AiRequest request, CancellationToken cancellationToken = default) =>
            throw new InvalidOperationException(
                "The AI client was called on a path that must not involve the model (E4-03, FR-7.2).");
    }

    /// <summary>A model stand-in that always answers the same canned completion: no network (Art. IV.6).</summary>
    private sealed class VastAntwoordAiClient : IAiClient
    {
        private readonly string _antwoord;

        public VastAntwoordAiClient(string antwoord) => _antwoord = antwoord;

        public Task<AiCompletion> CompleteAsync(AiRequest request, CancellationToken cancellationToken = default) =>
            Task.FromResult(new AiCompletion { Content = _antwoord });
    }
}
