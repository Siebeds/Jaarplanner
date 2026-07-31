using Jaarplanner.Application.Ai;
using Jaarplanner.Application.Planning;
using Jaarplanner.Application.Planning.Generatie;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.Infrastructure.Persistence;
using Jaarplanner.Infrastructure.Planning;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.IntegrationTests.Postgres;

/// <summary>
/// Persistence of <see cref="Generatieparameters"/> and its two owned collections against <b>real PostgreSQL</b>
/// (E3-04 persistence half, FR-5.4, Art. IX.3).
/// <para>
/// <b>Real Postgres and not the EF in-memory provider, deliberately.</b> Everything this story added that could go
/// wrong is something the in-memory provider does not implement: the <c>(KlasId, SchooljaarId)</c> unique index that
/// makes the school-year scoping a schema guarantee, the one-startthema-per-block unique index, the <c>DateOnly</c> →
/// <c>date</c> mapping of the block key, the cascade from <c>klassen</c>, and the <c>Restrict</c> FK to
/// <c>schooljaren</c>. The in-memory provider enforces none of them, and it has already let three defects through CI in
/// this repository.
/// </para>
/// </summary>
public sealed class GeneratieparametersPersistentieTests : IAsyncLifetime
{
    private PostgresTestDatabase _db = null!;

    public async Task InitializeAsync()
    {
        if (!PostgresTestDatabase.IsBeschikbaar)
        {
            return;
        }

        _db = await PostgresTestDatabase.MaakAsync("genparams");
    }

    public async Task DisposeAsync()
    {
        if (_db is not null)
        {
            await _db.DisposeAsync();
        }
    }

    /// <summary>
    /// The whole aggregate round-trips: the start thema's block <b>start date</b> and name, and each vast moment's name,
    /// date and blocking answer. This is the test that would have caught a settings row that saved but read back empty.
    /// </summary>
    [PostgresFact]
    public async Task Generatieparameters_met_startthemas_en_vaste_momenten_rondtripten()
    {
        var (klasId, schooljaarId, blokStart) = await SeedAsync();

        await using (var context = _db.MaakContext())
        {
            var parameters = new Generatieparameters(klasId, schooljaarId);
            parameters.Vervang(
                [
                    new BewaardStartthema(blokStart, "Herfst"),
                    new BewaardStartthema(blokStart.AddDays(40), "Water"),
                ],
                [
                    new BewaardVastMoment("Schoolfeest", blokStart.AddDays(3), blokkeertPlaatsing: true),
                    new BewaardVastMoment("Sportdag", blokStart.AddDays(10), blokkeertPlaatsing: false),
                ]);

            context.Generatieparameters.Add(parameters);
            await context.SaveChangesAsync();
        }

        await using (var context = _db.MaakContext())
        {
            var opnieuw = await context.Generatieparameters.SingleAsync();

            Assert.Equal(klasId, opnieuw.KlasId);
            Assert.Equal(schooljaarId, opnieuw.SchooljaarId);

            // Ordered by the stored key, so the form renders the year front to back after a reload.
            Assert.Equal([blokStart, blokStart.AddDays(40)], opnieuw.Startthemas.Select(s => s.BlokStart));
            Assert.Equal(["Herfst", "Water"], opnieuw.Startthemas.Select(s => s.ThemaNaam));

            var schoolfeest = opnieuw.VasteMomenten.Single(m => m.Naam == "Schoolfeest");
            Assert.Equal(blokStart.AddDays(3), schoolfeest.Datum);

            // The blocking answer survived storage. Without this, the one enforced parameter would quietly reset to the
            // weaker reading on every reload — the exact "indistinguishable from honoured" defect the request contract
            // returns a 400 to prevent.
            Assert.True(schoolfeest.BlokkeertPlaatsing);
            Assert.False(opnieuw.VasteMomenten.Single(m => m.Naam == "Sportdag").BlokkeertPlaatsing);
        }
    }

