using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Jaarplanner.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core mapping for <see cref="Hoekverrijking"/>: what one hoek holds while one subthemaperiode of its klas runs
/// (FB-020, ADR-0040).
/// <para>
/// <b>One row per (hoek, window), enforced by a unique index.</b> Two answers to "what is in the boekenhoek during de
/// herfst" would leave the agenda unable to choose; the service writes the pair as an upsert, so the index is the
/// backstop and not the rule a teacher meets.
/// </para>
/// <para>
/// <b>CASCADE on both edges, and both deletes say the count first.</b> A verrijking is text a teacher wrote, and
/// Art. IV.2 protects a teacher's decisions from being undone as a side effect. It has no meaning without its hoek or
/// without its window, though, so refusing either delete would only send her hunting for rows to clear by hand.
/// The owner's ruling for the subthema (2026-09-15) is "mee weg, met aantal": the confirmation before deleting a
/// subthema names how many verrijkingen go with it, and the hoek's delete confirmation does the same. The services
/// also remove the rows themselves, so the in-memory provider the unit tests run on, which enforces no cascade,
/// deletes what PostgreSQL deletes.
/// </para>
/// </summary>
public sealed class HoekverrijkingConfiguration : IEntityTypeConfiguration<Hoekverrijking>
{
    public void Configure(EntityTypeBuilder<Hoekverrijking> builder)
    {
        builder.ToTable("hoekverrijkingen");

        builder.HasKey(v => v.Id);
        builder.Property(v => v.Id).ValueGeneratedNever();

        builder.Property(v => v.HoekId).IsRequired();
        builder.Property(v => v.SubthemaplaatsingId).IsRequired();

        // Free text, required. What a teacher puts in her boekenhoek for a subthema is too specific to be chosen
        // from a list, which is why the owner dropped the configured-verrijking idea in the same session.
        builder.Property(v => v.Tekst).IsRequired();

        builder.HasIndex(v => new { v.HoekId, v.SubthemaplaatsingId }).IsUnique();

        // The agenda's access pattern: every verrijking of the windows touching the range on screen.
        builder.HasIndex(v => v.SubthemaplaatsingId);

        builder.HasOne<Hoek>()
            .WithMany()
            .HasForeignKey(v => v.HoekId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne<Subthemaplaatsing>()
            .WithMany()
            .HasForeignKey(v => v.SubthemaplaatsingId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
