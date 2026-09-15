using Jaarplanner.Domain.Ontwikkelingsrapport;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
// The type shares its name with its namespace (Art. IX.4 names it), which the Infrastructure namespace of the same name
// would shadow here.
using Rapportentiteit = Jaarplanner.Domain.Ontwikkelingsrapport.Ontwikkelingsrapport;

namespace Jaarplanner.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core mapping for the kindtekening of a report (FB-005, ADR-0035 §3.6 and D15): pupil data (Art. VI.7).
/// <para>
/// <b>In PostgreSQL, in a table of its own</b> (D15), keyed by its report so there is at most one per report (R10), and so
/// reading a report never loads an image. <b><c>Cascade</c> on the report</b>: the drawing goes with its report, and so
/// with its child (D8) and a wiped schooljaar (D7).
/// </para>
/// <para>
/// No navigation from the report: nothing that loads a report can pull the image in by accident.
/// </para>
/// </summary>
public sealed class KindtekeningConfiguration : IEntityTypeConfiguration<Kindtekening>
{
    public void Configure(EntityTypeBuilder<Kindtekening> builder)
    {
        builder.ToTable("kindtekeningen", tabel =>
        {
            tabel.HasCheckConstraint("CK_kindtekeningen_Breedte", "\"Breedte\" > 0");
            tabel.HasCheckConstraint("CK_kindtekeningen_Hoogte", "\"Hoogte\" > 0");
        });

        builder.HasKey(t => t.OntwikkelingsrapportId);
        builder.Property(t => t.OntwikkelingsrapportId).ValueGeneratedNever();

        builder.Property(t => t.Versie).IsRequired();
        builder.Property(t => t.Formaat).HasConversion<string>().HasMaxLength(8).IsRequired();
        builder.Property(t => t.Breedte).IsRequired();
        builder.Property(t => t.Hoogte).IsRequired();
        builder.Property(t => t.Inhoud).IsRequired();
        builder.Ignore(t => t.MediaType);

        builder.HasOne<Rapportentiteit>()
            .WithOne()
            .HasForeignKey<Kindtekening>(t => t.OntwikkelingsrapportId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
