using Jaarplanner.Domain.Planning;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Jaarplanner.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core mapping for <see cref="Generatieparameters"/> and its two owned collections (E3-04, FR-5.4, Art. IX.3) —
/// the pre-generation settings a class keeps between runs.
/// <para>
/// <b>The unique key is (<c>KlasId</c>, <c>SchooljaarId</c>), and that is the scoping decision.</b> Everything stored
/// here is a date, so a row must never be read for a different school year than the one it was written for: a
/// schoolfeest on 2026-09-15 means nothing in 2027-2028. A <c>Klas</c> does belong to exactly one <c>Schooljaar</c> and
/// cannot be moved (its <c>SchooljaarId</c> has no mutator), so <c>KlasId</c> alone would be safe <i>today</i> — but it
/// would be safe because of an invariant expressed in another aggregate. The pair makes the leak impossible in the
/// schema itself, and a mismatch yields no settings rather than last year's.
/// </para>
/// <para>
/// <b>Still no planningsblok table.</b> A kept start thema stores a block <b>start date</b>, exactly like a
/// <see cref="Themaplaatsing"/>, and there is deliberately no ordinal column: the ordinal is a display position over a
/// derived grid (ADR-0020 §3), and persisting one here would have been strictly worse than sending one, because it
/// survives the very vakantie edits that invalidate it.
/// </para>
/// </summary>
public sealed class GeneratieparametersConfiguration : IEntityTypeConfiguration<Generatieparameters>
{
    public void Configure(EntityTypeBuilder<Generatieparameters> builder)
    {
        builder.ToTable("generatieparameters");

        builder.HasKey(p => p.Id);

        builder.Property(p => p.KlasId).IsRequired();
        builder.Property(p => p.SchooljaarId).IsRequired();

        // One kept settings row per class per school year, enforced in the database and not merely by the service's
        // load-or-create: two concurrent generation runs must not be able to leave a class with two sets of settings,
        // one of which would then be read at random.
        builder.HasIndex(p => new { p.KlasId, p.SchooljaarId }).IsUnique();

        // The settings belong to the class: deleting the class takes them with it. Unlike the jaarplan this needs no
        // guard above it — these are the teacher's own re-enterable inputs, not a persisted decision about the plan
        // (Art. IV.2), and the Klas delete guard already refuses while any human decision stands.
        builder.HasOne<Klas>()
            .WithMany()
            .HasForeignKey(p => p.KlasId)
            .OnDelete(DeleteBehavior.Cascade);

        // Restrict on the school year, matching SchooljaarConfiguration's treatment of Klas: deleting a school year
        // must not silently take data with it. It is already refused while the year holds classes, and a settings row
        // cannot exist without one, so this FK adds no new obstacle — it makes the SchooljaarId a real reference
        // rather than a loose discriminator that could point at a year that no longer exists.
        builder.HasOne<Schooljaar>()
            .WithMany()
            .HasForeignKey(p => p.SchooljaarId)
            .OnDelete(DeleteBehavior.Restrict);

        // Owned, like the schooljaar's closures and the jaarplan's placements: they load with the settings, are deleted
        // with them, and are referenceable from nowhere else. Mapped by BACKING FIELD because the public properties are
        // ordered projections that materialise a new list on every read, which EF cannot track.
        builder.OwnsMany<BewaardStartthema>("_startthemas", startthema =>
        {
            startthema.ToTable("startthemavoorkeuren");
            startthema.WithOwner().HasForeignKey("GeneratieparametersId");

            // A client-generated Guid key, like every other owned collection here — NOT the int identity EF would
            // otherwise invent. `Vervang` replaces the whole collection, so a generated key made every save a delete
            // plus an insert whose keys could collide inside one SaveChanges; the symptom was a
            // DbUpdateConcurrencyException on the NEXT request, two saves away from its cause.
            startthema.HasKey(s => s.Id);

            // ValueGeneratedNever is load-bearing, not tidiness. EF's default for a Guid key is `OnAdd`, and when
            // DetectChanges finds an untracked entity in a LOADED parent's collection it decides Added-vs-Modified from
            // whether the key is set. A constructor-assigned Guid is set, so a brand-new row was tracked as **Modified**
            // and SaveChanges tried to UPDATE a row that does not exist. Telling EF the key is never store-generated is
            // what makes "the key is already set" stop meaning "this row exists".
            startthema.Property(s => s.Id).ValueGeneratedNever();

            // The stable block key (ADR-0020 §3): DateOnly → PostgreSQL `date`.
            startthema.Property(s => s.BlokStart).IsRequired();

            // By name rather than by id, matching the generation contract, which resolves a thema by name and reports a
            // name the school does not own instead of inventing one (Art. IV.4). Length matches Thema.Naam.
            startthema.Property(s => s.ThemaNaam).HasMaxLength(256).IsRequired();

            // One period opens with one thema — the domain invariant Vervang() enforces, held in the database too.
            startthema.HasIndex("GeneratieparametersId", "BlokStart").IsUnique();
        });

        builder.OwnsMany<BewaardVastMoment>("_vasteMomenten", moment =>
        {
            moment.ToTable("vastemomenten");
            moment.WithOwner().HasForeignKey("GeneratieparametersId");
            moment.HasKey(m => m.Id);
            moment.Property(m => m.Id).ValueGeneratedNever();

            // 200, and the form's input carries the same `maxLength`, so the only UI that writes here cannot overflow
            // the column. This project has already spent a CI run on a `varchar(32)` overflow that every local test
            // missed, and a teacher's free-text label is exactly where an unbounded string arrives.
            moment.Property(m => m.Naam).HasMaxLength(200).IsRequired();
            moment.Property(m => m.Datum).IsRequired();

            // Non-nullable with no default value: this flag has no "unknown" state, because a moment whose blocking
            // question is unanswered is not an instruction and is never accepted. A database default of false would
            // recreate exactly the silent weaker reading the request contract refuses with a 400.
            moment.Property(m => m.BlokkeertPlaatsing).IsRequired();

            // Two moments may share a date (a sportdag and an oudercontact), so no unique index here — only an index
            // for the chronological read.
            moment.HasIndex("GeneratieparametersId", "Datum");
        });

        builder.Navigation("_startthemas").UsePropertyAccessMode(PropertyAccessMode.Field);
        builder.Navigation("_vasteMomenten").UsePropertyAccessMode(PropertyAccessMode.Field);

        // The backing fields are the source of truth; these are computed projections over them. EF otherwise reads each
        // as a second navigation to the same owned type and fails to build the model at all, which takes the whole app
        // down at startup rather than just this aggregate (the lesson JaarplanConfiguration records).
        builder.Ignore(p => p.Startthemas);
        builder.Ignore(p => p.VasteMomenten);
    }
}
