using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Toegang;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Jaarplanner.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core mapping for <see cref="Klastoewijzing"/> (E6-02, ADR-0030 R15): a pure link row, unique per
/// (gebruiker, klas), removed with either end. Removing a gebruiker or a klas leaves nothing for a right to hang on.
/// </summary>
public sealed class KlastoewijzingConfiguration : IEntityTypeConfiguration<Klastoewijzing>
{
    public void Configure(EntityTypeBuilder<Klastoewijzing> builder)
    {
        builder.ToTable("klastoewijzingen");

        builder.HasKey(t => t.Id);

        builder.HasOne<Gebruiker>()
            .WithMany()
            .HasForeignKey(t => t.GebruikerId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne<Klas>()
            .WithMany()
            .HasForeignKey(t => t.KlasId)
            .OnDelete(DeleteBehavior.Cascade);

        // One link per pair, in the database, so two admin tabs linking the same leerkracht cannot make two.
        builder.HasIndex(t => new { t.GebruikerId, t.KlasId }).IsUnique();
    }
}
