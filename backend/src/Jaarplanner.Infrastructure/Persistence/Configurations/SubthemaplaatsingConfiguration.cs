using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Jaarplanner.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core mapping for <see cref="Subthemaplaatsing"/> — the stretch of days a teacher marked off for a subthema
/// (owner ruling, 2026-08-25).
/// <para>
/// <b>Two dates, no planningsblok.</b> The same choice as on <c>activiteitplaatsingen</c> and for the same reason: a
/// window a teacher drew with two date fields is not a derived block boundary, so it must not inherit the staleness
/// machinery a <c>Themaplaatsing</c> needs (<c>IsVervallen</c>, a notice, a re-placement route). Nothing here rows,
/// FKs or joins a block, so the planning grid stays derived (ADR-0013).
/// </para>
/// </summary>
public sealed class SubthemaplaatsingConfiguration : IEntityTypeConfiguration<Subthemaplaatsing>
{
    public void Configure(EntityTypeBuilder<Subthemaplaatsing> builder)
    {
        builder.ToTable("subthemaplaatsingen");

        builder.HasKey(p => p.Id);

        // Assigned in the constructor, so EF must not treat it as store-generated. Same line and same reason as on
        // the other two placement tables: with the default `OnAdd`, a placement added to an ALREADY PERSISTED plan
        // is tracked as Modified and SaveChanges tries to UPDATE a row that does not exist. Every flow that reaches
        // here loads the plan first, so it would be the first thing anyone hit rather than an edge case.
        builder.Property(p => p.Id).ValueGeneratedNever();

        builder.Property(p => p.JaarplanId).IsRequired();
        builder.Property(p => p.SubthemaId).IsRequired();

        // DateOnly -> PostgreSQL `date`, both inclusive. `Tot` equal to `Van` is a legal one-day window.
        builder.Property(p => p.Van).IsRequired();
        builder.Property(p => p.Tot).IsRequired();

        // Unique on the START of the window, not on the subthema. A subthema may run twice in a year, and
        // `Jaarplan.PlaatsSubthema` already moves an OVERLAPPING window of the same subthema instead of adding a
        // second one, so the only thing left to forbid is two windows for the same subthema beginning on the same
        // day, which cannot mean anything.
        builder.HasIndex(p => new { p.JaarplanId, p.SubthemaId, p.Van }).IsUnique();

        // The calendar's access pattern: every window overlapping one range, per plan.
        builder.HasIndex(p => new { p.JaarplanId, p.Van, p.Tot });

        // CASCADE, and this is the one place in the planning schema where it is right — the first version of this file
        // said Restrict "matching activiteitplaatsingen", and claimed in the same breath that
        // `VerwijderSubthemaAsync` already refused with a Dutch sentence naming the count. It does not: that guard
        // counts ACTIVITEITPLAATSINGEN only. So Restrict here would have made a subthema carrying a window and no
        // scheduled activiteit undeletable through a raw 23503, an unhandled 500 on an ordinary teacher action, with
        // no route to clear the window and therefore no way out. That is exactly the trap the Klas guard's own comment
        // records shipping once.
        //
        // Cascade rather than a new guard, because the two things being deleted are not alike. An
        // `Activiteitplaatsing` is scheduling work that stands on its own: the activiteit may be gone and the Tuesday
        // it was taught on is still a fact, so Art. IV.2 protects it and the delete is refused. A window is a
        // statement ABOUT a subthema — "this one runs these days" — and it has no meaning once that subthema does not
        // exist. Keeping it would leave a band on the calendar naming nothing.
        //
        // The scheduling work stays protected: `VerwijderSubthemaAsync` still refuses while any activiteit of the
        // subthema sits on a day, so a window only ever cascades after the teacher has dealt with those.
        builder.HasOne<Subthema>()
            .WithMany()
            .HasForeignKey(p => p.SubthemaId)
            .OnDelete(DeleteBehavior.Cascade);

        // The FK to the plan and its cascade are configured on the owning side, in JaarplanConfiguration, so the
        // aggregate's navigation and its delete behaviour stay in one place.
    }
}
