using Jaarplanner.Domain.Curriculum;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Jaarplanner.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core mapping for <see cref="Opstapversie"/> (E1-21, ADR-0032 decision 6): one row per applied import of KOV's
/// curriculum, naming the numbered snapshot it read and KOV's hash for it. Indexed on the apply time because the only
/// read is "the most recent one".
/// </summary>
public sealed class OpstapversieConfiguration : IEntityTypeConfiguration<Opstapversie>
{
    public void Configure(EntityTypeBuilder<Opstapversie> builder)
    {
        builder.ToTable("opstapversies");

        builder.HasKey(v => v.Id);

        builder.Property(v => v.Versie).HasMaxLength(16).IsRequired();
        builder.Property(v => v.Hash).HasMaxLength(64).IsRequired();
        builder.Property(v => v.ToegepastOp).IsRequired();

        builder.HasIndex(v => v.ToegepastOp);
    }
}
