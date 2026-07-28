using Jaarplanner.Domain.Planning;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Jaarplanner.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core mapping for <see cref="Schooljaar"/> and its owned <see cref="Schoolsluiting"/> collection
/// (Art. IX.3: the schooljaar carries the vakantie-/periodestructuur).
/// <para>
/// <b>No planningsblok table, deliberately.</b> Blocks are derived from this data by the
/// <c>IPlanningsblokIndeling</c> seam, never stored — persisting them would bake the granularity into rows
/// and defeat ADR-0013's whole purpose. What is persisted is only the raw input: the year's span and its
/// vacations.
/// </para>
/// </summary>
public sealed class SchooljaarConfiguration : IEntityTypeConfiguration<Schooljaar>
{
    public void Configure(EntityTypeBuilder<Schooljaar> builder)
    {
        builder.ToTable("schooljaren");

        builder.HasKey(s => s.Id);

        builder.Property(s => s.Naam).HasMaxLength(32).IsRequired();
        builder.Property(s => s.Start).IsRequired();
        builder.Property(s => s.Eind).IsRequired();

        // One school year per label (e.g. "2026-2027").
        builder.HasIndex(s => s.Naam).IsUnique();

        // The vacations belong to the school year and have no independent lifetime, so they are an owned
        // collection: they are loaded with it and deleted with it, and cannot be referenced from elsewhere.
        builder.OwnsMany<Schoolsluiting>("_sluitingen", sluiting =>
        {
            sluiting.ToTable("schoolsluitingen");
            sluiting.WithOwner().HasForeignKey("SchooljaarId");
            sluiting.HasKey(s => s.Id);
            sluiting.Property(s => s.Naam).HasMaxLength(64).IsRequired();
            sluiting.Property(s => s.Start).IsRequired();
            sluiting.Property(s => s.Eind).IsRequired();

            // Persisted by name (Vakantie / VrijeDag) rather than as an int: legible in the database, and
            // whether a closure breaks a planning period is the single most consequential field here.
            sluiting.Property(s => s.Soort).HasConversion<string>().HasMaxLength(16).IsRequired();
            sluiting.HasIndex("SchooljaarId", "Start");
        });

        // The backing field is the source of truth; Sluitingen and Vakanties are computed projections.
        builder.Navigation("_sluitingen").UsePropertyAccessMode(PropertyAccessMode.Field);
        builder.Ignore(s => s.Sluitingen);
        builder.Ignore(s => s.Vakanties);
    }
}
