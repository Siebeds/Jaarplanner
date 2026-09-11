using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Jaarplanner.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core mapping for <see cref="AlgemeneFicheplaatsing"/> and the <see cref="AlgemeneFichemoment"/>en it owns
/// (owner, 2026-09-11).
/// <para>
/// <b>The same three choices as <c>hoekplaatsingen</c>, for the same reasons:</b> two dates and no planningsblok
/// (ADR-0013, a window drawn in a mini calendar is not a derived boundary); no FK to <c>jaarplannen</c> (a
/// regeneration cannot reach what is not in its aggregate); and RESTRICT on the fiche, so deleting a planned fiche
/// is refused with a Dutch sentence by <c>AlgemeneFicheBeheerService</c> before the database can raise a bare 23503.
/// For a fiche the Restrict protects dekking as well as the timetable: a planned fiche's goals count, and they must
/// not stop counting as the side effect of a delete the teacher did not read as one.
/// </para>
/// </summary>
public sealed class AlgemeneFicheplaatsingConfiguration : IEntityTypeConfiguration<AlgemeneFicheplaatsing>
{
    public void Configure(EntityTypeBuilder<AlgemeneFicheplaatsing> builder)
    {
        builder.ToTable("algemene_ficheplaatsingen");

        builder.HasKey(p => p.Id);
        builder.Property(p => p.Id).ValueGeneratedNever();

        builder.Property(p => p.KlasId).IsRequired();
        builder.Property(p => p.AlgemeneFicheId).IsRequired();
        builder.Property(p => p.Van).IsRequired();
        builder.Property(p => p.Tot).IsRequired();

        // The agenda's access pattern: every placement overlapping the range on screen, for one class. The dekking
        // read asks "which fiches of this class are planned at all", which the same index serves on its prefix.
        builder.HasIndex(p => new { p.KlasId, p.Van, p.Tot });

        builder.HasOne<Klas>()
            .WithMany()
            .HasForeignKey(p => p.KlasId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne<AlgemeneFiche>()
            .WithMany()
            .HasForeignKey(p => p.AlgemeneFicheId)
            .OnDelete(DeleteBehavior.Restrict);

        // One row per day the fiche happens on, cascading with the placement: a day of a run that no longer
        // exists has nothing to schedule.
        builder.HasMany(p => p.Momenten)
            .WithOne()
            .HasForeignKey(m => m.PlaatsingId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.Navigation(p => p.Momenten)
            .HasField("_momenten")
            .UsePropertyAccessMode(PropertyAccessMode.Field);
    }
}
