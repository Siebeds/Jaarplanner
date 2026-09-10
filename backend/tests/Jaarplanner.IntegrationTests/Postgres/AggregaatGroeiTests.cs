using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.IntegrationTests.Postgres;

/// <summary>
/// One test per child collection in the model: <b>can an aggregate that is already in the database grow?</b>
/// <para>
/// This whole file exists because of a defect class this repo has now met three times. Every child entity here
/// assigns its <c>Guid</c> key in its constructor, and EF's convention for a <c>Guid</c> key is
/// <c>ValueGenerated.OnAdd</c>. When change tracking discovers an untracked entity inside the collection of an
/// <b>already-loaded</b> parent, it decides Added-versus-Modified from "is the key set <i>and</i>
/// store-generated" — so a brand-new child is tracked as <b>Modified</b> and <c>SaveChanges</c> emits an
/// <c>UPDATE</c> for a row that does not exist. Against PostgreSQL that is a
/// <c>DbUpdateConcurrencyException: expected to affect 1 row(s), but actually affected 0 row(s)</c>; against the
/// EF <b>in-memory</b> provider it silently succeeds, because in-memory has no rows-affected check. That is why
/// 505 unit tests were green while the second school-content import of the year answered 500 (E1-13 round 2).
/// </para>
/// <para>
/// The fix is <c>ValueGeneratedNever()</c> on each of those keys (the application always assigns them), and the
/// only honest guard for it is a test on <b>real PostgreSQL</b> that grows a persisted aggregate. Two earlier
/// fixes (E3-04's <c>Themaplaatsing</c>, and the two explicit <c>_context.Add</c> calls in
/// <c>SchoolcontentBeheerService</c>/<c>SchoolcontentImportService</c>) each patched the instance they happened
/// to meet; this file sweeps the class instead, so a new child collection has an obvious place to be covered.
/// </para>
/// <para>
/// Deliberately at the <c>DbContext</c> level rather than over HTTP: the subject is the EF mapping, several of
/// these collections have no endpoint that grows them in isolation, and going through a service would let an
/// explicit <c>Add</c> hide the mapping defect. The end-to-end proof over HTTP lives in
/// <see cref="SchoolcontentImportEndpointsTests.Tweede_import_laat_een_bestaand_thema_groeien"/>.
/// </para>
/// </summary>
public sealed class AggregaatGroeiTests : IClassFixture<AggregaatGroeiTests.Databank>
{
    private readonly Databank _databank;

    public AggregaatGroeiTests(Databank databank) => _databank = databank;

    private PostgresTestDatabase _db => _databank.Db!;

    /// <summary>
    /// <b>One database for the whole class</b>, not one per test, and that is deliberate rather than thrifty.
    /// The suite's other Postgres classes take a database per class through <c>IAsyncLifetime</c>, which here
    /// would have meant nine <c>CREATE DATABASE</c> + migrate + drop cycles for nine short tests. That is the
    /// kind of load the suite's own <c>PostgresTestDatabase.DisposeAsync</c> already documents as producing
    /// intermittent <c>55006</c> drop failures, and one run of the full solution did fail once here before this
    /// was changed. Each test seeds its own graph under guid-suffixed names, so sharing the database costs no
    /// isolation: nothing here reads another test's rows, and <c>klassen.Naam</c>'s school-wide unique index
    /// cannot collide across guid names.
    /// </summary>
    public sealed class Databank : IAsyncLifetime
    {
        public PostgresTestDatabase? Db { get; private set; }

        public async Task InitializeAsync()
        {
            if (PostgresTestDatabase.IsBeschikbaar)
            {
                Db = await PostgresTestDatabase.MaakAsync("groei");
            }
        }

        public async Task DisposeAsync()
        {
            if (Db is not null)
            {
                await Db.DisposeAsync();
            }
        }
    }

