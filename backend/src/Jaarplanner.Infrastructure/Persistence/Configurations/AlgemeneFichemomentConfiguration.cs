using Jaarplanner.Domain.Planning;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Jaarplanner.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core mapping for <see cref="AlgemeneFichemoment"/>: one occurrence of a planned fiche, on one day from one time to
/// another. The FK and its cascade live on the owning side, in <see cref="AlgemeneFicheplaatsingConfiguration"/>.
/// <para>
/// <b>No unique index on (day, start)</b>, like <c>hoekmomenten</c>: the aggregate forbids one placement starting
/// twice at the same time, and two placements meeting on one day is a legitimate plan the database must not forbid.
/// </para>
/// </summary>
public sealed class AlgemeneFichemomentConfiguration : IEntityTypeConfiguration<AlgemeneFichemoment>
{
    public void Configure(EntityTypeBuilder<AlgemeneFichemoment> builder)
    {
        builder.ToTable("algemene_fichemomenten");

        builder.HasKey(m => m.Id);
        builder.Property(m => m.Id).ValueGeneratedNever();

        builder.Property(m => m.PlaatsingId).IsRequired();
        builder.Property(m => m.Datum).IsRequired();

        // TimeOnly -> PostgreSQL `time`, the pair Hoekmoment and Activiteitplaatsing carry on the same time grid.
        builder.Property(m => m.Begin).IsRequired();
        builder.Property(m => m.Einde).IsRequired();

        builder.HasIndex(m => new { m.Datum, m.Begin });
    }
}
