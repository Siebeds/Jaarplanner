using Jaarplanner.Domain.Planning;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Jaarplanner.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core mapping for <see cref="Schooljaar"/> and its owned <see cref="Schoolvakantie"/> collection
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
        builder.OwnsMany<Schoolvakantie>("_vakanties", vakantie =>
        {
            vakantie.ToTable("schoolvakanties");
            vakantie.WithOwner().HasForeignKey("SchooljaarId");
            vakantie.HasKey(v => v.Id);
            vakantie.Property(v => v.Naam).HasMaxLength(64).IsRequired();
            vakantie.Property(v => v.Start).IsRequired();
            vakantie.Property(v => v.Eind).IsRequired();
            vakantie.HasIndex("SchooljaarId", "Start");
        });

        // The backing field is the source of truth; Vakanties is a computed, ordered projection.
        builder.Navigation("_vakanties").UsePropertyAccessMode(PropertyAccessMode.Field);
        builder.Ignore(s => s.Vakanties);
    }
}
