using Jaarplanner.Domain.Planning;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Jaarplanner.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core mapping for <see cref="Schooldaguren"/>, the school's hours on one weekday (FB-023, ADR-0038).
/// <para>
/// <b>The unique index on the weekday is what makes this one set for the school.</b> There is no school id to scope
/// by, because the app serves one school per database (ADR-0036: each school gets its own web app and database), so
/// a weekday appearing twice would be two answers to the same question.
/// </para>
/// </summary>
public sealed class SchooldagurenConfiguration : IEntityTypeConfiguration<Schooldaguren>
{
    public void Configure(EntityTypeBuilder<Schooldaguren> builder)
    {
        builder.ToTable("schooldaguren");

        builder.HasKey(d => d.Id);
        builder.Property(d => d.Id).ValueGeneratedNever();

        // By name, as every enum in this model is stored, so a row reads as "Wednesday" in psql rather than 3.
        builder.Property(d => d.Weekdag).HasConversion<string>().HasMaxLength(16).IsRequired();
        builder.HasIndex(d => d.Weekdag).IsUnique();

        // TimeOnly -> PostgreSQL `time`, as the placements store theirs.
        builder.Property(d => d.Begin).IsRequired();
        builder.Property(d => d.Einde).IsRequired();
        builder.Property(d => d.MiddagpauzeBegin);
        builder.Property(d => d.MiddagpauzeEinde);
    }
}
