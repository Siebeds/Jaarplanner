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

        // The plan belongs to its class, so deleting the class takes the plan and every placement with it.
        //
        // A cascade this destructive needs a guard ABOVE it, and the guard is in KlasBeheerService.VerwijderKlasAsync:
        // it refuses the delete while the plan holds any placement a human committed to (accepted, rejected, adjusted
        // or locked), because that is a persisted human decision and Art. IV.2 makes it the human's to discard — not a
        // side effect of removing the class. An earlier version of this comment claimed the existing subthema guard
        // already covered this; it did not — that guard counts Subthemas only, so a class whose sole content was a
        // fully reviewed, locked jaarplan deleted silently. A bare unreviewed `voorgesteld` proposal carries no human
        // decision and may cascade freely.
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

            // ValueGeneratedNever, and this line fixes a real defect rather than tidying metadata (found while building
            // E3-04's persistence half, 2026-07-30). EF's default for a Guid key is `OnAdd`, and when DetectChanges finds
            // an untracked entity in a LOADED parent's collection it decides Added-vs-Modified from whether the key is
            // already set. `Themaplaatsing.Id` is assigned in the constructor, so it is set — so a brand-new placement
            // added to an EXISTING jaarplan was tracked as **Modified**, and SaveChanges tried to UPDATE a row that does
            // not exist: `DbUpdateConcurrencyException: Attempted to update or delete an entity that does not exist in
            // the store`.
            //
            // It went unnoticed because no test and no browser session ever added a placement to a plan that was already
            // persisted: every green path either created the plan and its placements in one SaveChanges, or regenerated
            // with an empty/refused AI answer. E3-04's own criterion — a SECOND run honouring the kept parameters — is
            // the first flow that does it, which is how this surfaced.
            plaatsing.Property(p => p.Id).ValueGeneratedNever();

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

        // The backing field is the source of truth; `Plaatsingen` and `MenselijkBeslotenPlaatsingen` are computed
        // projections over it and must both be ignored — EF otherwise reads either as a second navigation to
        // Themaplaatsing and fails to build the model at all ("Unable to determine the relationship represented by
        // navigation ..."), which takes the whole app down at startup, not just this aggregate.
        builder.Navigation("_plaatsingen").UsePropertyAccessMode(PropertyAccessMode.Field);
        builder.Ignore(j => j.Plaatsingen);
        builder.Ignore(j => j.MenselijkBeslotenPlaatsingen);
    }
}