    /// <summary>
    /// The block key is a real <c>date</c> and there is <b>no ordinal column anywhere</b> (ADR-0020 §3): the schema
    /// offers no way to persist an unstable key even by mistake. Storing an ordinal would have been strictly worse than
    /// sending one, because it survives exactly the vakantie edits that invalidate it.
    /// </summary>
    [PostgresFact]
    public async Task De_bloksleutel_is_een_datum_en_er_is_geen_ordinaalkolom()
    {
        var (klasId, schooljaarId, blokStart) = await SeedAsync();

        await using (var context = _db.MaakContext())
        {
            var parameters = new Generatieparameters(klasId, schooljaarId);
            parameters.Vervang([new BewaardStartthema(blokStart, "Herfst")], []);
            context.Generatieparameters.Add(parameters);
            await context.SaveChangesAsync();
        }

        await using (var context = _db.MaakContext())
        {
            var kolommen = await context.Database
                .SqlQueryRaw<string>(
                    """
                    SELECT column_name AS "Value" FROM information_schema.columns
                    WHERE table_name = 'startthemavoorkeuren' ORDER BY column_name
                    """)
                .ToListAsync();

            Assert.Contains("BlokStart", kolommen);
            Assert.DoesNotContain("Ordinaal", kolommen);
            Assert.DoesNotContain("BlokOrdinaal", kolommen);
            Assert.DoesNotContain("Positie", kolommen);

            var type = await context.Database
                .SqlQueryRaw<string>(
                    """
                    SELECT data_type AS "Value" FROM information_schema.columns
                    WHERE table_name = 'startthemavoorkeuren' AND column_name = 'BlokStart'
                    """)
                .SingleAsync();
            Assert.Equal("date", type);
        }
    }

    /// <summary>
    /// One settings row per class per school year, enforced by the database. Two concurrent generation runs must not be
    /// able to leave a class with two sets of settings, one of which would then be read at random.
    /// </summary>
    [PostgresFact]
    public async Task Een_klas_heeft_per_schooljaar_ten_hoogste_een_set_parameters()
    {
        var (klasId, schooljaarId, _) = await SeedAsync();

        await using (var context = _db.MaakContext())
        {
            context.Generatieparameters.Add(new Generatieparameters(klasId, schooljaarId));
            await context.SaveChangesAsync();
        }

        await using (var context = _db.MaakContext())
        {
            context.Generatieparameters.Add(new Generatieparameters(klasId, schooljaarId));

            var ex = await Assert.ThrowsAsync<DbUpdateException>(() => context.SaveChangesAsync());
            Assert.Equal("23505", Assert.IsType<Npgsql.PostgresException>(ex.InnerException).SqlState);
        }
    }