    /// <summary>A themadoel added to a thema that is already stored (Art. IX.2, the school-wide anchors).</summary>
    [PostgresFact]
    public async Task Bestaand_thema_krijgt_een_themadoel()
    {
        var seed = await SeedAsync();

        await using (var context = _db.MaakContext())
        {
            var thema = await context.Themas.Include(t => t.Themadoelen).SingleAsync(t => t.Id == seed.ThemaId);
            thema.VoegThemadoelToe(new DoelKoppeling(seed.TweedeCode, KoppelingStatus.Manueel));
            await context.SaveChangesAsync();
        }

        await using (var context = _db.MaakContext())
        {
            var thema = await context.Themas.Include(t => t.Themadoelen).SingleAsync(t => t.Id == seed.ThemaId);
            Assert.Equal(2, thema.Themadoelen.Count);
            Assert.Contains(thema.Themadoelen, td => td.Koppeling.LeerplandoelCode == seed.TweedeCode);
        }
    }

    /// <summary>A subthema added to a thema that is already stored: the second-import case (FR-1.4).</summary>
    [PostgresFact]
    public async Task Bestaand_thema_krijgt_een_subthema()
    {
        var seed = await SeedAsync();

        await using (var context = _db.MaakContext())
        {
            var thema = await context.Themas.Include(t => t.Subthemas).SingleAsync(t => t.Id == seed.ThemaId);
            thema.VoegSubthemaToe("Noten", duurWeken: 2, leeftijd: "6");
            await context.SaveChangesAsync();
        }

        await using (var context = _db.MaakContext())
        {
            var thema = await context.Themas.Include(t => t.Subthemas).SingleAsync(t => t.Id == seed.ThemaId);
            Assert.Equal(2, thema.Subthemas.Count);
            Assert.Contains(thema.Subthemas, s => s.Naam == "Noten");
        }
    }

    /// <summary>
    /// An AI doelsuggestie added to a thema that is already stored (E2-04/FR-4.1) — the owned-collection
    /// shape, whose composite key <c>(ThemaId, Id)</c> makes it a different case from the ones above.
    /// </summary>
    [PostgresFact]
    public async Task Bestaand_thema_krijgt_een_doelsuggestie()
    {
        var seed = await SeedAsync();

        await using (var context = _db.MaakContext())
        {
            var thema = await context.Themas.Include(t => t.Doelsuggesties).SingleAsync(t => t.Id == seed.ThemaId);
            thema.VoegDoelsuggestieToe(
                new DoelKoppeling(seed.TweedeCode, KoppelingStatus.Voorgesteld, "past bij de invalshoek"));
            await context.SaveChangesAsync();
        }

        await using (var context = _db.MaakContext())
        {
            var thema = await context.Themas.Include(t => t.Doelsuggesties).SingleAsync(t => t.Id == seed.ThemaId);
            var suggestie = Assert.Single(thema.Doelsuggesties);
            Assert.Equal(seed.TweedeCode, suggestie.LeerplandoelCode);
            Assert.Equal(KoppelingStatus.Voorgesteld, suggestie.Status);
        }
    }

    /// <summary>A subdoel added to a subthema that is already stored (the per-(subthema × leeftijd) link).</summary>
    [PostgresFact]
    public async Task Bestaand_subthema_krijgt_een_subdoel()
    {
        var seed = await SeedAsync();

        await using (var context = _db.MaakContext())
        {
            var subthema = await context.Subthemas.Include(s => s.Subdoelen).SingleAsync(s => s.Id == seed.SubthemaId);
            subthema.VoegSubdoelToe("6", new DoelKoppeling(seed.TweedeCode, KoppelingStatus.Manueel));
            await context.SaveChangesAsync();
        }

        await using (var context = _db.MaakContext())
        {
            var subthema = await context.Subthemas.Include(s => s.Subdoelen).SingleAsync(s => s.Id == seed.SubthemaId);
            var subdoel = Assert.Single(subthema.Subdoelen);
            Assert.Equal(seed.TweedeCode, subdoel.Koppeling.LeerplandoelCode);
        }
    }

