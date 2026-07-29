using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Planning;
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
}
