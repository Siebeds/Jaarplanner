using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;

namespace Jaarplanner.Infrastructure.Persistence;

/// <summary>
/// EF Core database context for the Jaarplanner relational store (PostgreSQL via Npgsql).
/// <para>
/// E1-01 adds the read-only Op.stap curriculum reference entities (Art. IX.1): <see cref="Disciplines"/>,
/// <see cref="Leerplandoelen"/> and <see cref="Minimumdoelen"/>. E1-02 adds the autonomous, level-scoped
/// themalaag (Art. IX.2): <see cref="Themas"/> + <see cref="Themadoelen"/> (school-scoped) and the
/// class/age-scoped <see cref="Subthemas"/> / <see cref="Subdoelen"/> / <see cref="Activiteiten"/>,
/// plus a minimal <see cref="Klassen"/> to anchor the class scope. The full planning entities
/// (Schooljaar, Jaarplan — Art. IX.3) arrive in later stories.
/// </para>
/// <para>
/// <b>Read-only reference data (Art. III.1).</b> Immutability is enforced structurally in the domain
/// (private setters, no mutators, construction-only) — the application has no code path that mutates
/// the official content of a leerplandoel/minimumdoel/discipline. Import seeding (E1-03) inserts new
/// rows; nothing updates official content.
/// </para>
/// </summary>
public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options)
        : base(options)
    {
    }

    /// <summary>The Op.stap disciplines (read-only reference data — Art. III.1, IX.1).</summary>
    public DbSet<Discipline> Disciplines => Set<Discipline>();

    /// <summary>The Op.stap leerplandoelen (read-only reference data — Art. III.1, IX.1).</summary>
    public DbSet<Leerplandoel> Leerplandoelen => Set<Leerplandoel>();

    /// <summary>The decreed minimumdoelen (read-only reference data — Art. III.1, IX.1).</summary>
    public DbSet<Minimumdoel> Minimumdoelen => Set<Minimumdoel>();

    /// <summary>The class groups (Art. IX.3) — anchor for the class/age-scoped school content.</summary>
    public DbSet<Klas> Klassen => Set<Klas>();

    /// <summary>
    /// The school years with their vakantie-/periodestructuur (Art. IX.3, E3-05). Note there is
    /// deliberately no <c>Planningsblokken</c> set: blocks are derived from a schooljaar by the
    /// <c>IPlanningsblokIndeling</c> seam, so no row commits the school to a granularity (ADR-0013).
    /// </summary>
    public DbSet<Schooljaar> Schooljaren => Set<Schooljaar>();

    /// <summary>
    /// The per-class year plans with their thema placements (Art. IX.3, E3-01). A placement stores the
    /// planningsblok's <b>start date</b> + tier, never an ordinal (ADR-0020 §3) — and, as with the schooljaar,
    /// there is deliberately no <c>Planningsblokken</c> set: the grid stays derived (ADR-0013).
    /// </summary>
    public DbSet<Jaarplan> Jaarplannen => Set<Jaarplan>();

    /// <summary>
    /// The pre-generation settings each class keeps between runs (E3-04, FR-5.4). Scoped by
    /// <c>(KlasId, SchooljaarId)</c> because every value in them is a date, so a row must never be read for a
    /// different school year than the one it was written for.
    /// </summary>
    public DbSet<Generatieparameters> Generatieparameters => Set<Generatieparameters>();

    /// <summary>The school's thema's — school-scoped autonomous content (Art. IX.2).</summary>
    public DbSet<Thema> Themas => Set<Thema>();

    /// <summary>The school-wide themadoelen anchoring each thema (Art. IX.2).</summary>
    public DbSet<Themadoel> Themadoelen => Set<Themadoel>();

    /// <summary>The class/age-scoped subthema's (Art. IX.2).</summary>
    public DbSet<Subthema> Subthemas => Set<Subthema>();

    /// <summary>The class/age-scoped subdoelen, per (subthema × leeftijd) (Art. IX.2).</summary>
    public DbSet<Subdoel> Subdoelen => Set<Subdoel>();

    /// <summary>The class/age-scoped activiteiten (Art. IX.2).</summary>
    public DbSet<Activiteit> Activiteiten => Set<Activiteit>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);

        // Every Guid key in this model is assigned by the domain constructor (`= Guid.NewGuid()`), so none of
        // them is store-generated. Saying so once, model-wide, closes a defect class this repo met three times.
        //
        // EF's convention for a Guid key is ValueGenerated.OnAdd. When change tracking discovers an untracked
        // entity inside the collection of an ALREADY-LOADED parent, it decides Added-versus-Modified from
        // "is the key set AND store-generated" — and since the constructor set it, a brand-new child is tracked
        // as Modified. SaveChanges then emits an UPDATE for a row that does not exist, which PostgreSQL reports
        // as `DbUpdateConcurrencyException: expected to affect 1 row(s), but actually affected 0 row(s)`.
        //
        // It cost three separate diagnoses to get here, each fixing only what it happened to meet: E3-04 fixed
        // Themaplaatsing, and KlasBeheerService/SchoolcontentBeheerService/SchoolcontentImportService each
        // worked around it with an explicit `_context.X.Add(child)` (which forces Added). What none of them
        // fixed was the collection with no such workaround: adding a Subthema or an Activiteit to an existing
        // thema, i.e. the ordinary school-content re-import, answered 500 from the second import onward
        // (found by E1-13's round-2 browser pass; `AggregaatGroeiTests` now covers every collection).
        //
        // Two reasons this is a model-wide rule rather than a line per configuration: the statement is true of
        // the whole model, not of the entities that happened to break; and a new child collection would
        // otherwise reintroduce the defect and, on the in-memory provider, no test would notice.
        //
        // Metadata only. Npgsql generates a `uuid` key client-side rather than with a database default, so no
        // column, default or constraint changes — verified with `dotnet ef migrations has-pending-model-changes`
        // and by re-running the migrations against a fresh database.
        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            foreach (var property in entityType.GetKeys()
                .SelectMany(key => key.Properties)
                .Where(p => p.ClrType == typeof(Guid)))
            {
                property.ValueGenerated = ValueGenerated.Never;
            }
        }
    }
}