    /// <summary>An activiteit added to a subthema that is already stored: the other half of the 500.</summary>
    [PostgresFact]
    public async Task Bestaand_subthema_krijgt_een_activiteit()
    {
        var seed = await SeedAsync();

        await using (var context = _db.MaakContext())
        {
            var subthema = await context.Subthemas
                .Include(s => s.Activiteiten)
                .SingleAsync(s => s.Id == seed.SubthemaId);
            subthema.VoegActiviteitToe("Noten zoeken", ActiviteitType.Uitstap);
            await context.SaveChangesAsync();
        }

        await using (var context = _db.MaakContext())
        {
            var subthema = await context.Subthemas
                .Include(s => s.Activiteiten)
                .SingleAsync(s => s.Id == seed.SubthemaId);
            Assert.Equal(2, subthema.Activiteiten.Count);
            Assert.Contains(subthema.Activiteiten, a => a.Naam == "Noten zoeken");
        }
    }

    /// <summary>A doelkoppeling added to an activiteit that is already stored (the second owned collection).</summary>
    [PostgresFact]
    public async Task Bestaande_activiteit_krijgt_een_doelkoppeling()
    {
        var seed = await SeedAsync();

        await using (var context = _db.MaakContext())
        {
            var activiteit = await context.Activiteiten
                .Include(a => a.Doelkoppelingen)
                .SingleAsync(a => a.Id == seed.ActiviteitId);
            activiteit.VoegDoelkoppelingToe(new DoelKoppeling(seed.TweedeCode, KoppelingStatus.Manueel));
            await context.SaveChangesAsync();
        }

        await using (var context = _db.MaakContext())
        {
            var activiteit = await context.Activiteiten
                .Include(a => a.Doelkoppelingen)
                .SingleAsync(a => a.Id == seed.ActiviteitId);
            var koppeling = Assert.Single(activiteit.Doelkoppelingen);
            Assert.Equal(seed.TweedeCode, koppeling.LeerplandoelCode);
        }
    }

    /// <summary>
    /// A schoolsluiting added to a schooljaar that is already stored (Art. IX.3, E3-05). Already
    /// <c>ValueGeneratedNever</c> before this round; kept here so the sweep is complete rather than
    /// selective, and so a future edit to that configuration cannot regress in silence.
    /// </summary>
    [PostgresFact]
    public async Task Bestaand_schooljaar_krijgt_een_sluiting()
    {
        var seed = await SeedAsync();

        await using (var context = _db.MaakContext())
        {
            var schooljaar = await context.Schooljaren.SingleAsync(s => s.Id == seed.SchooljaarId);
            schooljaar.VoegSluitingToe(new Schoolsluiting(
                "Pedagogische studiedag",
                schooljaar.Start.AddDays(30),
                schooljaar.Start.AddDays(30),
                Sluitingssoort.VrijeDag));
            await context.SaveChangesAsync();
        }

        await using (var context = _db.MaakContext())
        {
            var schooljaar = await context.Schooljaren.SingleAsync(s => s.Id == seed.SchooljaarId);
            Assert.Contains(schooljaar.Sluitingen, s => s.Naam == "Pedagogische studiedag");
        }
    }

    /// <summary>
    /// A klas added to a schooljaar that is already stored (Art. IX.3 containment, E3-01). Not owned: a klas has
    /// its own identity and CRUD, so this is the third shape in the class.
    /// </summary>
    [PostgresFact]
    public async Task Bestaand_schooljaar_krijgt_een_klas()
    {
        var seed = await SeedAsync();
        var naam = $"L4-{Guid.NewGuid():N}"[..12];

        await using (var context = _db.MaakContext())
        {
            var schooljaar = await context.Schooljaren.SingleAsync(s => s.Id == seed.SchooljaarId);
            schooljaar.VoegKlasToe(naam, "L4");
            await context.SaveChangesAsync();
        }

        await using (var context = _db.MaakContext())
        {
            Assert.Single(await context.Klassen.Where(k => k.Naam == naam).ToListAsync());
        }
    }

