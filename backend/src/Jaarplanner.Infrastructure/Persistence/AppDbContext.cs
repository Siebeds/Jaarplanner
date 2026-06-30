using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;
using Microsoft.EntityFrameworkCore;

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
    }
}
