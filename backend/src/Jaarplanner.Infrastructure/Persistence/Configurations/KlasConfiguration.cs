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
        // that resolution arbitrary. Enforced in the database so the guarantee survives the
        // concurrent-POST race an in-memory check cannot cover.
        //
        // This declared index is case-SENSITIVE (it stops "L3" twice, but not "l3" vs "L3"). The
        // case-insensitive half is a functional unique index on lower("Naam"), added as raw SQL by
        // migration KlasNaamCaseInsensitiefUniek: EF cannot express a functional index in the *model*,
        // but a migration can simply emit the DDL, and hand-written SQL causes no snapshot drift.
        // So case-insensitive uniqueness is a real database guarantee, not an application convention.
        builder.HasIndex(k => k.Naam).IsUnique();
    }
}