    /// <summary>
    /// A themaplaatsing added to a jaarplan that is already stored: E3-04's own defect, re-pinned here so
    /// the whole class sits in one file. E3-04 covers it too; duplication is cheaper than a reader
    /// concluding from this file that the plan half was never checked.
    /// </summary>
    [PostgresFact]
    public async Task Bestaand_jaarplan_krijgt_een_plaatsing()
    {
        var seed = await SeedAsync();

        await using (var context = _db.MaakContext())
        {
            var plan = new Jaarplan(seed.KlasId);
            plan.VoegPlaatsingToe(
                seed.ThemaId, Planningsblokniveau.Themaperiode, seed.SchooljaarStart, KoppelingStatus.Voorgesteld);
            context.Jaarplannen.Add(plan);
            await context.SaveChangesAsync();
        }

        await using (var context = _db.MaakContext())
        {
            var plan = await context.Jaarplannen.SingleAsync(j => j.KlasId == seed.KlasId);
            plan.VoegPlaatsingToe(
                seed.ThemaId,
                Planningsblokniveau.Subthemaperiode,
                seed.SchooljaarStart.AddDays(14),
                KoppelingStatus.Voorgesteld);
            await context.SaveChangesAsync();
        }

        await using (var context = _db.MaakContext())
        {
            var plan = await context.Jaarplannen.SingleAsync(j => j.KlasId == seed.KlasId);
            Assert.Equal(2, plan.Plaatsingen.Count);
        }
    }

    /// <summary>
    /// A full stored graph: schooljaar + klas, two leerplandoelen, and a thema with one themadoel, one
    /// subthema and one activiteit. Every test above then loads a piece of it in a <b>fresh</b> context and
    /// adds one child, which is the exact shape that used to fail.
    /// </summary>
    private async Task<Seed> SeedAsync()
    {
        await using var context = _db.MaakContext();

        var schooljaar = TestSchooljaar.MetVakanties(TestSchooljaar.UniekeNaam("groei"));
        var klas = schooljaar.VoegKlasToe($"L3-{Guid.NewGuid():N}"[..12], "L3");
        context.Schooljaren.Add(schooljaar);

        var eersteCode = $"GRO-A-{Guid.NewGuid():N}"[..16];
        var tweedeCode = $"GRO-B-{Guid.NewGuid():N}"[..16];
        foreach (var code in new[] { eersteCode, tweedeCode })
        {
            context.Leerplandoelen.Add(new Leerplandoel(
                code, Doelsoort.Minimumdoel, "K3", "Natuur", "Levende natuur", "3", tekst: "herkent bomen."));
        }

        var thema = new Thema($"Herfst-{Guid.NewGuid():N}"[..16], duurWeken: 5);
        thema.VoegThemadoelToe(new DoelKoppeling(eersteCode, KoppelingStatus.Manueel));
        var subthema = thema.VoegSubthemaToe("Bladeren", duurWeken: 2, leeftijd: "6");
        var activiteit = subthema.VoegActiviteitToe(
            "Bladeren rapen", ActiviteitType.Waarneming);
        context.Themas.Add(thema);

        await context.SaveChangesAsync();

        return new Seed(
            schooljaar.Id, schooljaar.Start, klas.Id, thema.Id, subthema.Id, activiteit.Id, tweedeCode);
    }

    private sealed record Seed(
        Guid SchooljaarId,
        DateOnly SchooljaarStart,
        Guid KlasId,
        Guid ThemaId,
        Guid SubthemaId,
        Guid ActiviteitId,
        string TweedeCode);
}
