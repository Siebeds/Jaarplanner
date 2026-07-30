using Jaarplanner.Application.AiAuthoring;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Infrastructure.AiAuthoring;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.IntegrationTests.Postgres;

/// <summary>
/// Database-level integrity tests against a real PostgreSQL. Every assertion here is one the EF Core
/// in-memory provider structurally <b>cannot</b> make, which is why these defects survived a green CI:
/// in-memory enforces no foreign keys, no unique indexes and no collation.
/// </summary>
public sealed class ReferentiedataIntegriteitTests : IAsyncLifetime
{
    private PostgresTestDatabase _db = null!;

    public async Task InitializeAsync()
    {
        if (!PostgresTestDatabase.IsBeschikbaar)
        {
            return; // Every test is a PostgresFact and will report as skipped.
        }

        _db = await PostgresTestDatabase.MaakAsync("refdata");
    }

    public async Task DisposeAsync()
    {
        if (_db is not null)
        {
            await _db.DisposeAsync();
        }
    }

    /// <summary>
    /// The authoritative Op.stap discipline list is present after migration. Without it,
    /// <c>Leerplandoel.DisciplineNummer</c> — a required <c>Restrict</c> FK — has nothing to point at
    /// and the very first real Op.stap import dies on SQLSTATE 23503.
    /// </summary>
    [PostgresFact]
    public async Task Migratie_seeds_de_officiele_disciplines()
    {
        await using var context = _db.MaakContext();

        var disciplines = await context.Disciplines.OrderBy(d => d.Nummer).ToListAsync();

        Assert.Equal(13, disciplines.Count);
        // Spot-check the two ends and the 9.x split, against CONSTITUTION.md Art. VII.0.
        Assert.Equal("Nederlands en communicatie", disciplines.Single(d => d.Nummer == "1").Naam);
        Assert.Equal("Rooms-katholieke godsdienst", disciplines.Single(d => d.Nummer == "11").Naam);
        Assert.Equal("Leren leren", disciplines.Single(d => d.Nummer == "9.2").Naam);
    }

    /// <summary>
    /// A leerplandoel for a seeded discipline now persists — i.e. the import path's insert works.
    /// This is the positive half of the FK fix.
    /// </summary>
    [PostgresFact]
    public async Task Leerplandoel_met_geseede_discipline_persisteert()
    {
        await using var context = _db.MaakContext();

        context.Leerplandoelen.Add(new Leerplandoel(
            "WIS-001", Doelsoort.Gemeenschappelijk, "L3", "Getallen", "Getalbegrip", "2", tekst: "doeltekst"));

        await context.SaveChangesAsync();

        Assert.True(await context.Leerplandoelen.AnyAsync(l => l.Code == "WIS-001"));
    }

    /// <summary>
    /// A leerplandoel referencing an unknown discipline is <b>rejected by the database</b>. The previous
    /// in-memory suite accepted exactly this (its fixture seeded <c>disciplineNummer "1"</c> with no
    /// discipline row), which is what hid the import failure.
    /// </summary>
    [PostgresFact]
    public async Task Leerplandoel_met_onbekende_discipline_wordt_geweigerd()
    {
        await using var context = _db.MaakContext();

        context.Leerplandoelen.Add(new Leerplandoel(
            "XX-001", Doelsoort.Gemeenschappelijk, "L3", "Domein", "Subdomein", "99", tekst: "doeltekst"));

        var ex = await Assert.ThrowsAsync<DbUpdateException>(() => context.SaveChangesAsync());
        Assert.Equal("23503", Assert.IsType<Npgsql.PostgresException>(ex.InnerException).SqlState);
    }

