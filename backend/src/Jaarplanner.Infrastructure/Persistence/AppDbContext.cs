using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.Infrastructure.Persistence;

/// <summary>
/// EF Core database context for the Jaarplanner relational store (PostgreSQL via Npgsql).
/// Intentionally empty for now: the read-only Op.stap curriculum, the autonomous themalaag,
/// and the planning entities (Art. IX) and their migrations arrive in E1. A DbContext with
/// no <see cref="DbSet{TEntity}"/>s is valid and lets us wire and health-check the data layer.
/// </summary>
public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options)
        : base(options)
    {
    }
}
