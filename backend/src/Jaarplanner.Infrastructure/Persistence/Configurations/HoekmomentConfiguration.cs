using Jaarplanner.Domain.Planning;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Jaarplanner.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core mapping for <see cref="Hoekmoment"/> — one appearance of a placed hoek in the timetable, on one day at
/// one lesuur (owner, 2026-08-30).
/// <para>
/// The FK and its cascade are configured on the owning side, in <c>HoekplaatsingConfiguration</c>. This file maps
/// the table, its columns and the index the day view reads through.
/// </para>
/// <para>
/// <b>No unique index on (day, lesuur).</b> The aggregate forbids ONE placement taking the same slot twice, which
/// is the only combination that means nothing; two different placements of the same hoek landing on one day is
/// exactly what a teacher does when she wants two enrichments at once, and a database constraint spanning
/// placements would forbid it. The check that does exist lives in <see cref="Hoekplaatsing.PlanIn"/>, where the
/// siblings are visible.
/// </para>
/// </summary>
public sealed class HoekmomentConfiguration : IEntityTypeConfiguration<Hoekmoment>
{
    public void Configure(EntityTypeBuilder<Hoekmoment> builder)
    {
        builder.ToTable("hoekmomenten");

        builder.HasKey(m => m.Id);
        builder.Property(m => m.Id).ValueGeneratedNever();

        builder.Property(m => m.HoekplaatsingId).IsRequired();

        // DateOnly -> PostgreSQL `date`.
        builder.Property(m => m.Datum).IsRequired();

        // Zero-based lesuur slot, like Activiteitplaatsing.Volgorde.
        builder.Property(m => m.Volgorde).IsRequired();

        // The day and week views read one date range and order within each day.
        builder.HasIndex(m => new { m.Datum, m.Volgorde });
    }
}
