using Jaarplanner.Domain.Planning;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Jaarplanner.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core mapping for <see cref="Hoekverrijking"/> — what a hoek is enriched with over one stretch of days
/// inside a <see cref="Hoekplaatsing"/> (owner, meeting 2026-08-30).
/// <para>
/// The FK and its cascade are configured on the owning side, in <c>HoekplaatsingConfiguration</c>, so the
/// aggregate's navigation and its delete behaviour stay in one place. This file maps the table and its columns.
/// </para>
/// <para>
/// <b>Nothing here enforces "inside the placement" or "no overlap".</b> Both are invariants of the aggregate and
/// are enforced in <see cref="Hoekplaatsing.VoegVerrijkingToe"/>, which is the only layer that can see the other
/// enrichments and the placement's own window. A database check constraint could express neither: the first
/// needs the parent row, the second needs the siblings.
/// </para>
/// </summary>
public sealed class HoekverrijkingConfiguration : IEntityTypeConfiguration<Hoekverrijking>
{
    public void Configure(EntityTypeBuilder<Hoekverrijking> builder)
    {
        builder.ToTable("hoekverrijkingen");

        builder.HasKey(v => v.Id);
        builder.Property(v => v.Id).ValueGeneratedNever();

        builder.Property(v => v.HoekplaatsingId).IsRequired();

        // DateOnly -> PostgreSQL `date`, both inclusive.
        builder.Property(v => v.Van).IsRequired();
        builder.Property(v => v.Tot).IsRequired();

        // Free text, required. What a teacher puts in her boekenhoek for a fortnight is too specific to be
        // chosen from a list, which is why the owner dropped the configured-verrijking idea in the same session.
        builder.Property(v => v.Tekst).IsRequired();

        // Reading a day asks "which enrichment covers this date, for this placement".
        builder.HasIndex(v => new { v.HoekplaatsingId, v.Van, v.Tot });
    }
}
