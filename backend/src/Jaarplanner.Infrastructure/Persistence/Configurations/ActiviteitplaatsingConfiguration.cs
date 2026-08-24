using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace Jaarplanner.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core mapping for <see cref="Activiteitplaatsing"/> — an activiteit scheduled onto one teaching day (E9-03,
/// FR-6.2/FR-7.2).
/// <para>
/// <b>This table has no <c>BlokStart</c> and no <c>BlokNiveau</c>, and that is the design rather than an omission.</b>
/// A thema is keyed on a <i>derived</i> planningsblok boundary that moves when the school edits a vakantie — which is
/// why <c>IsVervallen</c>, a persistent notice and a withheld dekkingscijfer all exist. An activiteit is keyed on a
/// real calendar <see cref="Activiteitplaatsing.Datum"/>, which does not move. The two answer different questions and
/// only one of them can go stale. See <see cref="Activiteitplaatsing"/> for why a third
/// <see cref="Planningsblokniveau"/> was rejected outright.
/// </para>
/// <para>
/// <b>Still no planningsblok table either.</b> Nothing here rows, FKs or joins a block, so the grid stays derived
/// (ADR-0013) and changing the planning grain stays a configuration edit.
/// </para>
/// </summary>
public sealed class ActiviteitplaatsingConfiguration : IEntityTypeConfiguration<Activiteitplaatsing>
{
    private static readonly ValueConverter<KoppelingStatus, string> StatusConverter =
        new(s => s.ToString(), s => Enum.Parse<KoppelingStatus>(s));

    public void Configure(EntityTypeBuilder<Activiteitplaatsing> builder)
    {
        builder.ToTable("activiteitplaatsingen");

        builder.HasKey(p => p.Id);

        // Assigned in the constructor, so EF must not treat it as store-generated. The same line, for the same
        // reason, as on themaplaatsingen: with the default `OnAdd`, a placement added to an ALREADY PERSISTED plan
        // is tracked as Modified and SaveChanges tries to UPDATE a row that does not exist
        // (`DbUpdateConcurrencyException`). E3-04 lost a debugging round to that, and every flow this story adds
        // does exactly the thing that triggers it — the plan is always loaded before a day is planned — so here it
        // would be the first thing anyone hit rather than an edge case.
        builder.Property(p => p.Id).ValueGeneratedNever();

        builder.Property(p => p.JaarplanId).IsRequired();
        builder.Property(p => p.ActiviteitId).IsRequired();

        // The key: DateOnly → PostgreSQL `date`. A real day, not a derived boundary.
        builder.Property(p => p.Datum).IsRequired();

        // By name rather than as an int, like KoppelingStatus everywhere else in this schema: legible by eye.
        builder.Property(p => p.Status)
            .HasConversion(StatusConverter)
            .HasMaxLength(16)
            .IsRequired();

        // Non-nullable with a 0 default: an unset position must mean "first", never "unknown".
        builder.Property(p => p.Volgorde).IsRequired().HasDefaultValue(0);

        // The domain invariant, held in the database too: one activiteit at most once per day. The same activiteit
        // on two different days is legitimate and common (a reading moment on Monday and again on Thursday), which
        // is why the day is part of the key rather than the activiteit alone.
        // Volgorde is part of the key because the slot is the unit of placement, not the day: the same
        // activiteit may fill two consecutive lesuren, or run once in the morning and once after noon.
        // Mirrors Jaarplan.IsAlGeplaatstOp, which is where the rule is stated.
        builder.HasIndex(p => new { p.JaarplanId, p.ActiviteitId, p.Datum, p.Volgorde }).IsUnique();

        // Reading one week — or one period — of days is this feature's entire access pattern (E9-04).
        builder.HasIndex(p => new { p.JaarplanId, p.Datum });

        // Restrict, matching the Thema FK on themaplaatsingen rather than cascading — and the case FOR cascading is
        // real, which is why the choice is written down. An activiteit is klas-scoped and deleted by the same
        // teacher who planned it, so "I deleted it, of course it left my calendar" is a reasonable expectation. It
        // is still refused, because a cascade destroys scheduling work with no record and no warning, and this
        // repo's rule is that a persisted human decision is refused loudly rather than removed quietly (Art. IV.2).
        //
        // A Restrict whose remediation does not exist is a trap rather than a safeguard — the Klas guard's own
        // comment records shipping exactly that once, leaving a class permanently undeletable with a message that
        // instructed the impossible. So both halves exist here and must stay:
        //   * `SchoolcontentBeheerService.VerwijderActiviteitAsync` refuses with a Dutch sentence naming the count,
        //     rather than letting a raw FK violation surface as a 500;
        //   * `DELETE …/jaarplan/activiteitplaatsingen/{id}` takes a placement back off its day.
        builder.HasOne<Activiteit>()
            .WithMany()
            .HasForeignKey(p => p.ActiviteitId)
            .OnDelete(DeleteBehavior.Restrict);

        // The FK to the plan and its cascade are configured on the owning side, in JaarplanConfiguration, so the
        // aggregate's navigation and its delete behaviour stay in one place.
    }
}
