using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Jaarplanner.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core mapping for <see cref="Hoekplaatsing"/> and the <see cref="Hoekverrijking"/>en it owns (owner, meeting
/// 2026-08-30).
/// <para>
/// <b>Two dates and no planningsblok</b>, the same choice as on <c>activiteitplaatsingen</c> and
/// <c>subthemaplaatsingen</c>: a window a teacher drew in a mini calendar is not a derived block boundary, so it
/// must not inherit the staleness machinery a <c>Themaplaatsing</c> needs. Nothing here rows, FKs or joins a
/// block, so the planning grid stays derived (ADR-0013).
/// </para>
/// <para>
/// <b>No FK to <c>jaarplannen</c>, on purpose.</b> This placement keys on the klas directly, which is what keeps
/// a (re)generation structurally unable to touch a hoek — see the type's own documentation for the argument.
/// </para>
/// <para>
/// <b>RESTRICT on the hoek, unlike the cascade a subthema window gets, and the difference is authored text.</b> A
/// <c>Subthemaplaatsing</c> is a bare window: delete the subthema and the band on the calendar names nothing, so
/// letting it go costs nobody anything. A hoekplaatsing owns <see cref="Hoekverrijking"/>en, which are sentences
/// a teacher wrote about her own classroom, and Art. IV.2 protects a teacher's own decisions from being undone
/// by a side effect of an unrelated action. So deleting a placed hoek is refused, and
/// <c>HoekBeheerService</c> turns that refusal into a Dutch sentence naming the count BEFORE the database can
/// raise a bare 23503. That guard is not optional: this repo has already shipped a Restrict whose Dutch refusal
/// did not actually exist, and the result was an unhandled 500 on an ordinary teacher action with no way out.
/// </para>
/// </summary>
public sealed class HoekplaatsingConfiguration : IEntityTypeConfiguration<Hoekplaatsing>
{
    public void Configure(EntityTypeBuilder<Hoekplaatsing> builder)
    {
        builder.ToTable("hoekplaatsingen");

        builder.HasKey(p => p.Id);
        builder.Property(p => p.Id).ValueGeneratedNever();

        builder.Property(p => p.KlasId).IsRequired();
        builder.Property(p => p.HoekId).IsRequired();

        // DateOnly -> PostgreSQL `date`, both inclusive. `Tot` equal to `Van` is a legal one-day window.
        builder.Property(p => p.Van).IsRequired();
        builder.Property(p => p.Tot).IsRequired();

        // The agenda's access pattern: every placement overlapping the range on screen, for one class.
        builder.HasIndex(p => new { p.KlasId, p.Van, p.Tot });

        builder.HasOne<Klas>()
            .WithMany()
            .HasForeignKey(p => p.KlasId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne<Hoek>()
            .WithMany()
            .HasForeignKey(p => p.HoekId)
            .OnDelete(DeleteBehavior.Restrict);

        // The enrichments are owned by this placement: they are loaded with it, saved with it, and go when it
        // goes. Cascade is right here and Restrict is not, because unlike the hoek->plaatsing edge above there is
        // no independent thing being destroyed: an enrichment describes THIS window and has no meaning outside
        // it. The teacher who deletes a placement is deleting the corner's whole run, with what was in it.
        builder.HasMany(p => p.Verrijkingen)
            .WithOne()
            .HasForeignKey(v => v.HoekplaatsingId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.Navigation(p => p.Verrijkingen)
            .HasField("_verrijkingen")
            .UsePropertyAccessMode(PropertyAccessMode.Field);

        // The timetable appearances, cascading for the same reason: one row per day the hoek takes a lesuur, and
        // a day the corner no longer runs on has nothing to schedule.
        builder.HasMany(p => p.Momenten)
            .WithOne()
            .HasForeignKey(m => m.HoekplaatsingId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.Navigation(p => p.Momenten)
            .HasField("_momenten")
            .UsePropertyAccessMode(PropertyAccessMode.Field);
    }
}