    /// <summary>
    /// <b>And the storage port recovers from that refusal instead of letting it become a 500.</b> Two generation runs
    /// starting together both find no row and both insert one; the loser used to get a raw <c>23505</c> out of
    /// <c>SaveChanges</c>, surfacing as a 500 with an English detail on an ordinary second press.
    /// <para>
    /// Asserted against real Postgres because the whole mechanism is the database's: the index raises it, and what has to
    /// work afterwards is that the losing insert (owner <i>and</i> both owned collections) is detached so the same context
    /// can still load the winner's row and write to it.
    /// </para>
    /// </summary>
    [PostgresFact]
    public async Task Een_geweigerde_gelijktijdige_insert_laat_de_context_bruikbaar()
    {
        var (klasId, schooljaarId, blokStart) = await SeedAsync();

        // The run that got there first.
        await using (var context = _db.MaakContext())
        {
            var winnaar = new Generatieparameters(klasId, schooljaarId);
            winnaar.Vervang([new BewaardStartthema(blokStart, "Herfst")], []);
            context.Generatieparameters.Add(winnaar);
            await context.SaveChangesAsync();
        }

        await using (var context = _db.MaakContext())
        {
            var opslag = new EfJaarplanOpslag(context);

            // The loser: its own row, with its own owned children, refused by the unique index.
            var verloren = new Generatieparameters(klasId, schooljaarId);
            verloren.Vervang(
                [new BewaardStartthema(blokStart, "Water")],
                [new BewaardVastMoment("Sportdag", blokStart.AddDays(2), blokkeertPlaatsing: false)]);

            Assert.False(await opslag.ProbeerGeneratieparametersToeTeVoegenAsync(verloren));

            // The context survived it: the winner's row loads, and the loser's settings can be written into it.
            var bestaand = await opslag.LaadGeneratieparametersAsync(klasId, schooljaarId);
            Assert.NotNull(bestaand);
            bestaand!.Vervang(
                [new BewaardStartthema(blokStart, "Water")],
                [new BewaardVastMoment("Sportdag", blokStart.AddDays(2), blokkeertPlaatsing: false)]);
            await opslag.BewaarAsync();
        }

        await using (var context = _db.MaakContext())
        {
            // One row, holding what the losing run asked for: last write wins, as two runs a second apart behave.
            var enige = await context.Generatieparameters.SingleAsync();
            Assert.Equal("Water", Assert.Single(enige.Startthemas).ThemaNaam);
            Assert.Equal("Sportdag", Assert.Single(enige.VasteMomenten).Naam);
        }
    }

    /// <summary>
    /// <b>The composition: the service's loser branch running on the real <see cref="EfJaarplanOpslag"/> against real
    /// Postgres.</b>
    /// <para>
    /// The two tests around it each cover one half and never meet: the unit test drives
    /// <c>JaarplanGeneratieService.BewaarParametersAsync</c> against a fake that models no EF at all, and
    /// <see cref="Een_geweigerde_gelijktijdige_insert_laat_de_context_bruikbaar"/> exercises the real EF sequence but
    /// <i>reproduces</i> the service's four calls in test code instead of calling it. So the combination had never
    /// executed, which is exactly the gap this repository has paid for twice (a green suite whose second-save path was
    /// never run).
    /// </para>
    /// <para>
    /// <b>How the race is made deterministic:</b> a decorator delegates every call to the real port, and on the first
    /// <c>LaadGeneratieparametersAsync</c> that returns <c>null</c> it inserts the winner's row through a <i>separate</i>
    /// context. That is precisely the interleaving the race needs, and nothing about the code under test is faked: the
    /// insert below hits the real unique index, <c>IsUniekeSleutelSchending</c> reads a real <c>23505</c> (so this test
    /// also fails if that predicate ever stops matching the settings table), the detach runs on a real change tracker,
    /// and the reload plus <c>Vervang</c> writes real rows.
    /// </para>
    /// </summary>
    [PostgresFact]
    public async Task De_service_overleeft_de_verloren_race_op_de_echte_opslag()
    {
        var (klasId, schooljaarId, blokStart) = await SeedAsync();

        await using var context = _db.MaakContext();
        var echteOpslag = new EfJaarplanOpslag(context);
        var winnaar = new Generatieparameters(klasId, schooljaarId);
        winnaar.Vervang([new BewaardStartthema(blokStart, "Herfst")], []);

        var opslag = new GelijktijdigeRunOpslag(echteOpslag, winnaar, () => _db.MaakContext());
        var service = new JaarplanGeneratieService(
            new LeegAntwoordAiClient(),
            new GeconfigureerdePlanningsblokIndeling(new PlanningsblokOptions()),
            opslag);

        // The full generation call, i.e. the production path: validate, persist the settings, then the model.
        var resultaat = await service.GenereerAsync(
            klasId,
            new JaarplanGeneratieParameters
            {
                GewensteStartthemas = [new Startthemakeuze(blokStart, "Water")],
                VasteMomenten = [new VastMoment("Sportdag", blokStart.AddDays(2), false)],
            });

        Assert.True(resultaat.IsGeslaagd);
        Assert.True(opslag.WinnaarIsGeschreven, "the concurrent run never got its row in, so no race was exercised");

        await using (var opnieuw = _db.MaakContext())
        {
            // One row, holding what the LOSING run asked for: last write wins, exactly as two runs a second apart
            // behave. Nothing it sent was dropped, including its vast moment.
            var enige = await opnieuw.Generatieparameters.SingleAsync();
            var startthema = Assert.Single(enige.Startthemas);
            Assert.Equal(blokStart, startthema.BlokStart);
            Assert.Equal("Water", startthema.ThemaNaam);
            Assert.Equal("Sportdag", Assert.Single(enige.VasteMomenten).Naam);
        }
    }