    /// <summary>
    /// <b>Characterisation test for the still-open minimumdoel gap.</b> A leerplandoel carrying a
    /// concordance key is rejected while no matching <c>Minimumdoel</c> row exists, because
    /// <c>MinimumdoelRef</c> is a <c>Restrict</c> FK on <c>minimumdoelen.Ref</c>.
    /// <para>
    /// Nothing in the codebase inserts a <c>Minimumdoel</c> — the per-discipline goal Excel has no
    /// <c>omschrijving</c> column (Art. VII.1), so there is no import source for the decreed text. Until
    /// that source is decided, every MD-concorded Op.stap row would fail to commit and minimumdoel-level
    /// coverage — the inspectie-facing feature — can return nothing. This test pins the constraint so the
    /// gap is visible and measured rather than latent; flip it to the positive assertion when the
    /// minimumdoel source lands.
    /// </para>
    /// </summary>
    [PostgresFact]
    public async Task Leerplandoel_met_concordantie_zonder_minimumdoel_wordt_geweigerd()
    {
        await using var context = _db.MaakContext();

        context.Leerplandoelen.Add(new Leerplandoel(
            "WIS-002", Doelsoort.Minimumdoel, "L4", "Getallen", "Getalbegrip", "2",
            tekst: "doeltekst", minimumdoelRef: "4-12"));

        var ex = await Assert.ThrowsAsync<DbUpdateException>(() => context.SaveChangesAsync());
        Assert.Equal("23503", Assert.IsType<Npgsql.PostgresException>(ex.InnerException).SqlState);
    }

    /// <summary>
    /// With the minimumdoel present, the concordance persists — proving the chain works and that the
    /// only thing missing is a source for the decreed rows.
    /// </summary>
    [PostgresFact]
    public async Task Concordantie_persisteert_zodra_het_minimumdoel_bestaat()
    {
        await using var context = _db.MaakContext();

        context.Minimumdoelen.Add(new Minimumdoel("4-12", "4-", "12", "De leerling kan ..."));
        context.Leerplandoelen.Add(new Leerplandoel(
            "WIS-003", Doelsoort.Minimumdoel, "L4", "Getallen", "Getalbegrip", "2",
            tekst: "doeltekst", minimumdoelRef: "4-12"));

        await context.SaveChangesAsync();

        var doel = await context.Leerplandoelen.SingleAsync(l => l.Code == "WIS-003");
        Assert.Equal("4-12", doel.MinimumdoelRef);
    }

    /// <summary>
    /// Two classes cannot share a name. The school-content import resolves a class <b>by name</b>, so a
    /// duplicate would make that resolution arbitrary. In-memory ignores unique indexes entirely.
    /// </summary>
    [PostgresFact]
    public async Task Klas_naam_is_uniek_in_de_database()
    {
        await using var context = _db.MaakContext();

        // A Klas lives in a Schooljaar (Art. IX.3 containment, E3-01) — a real FK here, unlike in-memory. The
        // second class is put in a DIFFERENT year on purpose: the name index is deliberately school-wide rather
        // than per-year, because the school-content import resolves a class by name.
        var eersteJaar = TestSchooljaar.Maak("2026-2027");
        eersteJaar.VoegKlasToe("L3 — derde leerjaar", 3);
        context.Schooljaren.Add(eersteJaar);
        await context.SaveChangesAsync();

        await using var tweede = _db.MaakContext();
        var tweedeJaar = TestSchooljaar.Maak("2027-2028", startJaar: 2027);
        tweedeJaar.VoegKlasToe("L3 — derde leerjaar", 3);
        tweede.Schooljaren.Add(tweedeJaar);

        var ex = await Assert.ThrowsAsync<DbUpdateException>(() => tweede.SaveChangesAsync());
        Assert.Equal("23505", Assert.IsType<Npgsql.PostgresException>(ex.InnerException).SqlState);
    }

