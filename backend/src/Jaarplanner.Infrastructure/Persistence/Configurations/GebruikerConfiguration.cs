using Jaarplanner.Domain.Toegang;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Jaarplanner.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core mapping for <see cref="Gebruiker"/> (E6-01). Two unique indexes carry the two identities a person has over
/// time: the invitation address, and the Entra account it is bound to on first login.
/// </summary>
public sealed class GebruikerConfiguration : IEntityTypeConfiguration<Gebruiker>
{
    public void Configure(EntityTypeBuilder<Gebruiker> builder)
    {
        builder.ToTable("gebruikers");

        builder.HasKey(g => g.Id);

        // 320 is the longest address RFC 5321 allows. Stored already normalised by the domain.
        builder.Property(g => g.Email).HasMaxLength(320).IsRequired();
        builder.Property(g => g.Naam).HasMaxLength(256).IsRequired();

        builder.HasIndex(g => g.Email).IsUnique();

        // E6-02 (ADR-0030 R4). Every gebruiker that predates the column holds no themabeheer, which is what the
        // migration's default of false gives them.
        builder.Property(g => g.HeeftThemabeheer).IsRequired();

        // PostgreSQL treats NULLs as distinct in a unique index, so every unbound invitation fits under this one and
        // only a second binding of the same account is refused. That refusal is what settles two racing first logins.
        builder.HasIndex(g => new { g.EntraTenantId, g.EntraObjectId }).IsUnique();

        builder.Ignore(g => g.IsGekoppeld);
    }
}
