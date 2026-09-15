using Jaarplanner.Domain.Ontwikkelingsrapport;
using Jaarplanner.Domain.Planning;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Jaarplanner.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core mapping for <see cref="Leerling"/> (FB-001, Art. IX.4): a child of a K3 klas, pupil data (Art. VI.7).
/// <para>
/// <b>Four columns and no more</b>: the id, the klas, the voornaam and the achternaam. Nothing else about a child is
/// stored (Art. VI.7), and <c>LeerlingTests</c> reads this mapping back to pin it.
/// </para>
/// <para>
/// <b><c>Restrict</c> on the klas, unlike the hoeken and algemene fiches beside it, which cascade.</b> A klas delete
/// must not silently take a child and, from FB-003 on, every report written for that child: those are for the parents,
/// and deleting them is directie's deliberate act (ADR-0035 §3.7, D7, D8). <c>KlasBeheerService</c> refuses the delete
/// first with a sentence that says what to do, so the FK only has to hold against a path that forgets.
/// </para>
/// </summary>
public sealed class LeerlingConfiguration : IEntityTypeConfiguration<Leerling>
{
    public void Configure(EntityTypeBuilder<Leerling> builder)
    {
        builder.ToTable("leerlingen");

        builder.HasKey(l => l.Id);
        builder.Property(l => l.Id).ValueGeneratedNever();

        builder.Property(l => l.KlasId).IsRequired();
        builder.Property(l => l.Voornaam).HasMaxLength(Leerling.MaxNaamLengte).IsRequired();
        builder.Property(l => l.Achternaam).HasMaxLength(Leerling.MaxNaamLengte).IsRequired();

        // The list screen reads one klas's children; no uniqueness, since two children may share a name.
        builder.HasIndex(l => l.KlasId);

        builder.HasOne<Klas>()
            .WithMany()
            .HasForeignKey(l => l.KlasId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
