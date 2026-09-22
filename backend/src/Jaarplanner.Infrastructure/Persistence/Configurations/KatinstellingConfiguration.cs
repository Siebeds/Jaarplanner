using Jaarplanner.Domain.Kat;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Jaarplanner.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core mapping for <see cref="Katinstelling"/> (FB-071, ADR-0064). The fixed id is what keeps it one row: the
/// service only ever reads and writes <see cref="Katinstelling.EnigeId"/>.
/// </summary>
public sealed class KatinstellingConfiguration : IEntityTypeConfiguration<Katinstelling>
{
    public void Configure(EntityTypeBuilder<Katinstelling> builder)
    {
        builder.ToTable("katinstelling");

        builder.HasKey(k => k.Id);
        builder.Property(k => k.Id).ValueGeneratedNever();
        builder.Property(k => k.IsZichtbaar).IsRequired();
    }
}
