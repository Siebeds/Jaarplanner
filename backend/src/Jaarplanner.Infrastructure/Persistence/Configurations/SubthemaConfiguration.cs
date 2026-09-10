using Jaarplanner.Domain.Schoolcontent;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Jaarplanner.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core mapping for <see cref="Subthema"/> — <b>age-scoped</b> (Art. IX.2 as amended 2026-08-30).
/// <see cref="Subthema.Leeftijd"/> is <b>required</b>; a subthema cannot exist without an age. Subdoelen and
/// activiteiten hang off the subthema and so inherit its age scope.
/// <para>
/// <b>The FK to <c>Klas</c> is gone.</b> It used to be required and <c>Restrict</c>, which is what made a
/// subthema one class's and what made deleting a class refuse while any hung on it. A class now reaches its
/// subthema's by matching its own jaar/fase against <see cref="Subthema.Leeftijd"/>, which is a value match and
/// not a relationship, so there is nothing left for a foreign key to enforce.
/// </para>
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

        // Age scoping is structural and required (Art. IX.2).
        builder.Property(s => s.Leeftijd).HasMaxLength(8).IsRequired();

        // Every "which subthema's are this class's" query filters on this column alone, so it carries the index
        // the composite (KlasId, Leeftijd) one used to.
        builder.HasIndex(s => s.Leeftijd);

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
