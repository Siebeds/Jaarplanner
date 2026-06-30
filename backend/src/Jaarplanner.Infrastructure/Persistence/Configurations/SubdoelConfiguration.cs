using Jaarplanner.Domain.Schoolcontent;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Jaarplanner.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core mapping for <see cref="Subdoel"/> — class/age-scoped (Art. IX.2). It inherits the class
/// scope from its owning subthema and pins its own <see cref="Subdoel.Leeftijd"/> for the
/// per-<c>(subthema × leeftijd)</c> differentiation. It owns one <see cref="DoelKoppeling"/>.
/// </summary>
public sealed class SubdoelConfiguration : IEntityTypeConfiguration<Subdoel>
{
    public void Configure(EntityTypeBuilder<Subdoel> builder)
    {
        builder.ToTable("subdoelen");

        builder.HasKey(sd => sd.Id);
        builder.Property(sd => sd.SubthemaId).IsRequired();
        builder.Property(sd => sd.Leeftijd).HasMaxLength(8).IsRequired();

        builder.OwnsOne(sd => sd.Koppeling, DoelKoppelingMapping.Configure);
        builder.Navigation(sd => sd.Koppeling).IsRequired();
    }
}
