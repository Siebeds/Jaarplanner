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
/// <b>Cascade on the klas: deleting a class takes its corners, their placements and everything written in
/// them.</b> A corner is a statement about a classroom, and there is no room left to make it about.
/// </para>
/// <para>
/// <b>THIS PARAGRAPH SAID THE OPPOSITE AND WAS MEASURABLY WRONG.</b> It claimed the <c>Restrict</c> FK from
/// <c>hoekplaatsingen</c> to <c>hoeken</c> would refuse the klas delete before it reached here. It does not:
/// <c>hoekplaatsingen</c> also has a CASCADE FK to <c>klassen</c>, so PostgreSQL removes the placements by that
/// edge and the Restrict edge never fires. An antagonist audit reproduced this migration's exact table and
/// constraint order against real PostgreSQL 17 and deleted a klas holding one of each: <c>DELETE 1</c>, and all
/// four tables emptied. Nothing was refused. The comment had been protecting nobody while reading as though it
/// were the guard.
/// </para>
/// <para>
/// <b>The cascade is now the decision rather than the accident</b> (owner ruling, 2026-08-31, on the second half
/// of question 9 in <c>docs/besluiten-gevraagd.md</c>): a klas delete takes the hoeken with it, and the
/// confirmation the teacher reads says so (<c>klasbeheer.verwijderGevolg</c>). The alternative, refusing while any
/// hoek is placed, was rejected: it would make her clear a year of corners by hand before she could remove a class
/// she has already decided to remove.
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
