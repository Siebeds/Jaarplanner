using Jaarplanner.Domain.Planning;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Jaarplanner.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core mapping for <see cref="Klas"/> (Art. IX.3). Minimal for E1-02 — it exists so the
/// class/age-scoped school content can express its required <see cref="Klas"/> association.
/// </summary>
public sealed class KlasConfiguration : IEntityTypeConfiguration<Klas>
{
    public void Configure(EntityTypeBuilder<Klas> builder)
    {
        builder.ToTable("klassen");

        builder.HasKey(k => k.Id);

        builder.Property(k => k.Naam).HasMaxLength(128).IsRequired();
        builder.Property(k => k.Leerjaar).IsRequired();
    }
}
