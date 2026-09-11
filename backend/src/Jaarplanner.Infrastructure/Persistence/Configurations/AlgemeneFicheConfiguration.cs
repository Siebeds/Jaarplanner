using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Jaarplanner.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core mapping for <see cref="AlgemeneFiche"/>: a recurring activity of one class, outside every thema (owner,
/// 2026-09-11).
/// <para>
/// <b>Shaped like <c>hoeken</c>:</b> an FK to <c>klassen</c> and nothing else, a unique name per class, and a cascade
/// on the klas, which is the owner's ruling for hoeken (2026-08-31, question 9) applied to the sibling it mirrors: a
/// class that is deleted takes its week with it.
/// </para>
/// <para>
/// <b>The goal links are an owned collection in their own table</b>, through the shared
/// <see cref="DoelKoppelingMapping"/>, so the column shape and the Restrict FK to the read-only leerplandoel are the
/// ones every other link table has. That FK is also why <c>OpstapImportService</c> must count these links before a
/// re-import may drop a code.
/// </para>
/// </summary>
public sealed class AlgemeneFicheConfiguration : IEntityTypeConfiguration<AlgemeneFiche>
{
    public void Configure(EntityTypeBuilder<AlgemeneFiche> builder)
    {
        builder.ToTable("algemene_fiches");

        builder.HasKey(f => f.Id);
        builder.Property(f => f.Id).ValueGeneratedNever();

        builder.Property(f => f.KlasId).IsRequired();
        builder.Property(f => f.Naam).HasMaxLength(256).IsRequired();
        builder.Property(f => f.Omschrijving);

        // One name per class: it is what the teacher reads on a fiche in the side panel, and two cards reading
        // "turnen" in one list could not be told apart.
        builder.HasIndex(f => new { f.KlasId, f.Naam }).IsUnique();

        builder.HasOne<Klas>()
            .WithMany()
            .HasForeignKey(f => f.KlasId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.OwnsMany(f => f.Doelkoppelingen, koppeling =>
        {
            koppeling.ToTable("algemene_fiche_doelkoppelingen");
            DoelKoppelingMapping.Configure(koppeling);
        });
        builder.Navigation(f => f.Doelkoppelingen)
            .HasField("_doelkoppelingen")
            .UsePropertyAccessMode(PropertyAccessMode.Field);
    }
}
