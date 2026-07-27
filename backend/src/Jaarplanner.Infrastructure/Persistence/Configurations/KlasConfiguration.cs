using Jaarplanner.Domain.Planning;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Jaarplanner.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core mapping for <see cref="Klas"/> (Art. IX.3). Minimal for E1-02 — it exists so the
/// class/age-scoped school content can express its required <see cref="Klas"/> association.
/// </summary>
public sealed class KlasConfiguration : IEntityTypeConfiguration<Klas>
{
    public void Configure(EntityTypeBuilder<Klas> builder)
    {
        builder.ToTable("klassen");

        builder.HasKey(k => k.Id);

        builder.Property(k => k.Naam).HasMaxLength(128).IsRequired();
        builder.Property(k => k.Leerjaar).IsRequired();

        // The school-content Excel import resolves a class BY NAME, so a duplicate name would make
        // that resolution arbitrary. Enforced in the database so the guarantee survives the concurrent
        // -POST race an in-memory check cannot cover.
        //
        // Known limit: this index is case-SENSITIVE, so it stops "L3" twice but not "l3" vs "L3".
        // KlasBeheerService additionally pre-checks case-insensitively (ILIKE, evaluated in Postgres),
        // which covers the ordinary path; only a genuine concurrent race between two case-variant names
        // can still slip through. Closing that fully needs a functional unique index on lower(naam),
        // which EF cannot express declaratively — deliberately deferred rather than introducing
        // model/migration drift.
        builder.HasIndex(k => k.Naam).IsUnique();
    }
}