    /// <summary>
    /// The real port, with one concurrent run spliced into the race window: the first
    /// <see cref="LaadGeneratieparametersAsync"/> that finds nothing inserts the winner's row on another connection
    /// before answering <c>null</c>. Everything else delegates.
    /// </summary>
    private sealed class GelijktijdigeRunOpslag : IJaarplanOpslag
    {
        private readonly IJaarplanOpslag _binnen;
        private readonly Generatieparameters _winnaar;
        private readonly Func<AppDbContext> _andereVerbinding;

        public GelijktijdigeRunOpslag(
            IJaarplanOpslag binnen,
            Generatieparameters winnaar,
            Func<AppDbContext> andereVerbinding)
        {
            _binnen = binnen;
            _winnaar = winnaar;
            _andereVerbinding = andereVerbinding;
        }

        /// <summary>True once the concurrent run's row is committed, so the test can prove the race really happened.</summary>
        public bool WinnaarIsGeschreven { get; private set; }

        public Task<(Klas Klas, Schooljaar Schooljaar)?> LaadKlasMetSchooljaarAsync(
            Guid klasId,
            CancellationToken cancellationToken = default) =>
            _binnen.LaadKlasMetSchooljaarAsync(klasId, cancellationToken);

        public Task<Jaarplan?> LaadJaarplanAsync(Guid klasId, CancellationToken cancellationToken = default) =>
            _binnen.LaadJaarplanAsync(klasId, cancellationToken);

        public void VoegJaarplanToe(Jaarplan jaarplan) => _binnen.VoegJaarplanToe(jaarplan);

        public async Task<Generatieparameters?> LaadGeneratieparametersAsync(
            Guid klasId,
            Guid schooljaarId,
            CancellationToken cancellationToken = default)
        {
            var geladen = await _binnen.LaadGeneratieparametersAsync(klasId, schooljaarId, cancellationToken);

            if (geladen is null && !WinnaarIsGeschreven)
            {
                // The other run commits between this load and the caller's insert. Its own context, because that is
                // what a second request has.
                await using var ander = _andereVerbinding();
                ander.Generatieparameters.Add(_winnaar);
                await ander.SaveChangesAsync(cancellationToken);
                WinnaarIsGeschreven = true;
            }

            return geladen;
        }

        public Task<bool> ProbeerGeneratieparametersToeTeVoegenAsync(
            Generatieparameters parameters,
            CancellationToken cancellationToken = default) =>
            _binnen.ProbeerGeneratieparametersToeTeVoegenAsync(parameters, cancellationToken);

        public Task<IReadOnlyList<Thema>> LaadThemasAsync(CancellationToken cancellationToken = default) =>
            _binnen.LaadThemasAsync(cancellationToken);

        public Task BewaarAsync(CancellationToken cancellationToken = default) =>
            _binnen.BewaarAsync(cancellationToken);
    }

    /// <summary>An AI client that answers with an empty, valid plan: this test is about the settings, not the plan.</summary>
    private sealed class LeegAntwoordAiClient : IAiClient
    {
        public Task<AiCompletion> CompleteAsync(AiRequest request, CancellationToken cancellationToken = default) =>
            Task.FromResult(new AiCompletion { Content = """{"plaatsingen":[]}""" });
    }

