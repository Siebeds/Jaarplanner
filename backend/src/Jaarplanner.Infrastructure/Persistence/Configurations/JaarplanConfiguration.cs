using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace Jaarplanner.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core mapping for <see cref="Jaarplan"/> and its <see cref="Themaplaatsing"/> collection (Art. IX.3, E3-01).
/// <para>
/// <b>Still no planningsblok table.</b> A placement stores <see cref="Themaplaatsing.BlokStart"/> +
/// <see cref="Themaplaatsing.BlokNiveau"/> — a date and a tier — and there is deliberately no row, no FK and no
/// join anywhere in this schema representing a block. The grid remains derived by the
/// <c>IPlanningsblokIndeling</c> seam (ADR-0013), so changing the planning grain stays a configuration edit rather
/// than a data migration.
/// </para>
/// <para>
/// <b>And no <c>Ordinaal</c> column, deliberately.</b> The ordinal is a display position over a derived grid and
/// re-points when the school edits a vakantie (ADR-0020 §3); persisting it would create a second, unstable key
/// that could disagree with the date. It is projected at read time instead.
/// </para>
/// </summary>
public sealed class JaarplanConfiguration : IEntityTypeConfiguration<Jaarplan>
{
    private static readonly ValueConverter<KoppelingStatus, string> StatusConverter =
        new(s => s.ToString(), s => Enum.Parse<KoppelingStatus>(s));

    private static readonly ValueConverter<Planningsblokniveau, string> NiveauConverter =
        new(n => n.ToString(), n => Enum.Parse<Planningsblokniveau>(n));

    public void Configure(EntityTypeBuilder<Jaarplan> builder)
    {
        builder.ToTable("jaarplannen");

        builder.HasKey(j => j.Id);

        builder.Property(j => j.KlasId).IsRequired();

        // Art. IX.3: a Klas "has one Jaarplan". Enforced in the database, not merely by the service's
        // load-or-create, so a concurrent double generation cannot end up with two plans for one class.
        builder.HasIndex(j => j.KlasId).IsUnique();

        // The plan belongs to its class; deleting the class takes the plan (and its placements) with it. Klas
        // deletion is itself already refused while class-scoped content exists (KlasBeheerService).
        builder.HasOne<Klas>()
            .WithMany()
            .HasForeignKey(j => j.KlasId)
            .OnDelete(DeleteBehavior.Cascade);

        // The placements belong to the plan and have no independent lifetime, so they are an owned collection:
        // loaded with it, deleted with it, and not referenceable from elsewhere — the same choice
        // SchooljaarConfiguration makes for its closures. Mapped by BACKING FIELD because the public
        // `Plaatsingen` property is an ordered projection that materialises a new list on every read, which EF
        // cannot track; the field is the source of truth.
        builder.OwnsMany<Themaplaatsing>("_plaatsingen", plaatsing =>
        {
            plaatsing.ToTable("themaplaatsingen");
            plaatsing.WithOwner().HasForeignKey(p => p.JaarplanId);
            plaatsing.HasKey(p => p.Id);

            plaatsing.Property(p => p.ThemaId).IsRequired();

            // The stable key (ADR-0020 §3): DateOnly → PostgreSQL `date`.
            plaatsing.Property(p => p.BlokStart).IsRequired();

            // Persisted by name rather than as an int, like Sluitingssoort and KoppelingStatus: legible in the
            // database, and these two columns together ARE the block identity, so they are worth reading by eye.
            plaatsing.Property(p => p.BlokNiveau)
                .HasConversion(NiveauConverter)
                .HasMaxLength(32)
                .IsRequired();

            plaatsing.Property(p => p.Status)
                .HasConversion(StatusConverter)
                .HasMaxLength(16)
                .IsRequired();

            plaatsing.Property(p => p.AiMotivatie);

            // The lock that excludes a placement from regeneration (Art. IX.3). Non-nullable with a false
            // default: an unset flag must mean "not locked", never "unknown".
            plaatsing.Property(p => p.Vergrendeld).IsRequired().HasDefaultValue(false);

            // A thema is placed in a given block at most once (the domain invariant, held in the database too).
            plaatsing.HasIndex(p => new { p.JaarplanId, p.ThemaId, p.BlokNiveau, p.BlokStart }).IsUnique();

            // Restrict: a placed thema must not be deletable out from under the plan, leaving a placement
            // pointing at nothing (ADR-0006 §4 — clear diagnostics over dangling rows).
            plaatsing.HasOne<Thema>()
                .WithMany()
                .HasForeignKey(p => p.ThemaId)
                .OnDelete(DeleteBehavior.Restrict);

            // Chronological reads per plan are the calendar's access pattern (E3-06).
            plaatsing.HasIndex(p => new { p.JaarplanId, p.BlokStart });
        });

        // The backing field is the source of truth; `Plaatsingen` is a computed, ordered projection over it.
        builder.Navigation("_plaatsingen").UsePropertyAccessMode(PropertyAccessMode.Field);
        builder.Ignore(j => j.Plaatsingen);
    }
}
