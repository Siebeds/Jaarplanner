using Jaarplanner.Domain.Curriculum;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.Infrastructure.Persistence;

/// <summary>
/// EF Core database context for the Jaarplanner relational store (PostgreSQL via Npgsql).
/// <para>
/// E1-01 adds the read-only Op.stap curriculum reference entities (Art. IX.1): <see cref="Disciplines"/>,
/// <see cref="Leerplandoelen"/> and <see cref="Minimumdoelen"/>. The autonomous themalaag (E1-02)
/// and the planning entities (Art. IX.2/3) arrive in later stories.
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

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
    }
}