    /// <summary>
    /// <b>The scoping guarantee, in the schema.</b> A row is keyed on (klas, schooljaar), so settings written for one
    /// school year are a different row from settings written for another and can never be read in its place. Every
    /// value stored here is a date: a schoolfeest on 2026-09-15 means nothing in 2027-2028, and loading it into next
    /// year's form would put a stale constraint in front of a teacher as if they had set it.
    /// </summary>
    [PostgresFact]
    public async Task Parameters_van_twee_schooljaren_staan_naast_elkaar_en_worden_niet_verward()
    {
        var (klasId, schooljaarId, blokStart) = await SeedAsync();
        Guid volgendJaarId;

        await using (var context = _db.MaakContext())
        {
            // A second school year holding the same class is not expressible (Klas.SchooljaarId is immutable and a klas
            // name is unique school-wide), so the second year gets its own klas — which is what a rollover would do.
            // The point under test is the row keying, and it is asserted by predicate below.
            var volgendJaar = TestSchooljaar.MetVakanties(TestSchooljaar.UniekeNaam("volgend"));
            context.Schooljaren.Add(volgendJaar);
            await context.SaveChangesAsync();
            volgendJaarId = volgendJaar.Id;

            var ditJaar = new Generatieparameters(klasId, schooljaarId);
            ditJaar.Vervang(
                [new BewaardStartthema(blokStart, "Herfst")],
                [new BewaardVastMoment("Schoolfeest", blokStart.AddDays(3), blokkeertPlaatsing: true)]);
            context.Generatieparameters.Add(ditJaar);
            await context.SaveChangesAsync();
        }

        await using (var context = _db.MaakContext())
        {
            // The lookup the service performs. Asking for the same klas in another school year finds nothing at all,
            // rather than last year's dates.
            Assert.Null(await context.Generatieparameters
                .FirstOrDefaultAsync(p => p.KlasId == klasId && p.SchooljaarId == volgendJaarId));

            Assert.NotNull(await context.Generatieparameters
                .FirstOrDefaultAsync(p => p.KlasId == klasId && p.SchooljaarId == schooljaarId));
        }
    }

    /// <summary>
    /// One period opens with one thema: the domain invariant <c>Vervang</c> enforces is held in the database too, so it
    /// cannot be bypassed by an insert around the aggregate.
    /// </summary>
    [PostgresFact]
    public async Task Twee_startthemas_voor_dezelfde_periode_worden_door_de_database_geweigerd()
    {
        var (klasId, schooljaarId, blokStart) = await SeedAsync();
        Guid parametersId;

        await using (var context = _db.MaakContext())
        {
            var parameters = new Generatieparameters(klasId, schooljaarId);
            parameters.Vervang([new BewaardStartthema(blokStart, "Herfst")], []);
            context.Generatieparameters.Add(parameters);
            await context.SaveChangesAsync();
            parametersId = parameters.Id;
        }

        await using (var context = _db.MaakContext())
        {
            // Inserted around the aggregate on purpose: the point is that the DATABASE refuses it.
            var ex = await Assert.ThrowsAsync<Npgsql.PostgresException>(() => context.Database.ExecuteSqlAsync(
                $"""
                INSERT INTO startthemavoorkeuren ("Id", "GeneratieparametersId", "BlokStart", "ThemaNaam")
                VALUES ({Guid.NewGuid()}, {parametersId}, {blokStart}, 'Water')
                """));

            Assert.Equal("23505", ex.SqlState);
        }
    }

