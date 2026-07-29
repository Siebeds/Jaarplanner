using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;
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
            var verwijderd = await context.Database.ExecuteSqlAsync(
                $"""DELETE FROM klassen WHERE "Id" = '{klasId}'""");
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
            var schooljaar = TestSchooljaar.MetVakanties($"containment-{Guid.NewGuid():N}");
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
    private async Task<(Guid KlasId, Guid ThemaId, DateOnly BlokStart)> SeedAsync()
    {
        await using var context = _db.MaakContext();

        var schooljaar = TestSchooljaar.MetVakanties($"jaarplan-{Guid.NewGuid():N}");
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
}
