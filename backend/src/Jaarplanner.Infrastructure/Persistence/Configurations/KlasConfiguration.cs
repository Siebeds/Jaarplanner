using Jaarplanner.Domain.Planning;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Jaarplanner.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core mapping for <see cref="Klas"/> (Art. IX.3). It exists so the class/age-scoped school content can
/// express its required <see cref="Klas"/> association, and so a <c>Jaarplan</c> has a class to belong to.
/// <para>
/// The <see cref="Klas.SchooljaarId"/> FK — the "Schooljaar contains multiple klassen" containment (E3-01) — is
/// declared on the owning side in <see cref="SchooljaarConfiguration"/>, so it is defined exactly once.
/// </para>
/// </summary>
public sealed class KlasConfiguration : IEntityTypeConfiguration<Klas>
{
    public void Configure(EntityTypeBuilder<Klas> builder)
    {
        builder.ToTable("klassen");

        builder.HasKey(k => k.Id);

        builder.Property(k => k.SchooljaarId).IsRequired();
        builder.Property(k => k.Naam).HasMaxLength(128).IsRequired();
        builder.Property(k => k.Leerjaar).IsRequired();

        // Nullable, and short: one of nine codes (JK, K2, K3, L1-L6). Absent means "the school has not said", which
        // keeps every existing class on the ordinal fallback rather than silently narrowing a plan already being
        // taught. `Klas` refuses a code that contradicts a real leerjaar, so the column cannot hold a second answer.
        builder.Property(k => k.Jaarfase).HasMaxLength(8);

        // The school-content Excel import resolves a class BY NAME, so a duplicate name would make
        // that resolution arbitrary. Enforced in the database so the guarantee survives the
        // concurrent-POST race an in-memory check cannot cover.
        //
        // Deliberately school-wide, NOT scoped per schooljaar: scoping it per year would make that by-name
        // import resolution ambiguous the moment a second year exists. See Klas's own documentation.
        //
        // This declared index is case-SENSITIVE (it stops "L3" twice, but not "l3" vs "L3"). The
        // case-insensitive half is a functional unique index on lower("Naam"), added as raw SQL by
        // migration KlasNaamCaseInsensitiefUniek: EF cannot express a functional index in the *model*,
        // but a migration can simply emit the DDL, and hand-written SQL causes no snapshot drift.
        // So case-insensitive uniqueness is a real database guarantee, not an application convention.
        builder.HasIndex(k => k.Naam).IsUnique();
    }
}