    /// <summary>
    /// Replacing the settings really deletes the rows it drops. An owned-collection element removed from its parent's
    /// backing list is exactly the kind of change the in-memory provider can appear to accept with no DELETE reaching a
    /// database — and here it matters, because clearing a vast moment is how a teacher stops a period being blocked.
    /// </summary>
    [PostgresFact]
    public async Task Vervangen_verwijdert_de_oude_rijen_echt()
    {
        var (klasId, schooljaarId, blokStart) = await SeedAsync();

        await using (var context = _db.MaakContext())
        {
            var parameters = new Generatieparameters(klasId, schooljaarId);
            parameters.Vervang(
                [new BewaardStartthema(blokStart, "Herfst")],
                [new BewaardVastMoment("Schoolfeest", blokStart.AddDays(3), blokkeertPlaatsing: true)]);
            context.Generatieparameters.Add(parameters);
            await context.SaveChangesAsync();
        }

        await using (var context = _db.MaakContext())
        {
            var parameters = await context.Generatieparameters.SingleAsync();
            parameters.Vervang([], []);
            await context.SaveChangesAsync();
        }

        await using (var context = _db.MaakContext())
        {
            Assert.True((await context.Generatieparameters.SingleAsync()).IsLeeg);

            var startthemas = await context.Database
                .SqlQueryRaw<int>("""SELECT COUNT(*)::int AS "Value" FROM startthemavoorkeuren""")
                .SingleAsync();
            var momenten = await context.Database
                .SqlQueryRaw<int>("""SELECT COUNT(*)::int AS "Value" FROM vastemomenten""")
                .SingleAsync();

            Assert.Equal(0, startthemas);
            Assert.Equal(0, momenten);
        }
    }

    /// <summary>
    /// Deleting the <b>klas</b> takes its kept settings and both owned collections with it. Unlike the jaarplan this
    /// cascade needs no guard above it: these are the teacher's own re-enterable inputs, not a persisted decision about
    /// the plan (Art. IV.2).
    /// </summary>
    [PostgresFact]
    public async Task Een_klas_verwijderen_neemt_haar_bewaarde_parameters_mee()
    {
        var (klasId, schooljaarId, blokStart) = await SeedAsync();

        await using (var context = _db.MaakContext())
        {
            var parameters = new Generatieparameters(klasId, schooljaarId);
            parameters.Vervang(
                [new BewaardStartthema(blokStart, "Herfst")],
                [new BewaardVastMoment("Schoolfeest", blokStart.AddDays(3), blokkeertPlaatsing: true)]);
            context.Generatieparameters.Add(parameters);
            await context.SaveChangesAsync();
        }

        await using (var context = _db.MaakContext())
        {
            // Raw DELETE, so the database's own ON DELETE CASCADE is under test rather than EF's change tracker.
            // NOTE the interpolation hole carries no quotes: ExecuteSqlAsync turns it into a DbParameter, and quoting
            // it would emit a text literal that Postgres rejects with 22P02.
            var verwijderd = await context.Database.ExecuteSqlAsync(
                $"""DELETE FROM klassen WHERE "Id" = {klasId}""");
            Assert.Equal(1, verwijderd);
        }

        await using (var context = _db.MaakContext())
        {
            Assert.Empty(await context.Generatieparameters.ToListAsync());

            var startthemas = await context.Database
                .SqlQueryRaw<int>("""SELECT COUNT(*)::int AS "Value" FROM startthemavoorkeuren""")
                .SingleAsync();
            Assert.Equal(0, startthemas);
        }
    }

    /// <summary>
    /// The settings cannot point at a school year that does not exist: the FK is real. This is what turns
    /// <c>SchooljaarId</c> into a reference rather than a loose discriminator that could survive its own year.
    /// </summary>
    [PostgresFact]
    public async Task Parameters_zonder_bestaand_schooljaar_worden_geweigerd()
    {
        var (klasId, _, _) = await SeedAsync();

        await using var context = _db.MaakContext();
        context.Generatieparameters.Add(new Generatieparameters(klasId, Guid.NewGuid()));

        var ex = await Assert.ThrowsAsync<DbUpdateException>(() => context.SaveChangesAsync());
        Assert.Equal("23503", Assert.IsType<Npgsql.PostgresException>(ex.InnerException).SqlState);
    }