    /// <summary>
    /// <c>EfLeerdoelCatalogus</c>'s jaar/fase filter matches <b>case-insensitively against a real
    /// PostgreSQL</b>, i.e. the <c>ToLower()</c> comparison really is translated to SQL <c>lower()</c>
    /// and evaluated by the server.
    /// <para>
    /// This is the one assertion the in-memory provider structurally cannot make. In-memory applies
    /// <c>no collation</c> — it compares strings with .NET semantics — so the E2-08 integration suite
    /// that runs there pins the filter's <i>semantics</i> and would stay green against a query that
    /// Postgres answers with zero rows. That is precisely the defect this filter was written to fix:
    /// under a case-sensitive collation (Postgres' default, e.g. <c>English_Belgium.1252</c> on a
    /// Windows install) a teacher typing <c>k3</c> got an empty candidate set indistinguishable from
    /// "the curriculum holds nothing for your class".
    /// </para>
    /// <para>
    /// The three spellings must return <b>the same rows</b>, not merely a non-empty set; and the
    /// <c>L3</c> row must stay out, so a filter that silently degraded to "no filter" would fail too.
    /// Leading/trailing whitespace is trimmed off (a pasted value carries it).
    /// </para>
    /// </summary>
    [PostgresFact]
    public async Task Leerdoelcatalogus_filtert_jaarfase_case_insensitief_in_de_database()
    {
        await using (var seed = _db.MaakContext())
        {
            // Discipline "1" is seeded by the migrations; the required Restrict FK is real here.
            seed.Leerplandoelen.AddRange(
                new Leerplandoel("NAT-K3-01", Doelsoort.Gemeenschappelijk, "K3", "Natuur", "Levende natuur", "1", tekst: "doeltekst"),
                new Leerplandoel("NAT-K3-02", Doelsoort.Gemeenschappelijk, "K3", "Natuur", "Levende natuur", "1", tekst: "doeltekst"),
                new Leerplandoel("WIS-L3-01", Doelsoort.Gemeenschappelijk, "L3", "Getallen", "Getalbegrip", "2", tekst: "doeltekst"));
            await seed.SaveChangesAsync();
        }

        await using var context = _db.MaakContext();
        var catalogus = new EfLeerdoelCatalogus(context);

        string[] verwacht = ["NAT-K3-01", "NAT-K3-02"];
        foreach (var spelling in new[] { "K3", "k3", " k3 " })
        {
            var doelen = await catalogus.HaalLeerdoelenAsync(new LeerdoelSelectie { JaarFasen = [spelling] });

            Assert.Equal(verwacht, doelen.Select(d => d.Code).ToArray());
        }
    }

    /// <summary>
    /// The <c>Codes</c> dimension matches case-insensitively against a real database too, and returns the
    /// row carrying the curriculum's <b>own</b> casing.
    /// <para>
    /// This is the path <c>DoelMatchingService.ZoekLeerdoelAsync</c> uses to resolve the FR-4.3
    /// substitution a teacher types by hand. Without the SQL <c>lower()</c> the teacher would be told
    /// <i>"'nat-k3-01' zit niet in de geladen Op.stap-leerplandoelen"</i> about a code that does exist —
    /// a false statement about the curriculum (Art. III.5). What is stored stays <c>NAT-K3-01</c>.
    /// </para>
    /// </summary>
    [PostgresFact]
    public async Task Leerdoelcatalogus_zoekt_een_code_case_insensitief_in_de_database()
    {
        await using (var seed = _db.MaakContext())
        {
            seed.Leerplandoelen.Add(new Leerplandoel(
                "NAT-K3-01", Doelsoort.Gemeenschappelijk, "K3", "Natuur", "Levende natuur", "1", tekst: "doeltekst"));
            await seed.SaveChangesAsync();
        }

        await using var context = _db.MaakContext();
        var catalogus = new EfLeerdoelCatalogus(context);

        var doelen = await catalogus.HaalLeerdoelenAsync(new LeerdoelSelectie { Codes = ["nat-k3-01"] });

        Assert.Equal("NAT-K3-01", Assert.Single(doelen).Code);
    }
}
