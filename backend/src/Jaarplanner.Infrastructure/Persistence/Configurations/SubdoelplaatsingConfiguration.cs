using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Schoolcontent;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace Jaarplanner.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core mapping for <see cref="Subthemavoorstel"/> (FB-057, ADR-0050). It goes with its thema; the subthema it
/// created outlives it as ordinary content, so that link is cleared, not cascaded.
/// </summary>
public sealed class SubthemavoorstelConfiguration : IEntityTypeConfiguration<Subthemavoorstel>
{
    internal static readonly ValueConverter<KoppelingStatus, string> StatusConverter =
        new(s => s.ToString(), s => Enum.Parse<KoppelingStatus>(s));

    public void Configure(EntityTypeBuilder<Subthemavoorstel> builder)
    {
        builder.ToTable("subthemavoorstellen");

        builder.HasKey(v => v.Id);
        builder.Property(v => v.Leeftijd).HasMaxLength(8).IsRequired();
        builder.Property(v => v.Naam).HasMaxLength(Subthemavoorstel.MaxNaamlengte).IsRequired();
        builder.Property(v => v.Onderzoeksvraag).IsRequired();
        builder.Property(v => v.DuurWeken).IsRequired();
        builder.Property(v => v.Status).HasConversion(StatusConverter).HasMaxLength(16).IsRequired();
        builder.Property(v => v.AiMotivatie).IsRequired();

        builder.HasOne<Thema>()
            .WithMany()
            .HasForeignKey(v => v.ThemaId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne<Subthema>()
            .WithMany()
            .HasForeignKey(v => v.SubthemaId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasIndex(v => new { v.ThemaId, v.Leeftijd });
    }
}

/// <summary>
/// EF Core mapping for <see cref="Subdoelvoorstel"/> (FB-057, ADR-0050). Every foreign key cascades: a proposal about a
/// thema, a subthema, a proposed subthema or a goal that is gone has nothing left to propose (D5). The goal link
/// cascades too, unlike a decided <see cref="DoelKoppeling"/>, so an open proposal never blocks an Op.stap re-import.
/// </summary>
public sealed class SubdoelvoorstelConfiguration : IEntityTypeConfiguration<Subdoelvoorstel>
{
    public void Configure(EntityTypeBuilder<Subdoelvoorstel> builder)
    {
        // Exactly one destination (ADR-0050): an existing subthema or a proposed one.
        builder.ToTable("subdoelvoorstellen", tabel => tabel.HasCheckConstraint(
            "CK_subdoelvoorstellen_EenBestemming",
            "(\"SubthemaId\" IS NULL) <> (\"SubthemavoorstelId\" IS NULL)"));

        builder.HasKey(v => v.Id);
        builder.Property(v => v.Leeftijd).HasMaxLength(8).IsRequired();
        builder.Property(v => v.LeerplandoelCode).HasColumnName("leerplandoel_code").HasMaxLength(64).IsRequired();
        builder.Property(v => v.Status).HasConversion(SubthemavoorstelConfiguration.StatusConverter).HasMaxLength(16).IsRequired();
        builder.Property(v => v.AiMotivatie).IsRequired();
        builder.Ignore(v => v.IsOpen);

        builder.HasOne<Thema>()
            .WithMany()
            .HasForeignKey(v => v.ThemaId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne<Subthema>()
            .WithMany()
            .HasForeignKey(v => v.SubthemaId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne<Subthemavoorstel>()
            .WithMany()
            .HasForeignKey(v => v.SubthemavoorstelId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne<Leerplandoel>()
            .WithMany()
            .HasForeignKey(v => v.LeerplandoelCode)
            .HasPrincipalKey(l => l.Code)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(v => new { v.ThemaId, v.Leeftijd });
        builder.HasIndex(v => v.LeerplandoelCode);
    }
}
