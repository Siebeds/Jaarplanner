using Jaarplanner.Domain.Schoolcontent;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Jaarplanner.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core mapping for <see cref="Thema"/> — school-scoped autonomous content (Art. IX.2).
/// The two-tier vocabulary (<see cref="Thema.Kernwoordenschat"/> / <see cref="Thema.RijkeWoordenschat"/>)
/// is mapped as PostgreSQL <c>text[]</c> primitive collections (school-wide, by design).
/// Themadoelen and subthema's are owned/related collections accessed through their backing fields.
/// </summary>
public sealed class ThemaConfiguration : IEntityTypeConfiguration<Thema>
{
    public void Configure(EntityTypeBuilder<Thema> builder)
    {
        builder.ToTable("themas");

        builder.HasKey(t => t.Id);

        builder.Property(t => t.Naam).HasMaxLength(256).IsRequired();
        builder.Property(t => t.Invalshoeken);
        builder.Property(t => t.DuurWeken).IsRequired();

        // School-wide two-tier vocabulary — Npgsql maps List<string> to text[] (Art. IX.2).
        builder.PrimitiveCollection(t => t.Kernwoordenschat)
            .HasField("_kernwoordenschat");
        builder.PrimitiveCollection(t => t.RijkeWoordenschat)
            .HasField("_rijkeWoordenschat");

        // School-scoped themadoelen (2–3) — owned relationship, accessed via backing field.
        builder.HasMany(t => t.Themadoelen)
            .WithOne()
            .HasForeignKey(td => td.ThemaId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.Navigation(t => t.Themadoelen)
            .HasField("_themadoelen")
            .UsePropertyAccessMode(PropertyAccessMode.Field);

        // Class/age-scoped subthema's belong to the school-wide thema.
        builder.HasMany(t => t.Subthemas)
            .WithOne()
            .HasForeignKey(s => s.ThemaId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.Navigation(t => t.Subthemas)
            .HasField("_subthemas")
            .UsePropertyAccessMode(PropertyAccessMode.Field);

        // Thema-level AI match suggestions (E2-04, FR-4) — an owned collection of DoelKoppeling in its
        // own table, distinct from the capped themadoelen. Each is persisted as `voorgesteld` +
        // aiMotivatie (Art. IV.2) and shares the single DoelKoppeling column/FK mapping.
        builder.OwnsMany(t => t.Doelsuggesties, ownedBuilder =>
        {
            ownedBuilder.ToTable("thema_doelsuggesties");
            DoelKoppelingMapping.Configure(ownedBuilder);
        });
        builder.Navigation(t => t.Doelsuggesties)
            .HasField("_doelsuggesties")
            .UsePropertyAccessMode(PropertyAccessMode.Field);
    }
}
