using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Schoolcontent;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Jaarplanner.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core mapping for <see cref="Themadoel"/> — school-scoped (Art. IX.2). It owns one
/// <see cref="DoelKoppeling"/> (status + AI motivation, Art. IV.2) which carries the FK to the
/// read-only leerplandoel. The 2–3 upper bound is a domain invariant enforced in
/// <see cref="Thema.VoegThemadoelToe"/> (not a DB constraint).
/// </summary>
public sealed class ThemadoelConfiguration : IEntityTypeConfiguration<Themadoel>
{
    public void Configure(EntityTypeBuilder<Themadoel> builder)
    {
        builder.ToTable("themadoelen");

        builder.HasKey(td => td.Id);
        builder.Property(td => td.ThemaId).IsRequired();

        builder.OwnsOne(td => td.Koppeling, DoelKoppelingMapping.Configure);
        builder.Navigation(td => td.Koppeling).IsRequired();
    }
}
