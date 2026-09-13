using Jaarplanner.Domain.Curriculum;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Jaarplanner.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core mapping for <see cref="Minimumdoel"/> (decreed eindterm, read-only — Art. III.1).
/// <see cref="Minimumdoel.Ref"/> (the concordance key, Excel D) is the primary key.
/// </summary>
public sealed class MinimumdoelConfiguration : IEntityTypeConfiguration<Minimumdoel>
{
    public void Configure(EntityTypeBuilder<Minimumdoel> builder)
    {
        builder.ToTable("minimumdoelen");

        builder.HasKey(m => m.Ref);

        builder.Property(m => m.Ref).HasMaxLength(64);
        builder.Property(m => m.Leeftijd).HasMaxLength(8).IsRequired();
        builder.Property(m => m.Nr).HasMaxLength(32).IsRequired();
        builder.Property(m => m.Omschrijving).IsRequired();

        // Import-managed review flag (E1-21, ADR-0032 consequences): set when an applied import no longer finds the ref,
        // cleared when a later one does. Never written by normal app code; defaults false, as for leerplandoelen.
        builder.Property(m => m.NietMeerInOpstap)
            .HasColumnName("niet_meer_in_opstap")
            .HasDefaultValue(false)
            .IsRequired();

        // Import-managed (E1-22): why no loaded leerplandoel concords it, recomputed by every applied leerplandoelen
        // import. Stored by name, so a reordered enum cannot silently change what a row says.
        builder.Property(m => m.ZonderLeerplandoelReden)
            .HasColumnName("zonder_leerplandoel_reden")
            .HasConversion<string>()
            .HasMaxLength(32);
        builder.Property(m => m.ZonderLeerplandoelDoelsets)
            .HasColumnName("zonder_leerplandoel_doelsets")
            .HasMaxLength(32);
    }
}
