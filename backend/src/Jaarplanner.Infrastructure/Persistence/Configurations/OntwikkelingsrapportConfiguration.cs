using Jaarplanner.Domain.Ontwikkelingsrapport;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
// The type shares its name with its namespace (Art. IX.4 names it), which the Infrastructure namespace of the same name
// would shadow here.
using Rapportentiteit = Jaarplanner.Domain.Ontwikkelingsrapport.Ontwikkelingsrapport;

namespace Jaarplanner.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core mapping for the ontwikkelingsrapport of one child at one moment (FB-003, Art. IX.4): pupil data (Art. VI.7).
/// <para>
/// <b><c>Cascade</c> on the leerling</b>: deleting a child deletes every report of theirs (ADR-0035 D8), and wiping a
/// schooljaar's children does the same (D7, FB-007). The leerling itself is <c>Restrict</c> on its klas, so a klas delete
/// still cannot reach a report.
/// </para>
/// <para>
/// One report per (leerling, moment), held by a unique index, and the moment held to 1..3 by a check constraint as well
/// as by the domain, since the route and the domain are not the only ways a row can be written.
/// </para>
/// </summary>
public sealed class OntwikkelingsrapportConfiguration : IEntityTypeConfiguration<Rapportentiteit>
{
    public void Configure(EntityTypeBuilder<Rapportentiteit> builder)
    {
        builder.ToTable("ontwikkelingsrapporten", tabel => tabel.HasCheckConstraint(
            "CK_ontwikkelingsrapporten_Moment",
            $"\"Moment\" BETWEEN {Evaluatiemoment.Eerste} AND {Evaluatiemoment.Laatste}"));

        builder.HasKey(r => r.Id);
        builder.Property(r => r.Id).ValueGeneratedNever();

        builder.Property(r => r.LeerlingId).IsRequired();
        builder.Property(r => r.Moment).IsRequired();
        builder.Property(r => r.Besluit).HasMaxLength(Rapportentiteit.MaxBesluitLengte);
        builder.Property(r => r.BesluitStatus).HasConversion<string>().HasMaxLength(16);

        // The rejected-rewrite mark (FB-004, R23): a flag, never the text that was proposed. Non-null with a false
        // default, so every row written before FB-004 reads as "no rewrite was rejected", which is what was true.
        builder.Property(r => r.BesluitHerschrijvingGeweigerd).IsRequired().HasDefaultValue(false);

        builder.HasIndex(r => new { r.LeerlingId, r.Moment }).IsUnique();

        builder.HasOne<Leerling>()
            .WithMany()
            .HasForeignKey(r => r.LeerlingId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(r => r.Beoordelingen)
            .WithOne()
            .HasForeignKey(b => b.OntwikkelingsrapportId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.Navigation(r => r.Beoordelingen)
            .HasField("_beoordelingen")
            .UsePropertyAccessMode(PropertyAccessMode.Field);
    }
}

/// <summary>
/// EF Core mapping for <see cref="Rapportbeoordeling"/>: one star and text per (report, rapportdoel), keyed by the pair.
/// <para>
/// <b><c>Restrict</c> on the rapportdoel and on the gradatie, and that is ADR-0035 D1</b>: a gradatie or rapportdoel a
/// report uses cannot be deleted, only renamed or reordered. <c>RapportsetService</c> refuses first with a sentence that
/// says so; the foreign keys hold it against a path that forgets. The two indexes serve exactly those checks.
/// </para>
/// </summary>
public sealed class RapportbeoordelingConfiguration : IEntityTypeConfiguration<Rapportbeoordeling>
{
    public void Configure(EntityTypeBuilder<Rapportbeoordeling> builder)
    {
        builder.ToTable("rapportbeoordelingen");

        builder.HasKey(b => new { b.OntwikkelingsrapportId, b.RapportdoelId });

        builder.Property(b => b.Tekst).HasMaxLength(Rapportentiteit.MaxTekstLengte);
        builder.Property(b => b.TekstStatus).HasConversion<string>().HasMaxLength(16);
        builder.Property(b => b.HerschrijvingGeweigerd).IsRequired().HasDefaultValue(false);

        builder.HasIndex(b => b.RapportdoelId);
        builder.HasIndex(b => b.GradatieId);

        builder.HasOne<Rapportdoel>()
            .WithMany()
            .HasForeignKey(b => b.RapportdoelId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<Gradatie>()
            .WithMany()
            .HasForeignKey(b => b.GradatieId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
