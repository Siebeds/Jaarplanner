using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Jaarplanner.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core mapping for <see cref="Subthema"/> — <b>class/age-scoped</b> (Art. IX.2). The scoping is
/// enforced structurally: <see cref="Subthema.KlasId"/> is a <b>required</b> FK to <see cref="Klas"/>
/// and <see cref="Subthema.Leeftijd"/> is <b>required</b> — a subthema cannot exist school-wide.
/// Subdoelen and activiteiten hang off the subthema and so inherit its class/age scope.
/// </summary>
public sealed class SubthemaConfiguration : IEntityTypeConfiguration<Subthema>
{
    public void Configure(EntityTypeBuilder<Subthema> builder)
    {
        builder.ToTable("subthemas");

        builder.HasKey(s => s.Id);

        builder.Property(s => s.ThemaId).IsRequired();
        builder.Property(s => s.Naam).HasMaxLength(256).IsRequired();
        builder.Property(s => s.DuurWeken).IsRequired();

        // Class/age scoping is structural and required (Art. IX.2).
        builder.Property(s => s.KlasId).IsRequired();
        builder.Property(s => s.Leeftijd).HasMaxLength(8).IsRequired();

        builder.HasOne<Klas>()
            .WithMany()
            .HasForeignKey(s => s.KlasId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(s => new { s.KlasId, s.Leeftijd });

        // Age-differentiated subdoelen at (subthema × leeftijd).
        builder.HasMany(s => s.Subdoelen)
            .WithOne()
            .HasForeignKey(sd => sd.SubthemaId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.Navigation(s => s.Subdoelen)
            .HasField("_subdoelen")
            .UsePropertyAccessMode(PropertyAccessMode.Field);

        builder.HasMany(s => s.Activiteiten)
            .WithOne()
            .HasForeignKey(a => a.SubthemaId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.Navigation(s => s.Activiteiten)
            .HasField("_activiteiten")
            .UsePropertyAccessMode(PropertyAccessMode.Field);

        builder.HasMany(s => s.Onderzoeksvragen)
            .WithOne()
            .HasForeignKey(ov => ov.SubthemaId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.Navigation(s => s.Onderzoeksvragen)
            .HasField("_onderzoeksvragen")
            .UsePropertyAccessMode(PropertyAccessMode.Field);
    }
}
