using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Jaarplanner.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core mapping for <see cref="Hoek"/> — a learning corner of one class (owner, meeting 2026-08-30).
/// <para>
/// <b>The FK is to <c>klassen</c> and to nothing else.</b> Every other school-content table reaches a class
/// through a thema or a subthema; this one states it. A hoek is furniture in a room, so the room is its whole
/// scope, and the unique index below therefore keys on the class as well: two classes may each have a
/// "boekenhoek", one class may not have two.
/// </para>
/// <para>
/// <b>Cascade on the klas, and it is the same call <c>KlasConfiguration</c> makes for its other dependants.</b> A
/// corner is a statement about a classroom; delete the class and there is no room for it to be in. The teacher's
/// authored text lives one level further down, on a <c>Hoekverrijking</c> under a <see cref="Hoekplaatsing"/>,
/// and that path is protected by <c>Restrict</c> instead — see <c>HoekplaatsingConfiguration</c>. So deleting a
/// klas that still has placed hoeken is refused by that FK before it ever reaches this one.
/// </para>
/// </summary>
public sealed class HoekConfiguration : IEntityTypeConfiguration<Hoek>
{
    public void Configure(EntityTypeBuilder<Hoek> builder)
    {
        builder.ToTable("hoeken");

        builder.HasKey(h => h.Id);

        // Assigned in the constructor. Same line and same reason as on every other table here: with the default
        // `OnAdd`, an entity added to an already-tracked graph is treated as Modified and SaveChanges issues an
        // UPDATE against a row that does not exist.
        builder.Property(h => h.Id).ValueGeneratedNever();

        builder.Property(h => h.KlasId).IsRequired();
        builder.Property(h => h.Naam).IsRequired();
        builder.Property(h => h.Omschrijving);

        // One name per class. It is the name the teacher reads on a fiche in the sidepane, so two rows reading
        // "boekenhoek" in one list would be two identical cards she cannot tell apart.
        builder.HasIndex(h => new { h.KlasId, h.Naam }).IsUnique();

        builder.HasOne<Klas>()
            .WithMany()
            .HasForeignKey(h => h.KlasId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
