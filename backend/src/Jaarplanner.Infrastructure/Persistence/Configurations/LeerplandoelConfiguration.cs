using Jaarplanner.Domain.Curriculum;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace Jaarplanner.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core mapping for <see cref="Leerplandoel"/> (read-only Op.stap reference data, Art. III.1).
/// Identity is the unique <see cref="Leerplandoel.Code"/> (Art. III.5); the composite
/// <c>(domein, subdomein)</c> grouping is indexed for the browse/roll-up queries (Art. VII.0);
/// <see cref="Leerplandoel.Cluster"/> stays nullable. <see cref="Leerplandoel.Doelsoort"/> is
/// persisted as its official short code via the single-source <see cref="DoelsoortCodes"/> mapping.
/// </summary>
public sealed class LeerplandoelConfiguration : IEntityTypeConfiguration<Leerplandoel>
{
    public void Configure(EntityTypeBuilder<Leerplandoel> builder)
    {
        builder.ToTable("leerplandoelen");

        builder.HasKey(l => l.Code);

        builder.Property(l => l.Code).HasMaxLength(64);

        // Persist the enum as its official Op.stap short code (MD/G/+/P/S/A) through the
        // single-source mapping (Art. III.3) — stable and legible in the database.
        var doelsoortConverter = new ValueConverter<Doelsoort, string>(
            d => d.ToCode(),
            code => DoelsoortCodes.FromCode(code));
        builder.Property(l => l.Doelsoort)
            .HasConversion(doelsoortConverter)
            .HasColumnName("doelsoort")
            .HasMaxLength(4)
            .IsRequired();

        builder.Property(l => l.JaarFase).HasMaxLength(8).IsRequired();
        builder.Property(l => l.Domein).HasMaxLength(256).IsRequired();
        builder.Property(l => l.Subdomein).HasMaxLength(256).IsRequired();
        builder.Property(l => l.DisciplineNummer).HasMaxLength(16).IsRequired();
        builder.Property(l => l.Cluster).HasMaxLength(256); // nullable — Art. VII.0
        builder.Property(l => l.Tekst).IsRequired();
        builder.Property(l => l.Voorbeelden);
        builder.Property(l => l.Toelichting);
        builder.Property(l => l.Woordenschat);
        builder.Property(l => l.MinimumdoelRef).HasMaxLength(64);

        // Import-managed review flag (E1-05, Art. III.4 / IV.2): set by the re-import path when a
        // goal disappears from Op.stap but is still referenced by teacher content (FK Restrict, so
        // it cannot be deleted). Defaults false; never written by normal app code.
        builder.Property(l => l.NietMeerInOpstap)
            .HasColumnName("niet_meer_in_opstap")
            .HasDefaultValue(false)
            .IsRequired();

        // The grouping/browse key is the composite (domein, subdomein) — subdomein names
        // are not globally unique (Art. VII.0), so this index backs roll-ups and filters.
        builder.HasIndex(l => new { l.Domein, l.Subdomein });

        // Each leerplandoel belongs to a discipline (the source Excel).
        builder.HasOne<Discipline>()
            .WithMany()
            .HasForeignKey(l => l.DisciplineNummer)
            .OnDelete(DeleteBehavior.Restrict);

        // Optional concordance to a minimumdoel (Art. IX.1): nullable FK on the shared ref key.
        //
        // CARRY THIS FORWARD IF YOU RELAX IT (E1-16, 2026-07-31). Because this is `Restrict`, a leerplandoel
        // naming a ref with no `minimumdoelen` row cannot be committed (SQLSTATE 23503) — which is why no
        // MD-concorded goal can be imported until E1-12 supplies the decreed source, and why relaxing this FK
        // (or making the ref a plain column) is a plausible resolution of the E1-03/E1-12 blockage.
        //
        // On that day, a read branch that has never run in production becomes reachable: the Doelen detail
        // renders "ref present, decreed omschrijving not loaded" (`doelen.minimumdoelNietIngeladen`). It is
        // covered ONLY by the frontend test
        // `frontend/src/features/doelen/Doeldetail.test.tsx` -> "keeps the ref and says the decreed text is not
        // loaded, which is not the same as not concorded", because the state cannot be created in a Postgres
        // fixture while this constraint stands. Whoever relaxes it should add the server-side test that then
        // becomes possible, rather than discovering the branch in production.
        builder.HasOne<Minimumdoel>()
            .WithMany()
            .HasForeignKey(l => l.MinimumdoelRef)
            .HasPrincipalKey(m => m.Ref)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(l => l.MinimumdoelRef);
    }
}