    /// <summary>
    /// <b>Replacing one element of a loaded aggregate with a different one, which is the flow that found a real defect
    /// two tables over.</b> A brand-new owned entity added to an <i>already persisted</i> parent was tracked as
    /// <c>Modified</c> rather than <c>Added</c>, because EF's default <c>OnAdd</c> value generation on a Guid key makes
    /// "the key is already set" mean "this row exists" — so <c>SaveChanges</c> issued an UPDATE for a row that did not
    /// exist and threw <c>DbUpdateConcurrencyException</c>. The keys are now <c>ValueGeneratedNever</c>.
    /// <para>
    /// The same defect was live on <c>themaplaatsingen</c>, where it broke any second generation run that adds a
    /// placement to an existing plan; see <c>JaarplanPersistentieTests</c> for that regression test.
    /// </para>
    /// </summary>
    [PostgresFact]
    public async Task Een_moment_vervangen_door_een_ander_slaagt_op_een_bestaande_rij()
    {
        var (klasId, schooljaarId, blokStart) = await SeedAsync();

        await using (var context = _db.MaakContext())
        {
            var parameters = new Generatieparameters(klasId, schooljaarId);
            parameters.Vervang(
                [new BewaardStartthema(blokStart, "Herfst")],
                [new BewaardVastMoment("Schoolfeest", blokStart.AddDays(3), blokkeertPlaatsing: false)]);
            context.Generatieparameters.Add(parameters);
            await context.SaveChangesAsync();
        }

        await using (var context = _db.MaakContext())
        {
            // Loaded, then replaced with a DIFFERENT moment: one delete plus one insert in a single SaveChanges.
            var parameters = await context.Generatieparameters.SingleAsync();
            parameters.Vervang(
                [new BewaardStartthema(blokStart, "Water")],
                [new BewaardVastMoment("Schoolfeest", blokStart.AddDays(3), blokkeertPlaatsing: true)]);
            await context.SaveChangesAsync();
        }

        await using (var context = _db.MaakContext())
        {
            var opnieuw = await context.Generatieparameters.SingleAsync();
            Assert.Equal("Water", Assert.Single(opnieuw.Startthemas).ThemaNaam);
            Assert.True(Assert.Single(opnieuw.VasteMomenten).BlokkeertPlaatsing);
        }
    }

    /// <summary>
    /// A vast moment's name fits the column the form's own <c>maxLength</c> allows. This project has already spent a CI
    /// run on a <c>varchar(32)</c> overflow that every local test missed, and a teacher's free-text label is exactly
    /// where an unbounded string arrives.
    /// </summary>
    [PostgresFact]
    public async Task Een_lange_momentnaam_past_in_de_kolom()
    {
        var (klasId, schooljaarId, blokStart) = await SeedAsync();
        var langeNaam = new string('a', 200);

        await using (var context = _db.MaakContext())
        {
            var parameters = new Generatieparameters(klasId, schooljaarId);
            parameters.Vervang([], [new BewaardVastMoment(langeNaam, blokStart, blokkeertPlaatsing: true)]);
            context.Generatieparameters.Add(parameters);
            await context.SaveChangesAsync();
        }

        await using (var context = _db.MaakContext())
        {
            var opnieuw = await context.Generatieparameters.SingleAsync();
            Assert.Equal(langeNaam, Assert.Single(opnieuw.VasteMomenten).Naam);
        }
    }

    /// <summary>
    /// Seeds a school year and a class inside it, and returns (klasId, schooljaarId, the year's first teaching day —
    /// which the E3-05 suite pins as the first derived block's start).
    /// </summary>
    private async Task<(Guid KlasId, Guid SchooljaarId, DateOnly BlokStart)> SeedAsync()
    {
        await using var context = _db.MaakContext();

        var schooljaar = TestSchooljaar.MetVakanties(TestSchooljaar.UniekeNaam("genparams"));
        var klas = schooljaar.VoegKlasToe($"L3-{Guid.NewGuid():N}", leerjaar: 3);
        context.Schooljaren.Add(schooljaar);

        await context.SaveChangesAsync();

        return (klas.Id, schooljaar.Id, schooljaar.Start);
    }
}
