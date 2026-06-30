using Jaarplanner.Domain.Curriculum;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Jaarplanner.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core mapping for <see cref="Discipline"/> (read-only Op.stap reference data, Art. III.1).
/// The string <see cref="Discipline.Nummer"/> is the primary key; the 9.x nesting is a
/// self-reference via <see cref="Discipline.ParentDisciplineNummer"/>.
/// </summary>
public sealed class DisciplineConfiguration : IEntityTypeConfiguration<Discipline>
{
    public void Configure(EntityTypeBuilder<Discipline> builder)
    {
        builder.ToTable("disciplines");

        builder.HasKey(d => d.Nummer);

        builder.Property(d => d.Nummer).HasMaxLength(16);
        builder.Property(d => d.Naam).HasMaxLength(256).IsRequired();
        builder.Property(d => d.ParentDisciplineNummer).HasMaxLength(16);

        // Self-reference for the 9.x split. Restrict so a parent cannot be deleted while
        // children remain (reference data is not deleted by the app in any case — Art. III.1).
        builder.HasOne<Discipline>()
            .WithMany()
            .HasForeignKey(d => d.ParentDisciplineNummer)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
