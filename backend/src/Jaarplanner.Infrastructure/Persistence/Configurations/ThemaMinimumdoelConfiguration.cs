using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Schoolcontent;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Jaarplanner.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core mapping for <see cref="ThemaMinimumdoel"/>, a minimumdoel a thema aims at as a themadoel (FB-043,
/// ADR-0046). The row holds the ref and nothing the concordance already knows.
/// </summary>
public sealed class ThemaMinimumdoelConfiguration : IEntityTypeConfiguration<ThemaMinimumdoel>
{
    public void Configure(EntityTypeBuilder<ThemaMinimumdoel> builder)
    {
        builder.ToTable("thema_minimumdoelen");

        builder.HasKey(m => m.Id);
        builder.Property(m => m.ThemaId).IsRequired();
        builder.Property(m => m.MinimumdoelRef).HasColumnName("minimumdoel_ref").HasMaxLength(64).IsRequired();

        // FK to the read-only minimumdoel by its stable ref (Art. III.5). Restrict: reference data is not deleted by the
        // app (Art. III.1), and a link must not dangle.
        builder.HasOne<Minimumdoel>()
            .WithMany()
            .HasForeignKey(m => m.MinimumdoelRef)
            .HasPrincipalKey(m => m.Ref)
            .OnDelete(DeleteBehavior.Restrict);

        // The domain refuses a second link to the same minimumdoel; the index says so where two requests could race.
        builder.HasIndex(m => new { m.ThemaId, m.MinimumdoelRef }).IsUnique();
        builder.HasIndex(m => m.MinimumdoelRef);
    }
}
