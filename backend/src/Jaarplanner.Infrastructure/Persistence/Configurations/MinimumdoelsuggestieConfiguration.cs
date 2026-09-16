using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Schoolcontent;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace Jaarplanner.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core mapping for <see cref="Minimumdoelsuggestie"/>, the AI's proposal of a minimumdoel as a themadoel (FB-053,
/// ADR-0050). The status is stored by name, as on every <c>DoelKoppeling</c> (Art. IV.2).
/// </summary>
public sealed class MinimumdoelsuggestieConfiguration : IEntityTypeConfiguration<Minimumdoelsuggestie>
{
    private static readonly ValueConverter<KoppelingStatus, string> StatusConverter =
        new(s => s.ToString(), s => Enum.Parse<KoppelingStatus>(s));

    public void Configure(EntityTypeBuilder<Minimumdoelsuggestie> builder)
    {
        builder.ToTable("thema_minimumdoelsuggesties");

        builder.HasKey(s => s.Id);
        builder.Property(s => s.ThemaId).IsRequired();
        builder.Property(s => s.MinimumdoelRef).HasColumnName("minimumdoel_ref").HasMaxLength(64).IsRequired();
        builder.Property(s => s.Status)
            .HasConversion(StatusConverter)
            .HasColumnName("status")
            .HasMaxLength(16)
            .IsRequired();
        builder.Property(s => s.AiMotivatie).HasColumnName("ai_motivatie").IsRequired();
        builder.Property(s => s.Rang).HasColumnName("rang").IsRequired();

        // FK to the read-only minimumdoel by its stable ref (Art. III.5). Restrict: reference data is not deleted by the
        // app (Art. III.1), and a proposal must not dangle.
        builder.HasOne<Minimumdoel>()
            .WithMany()
            .HasForeignKey(s => s.MinimumdoelRef)
            .HasPrincipalKey(m => m.Ref)
            .OnDelete(DeleteBehavior.Restrict);

        // One proposal per minimumdoel per thema: the domain refuses a second, the index says so where runs could race.
        builder.HasIndex(s => new { s.ThemaId, s.MinimumdoelRef }).IsUnique();
        builder.HasIndex(s => s.MinimumdoelRef);
    }
}
