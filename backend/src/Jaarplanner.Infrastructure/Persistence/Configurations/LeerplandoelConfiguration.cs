using Jaarplanner.Domain.Curriculum;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace Jaarplanner.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core mapping for <see cref="Leerplandoel"/> (read-only Op.stap reference data, Art. III.1).
/// Identity is the unique <see cref="Leerplandoel.Code"/> (Art. III.5); the composite
/// <c>(domein, subdomein)</c> grouping is indexed for the browse/roll-up queries (Art. VII.0);
/// <see cref="Leerplandoel.Cluster"/> stays nullable. <see cref="Leerplandoel.Doelsoort"/> is
/// persisted as its official short code via the single-source <see cref="DoelsoortCodes"/> mapping.
/// </summary>
public sealed class LeerplandoelConfiguration : IEntityTypeConfiguration<Leerplandoel>
{
    public void Configure(EntityTypeBuilder<Leerplandoel> builder)
    {
        builder.ToTable("leerplandoelen");

        builder.HasKey(l => l.Code);

        builder.Property(l => l.Code).HasMaxLength(64);

        // Persist the enum as its official Op.stap short code (MD/G/+/P/S/A) through the
        // single-source mapping (Art. III.3) — stable and legible in the database.
        var doelsoortConverter = new ValueConverter<Doelsoort, string>(
            d => d.ToCode(),
            code => DoelsoortCodes.FromCode(code));
        builder.Property(l => l.Doelsoort)
            .HasConversion(doelsoortConverter)
            .HasColumnName("doelsoort")
            .HasMaxLength(4)
            .IsRequired();

        builder.Property(l => l.JaarFase).HasMaxLength(8).IsRequired();
        builder.Property(l => l.Domein).HasMaxLength(256).IsRequired();
        builder.Property(l => l.Subdomein).HasMaxLength(256).IsRequired();
        builder.Property(l => l.DisciplineNummer).HasMaxLength(16).IsRequired();
        builder.Property(l => l.Cluster).HasMaxLength(256); // nullable — Art. VII.0
        builder.Property(l => l.Tekst).IsRequired();
        builder.Property(l => l.Voorbeelden);
        builder.Property(l => l.Toelichting);
        builder.Property(l => l.Woordenschat);
        builder.Property(l => l.MinimumdoelRef).HasMaxLength(64);

        // The grouping/browse key is the composite (domein, subdomein) — subdomein names
        // are not globally unique (Art. VII.0), so this index backs roll-ups and filters.
        builder.HasIndex(l => new { l.Domein, l.Subdomein });

        // Each leerplandoel belongs to a discipline (the source Excel).
        builder.HasOne<Discipline>()
            .WithMany()
            .HasForeignKey(l => l.DisciplineNummer)
            .OnDelete(DeleteBehavior.Restrict);

        // Optional concordance to a minimumdoel (Art. IX.1): nullable FK on the shared ref key.
        builder.HasOne<Minimumdoel>()
            .WithMany()
            .HasForeignKey(l => l.MinimumdoelRef)
            .HasPrincipalKey(m => m.Ref)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(l => l.MinimumdoelRef);
    }
}
