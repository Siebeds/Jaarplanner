using Jaarplanner.Domain.Ontwikkelingsrapport;
using Jaarplanner.Domain.Schoolcontent;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Jaarplanner.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core mapping for <see cref="Rapportdoel"/> (FB-002, Art. IX.4): one group of the one K3 set. No schooljaar column
/// (ADR-0035 R7). Its subdoelen are <see cref="RapportdoelSubdoel"/> rows, which go with it on delete.
/// </summary>
public sealed class RapportdoelConfiguration : IEntityTypeConfiguration<Rapportdoel>
{
    public void Configure(EntityTypeBuilder<Rapportdoel> builder)
    {
        builder.ToTable("rapportdoelen");

        builder.HasKey(r => r.Id);
        builder.Property(r => r.Id).ValueGeneratedNever();

        builder.Property(r => r.Titel).HasMaxLength(Rapportdoel.MaxTitelLengte).IsRequired();
        builder.Property(r => r.Volgorde).IsRequired();

        builder.HasMany(r => r.Subdoelen)
            .WithOne()
            .HasForeignKey(rs => rs.RapportdoelId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.Navigation(r => r.Subdoelen)
            .HasField("_subdoelen")
            .UsePropertyAccessMode(PropertyAccessMode.Field);
    }
}

/// <summary>
/// EF Core mapping for <see cref="RapportdoelSubdoel"/>: the join <c>rapportdoel_subdoelen</c>, keyed by the pair.
/// <para>
/// <b><c>Cascade</c> on the subdoel, and that is ADR-0035 D3.</b> Every path that deletes a subdoel (a subthema delete,
/// the thema delete's cascade, a hoofdleerkracht's subdoel delete, the FR-1 re-import, the wizard) deletes this row with
/// it in the database, whether or not it loaded the row, while the rapportdoel keeps its titel. <c>Subdoel</c> and
/// <c>Subthema</c> stay unaware of the report: the relation has no navigation on their side.
/// </para>
/// </summary>
public sealed class RapportdoelSubdoelConfiguration : IEntityTypeConfiguration<RapportdoelSubdoel>
{
    public void Configure(EntityTypeBuilder<RapportdoelSubdoel> builder)
    {
        builder.ToTable("rapportdoel_subdoelen");

        builder.HasKey(rs => new { rs.RapportdoelId, rs.SubdoelId });

        builder.HasOne<Subdoel>()
            .WithMany()
            .HasForeignKey(rs => rs.SubdoelId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
