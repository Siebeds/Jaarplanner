using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Jaarplanner.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core mapping for <see cref="Hoekverrijkingsvoorstel"/> (FB-028, ADR-0070). It goes with its hoek and with its
/// subthema, as a verrijking does; the verrijking an accepted one became is an ordinary row of its own and outlives it.
/// </summary>
public sealed class HoekverrijkingsvoorstelConfiguration : IEntityTypeConfiguration<Hoekverrijkingsvoorstel>
{
    public void Configure(EntityTypeBuilder<Hoekverrijkingsvoorstel> builder)
    {
        builder.ToTable("hoekverrijkingsvoorstellen");

        builder.HasKey(v => v.Id);
        builder.Property(v => v.Id).ValueGeneratedNever();
        builder.Property(v => v.HoekId).IsRequired();
        builder.Property(v => v.SubthemaId).IsRequired();
        builder.Property(v => v.Tekst).HasMaxLength(Hoekverrijkingsvoorstel.MaxTekstlengte).IsRequired();
        builder.Property(v => v.AiMotivatie).IsRequired();
        builder.Property(v => v.Status).HasConversion(SubthemavoorstelConfiguration.StatusConverter).HasMaxLength(16).IsRequired();

        // PostgreSQL's xmin as row version: two simultaneous decisions on one proposal cannot both be saved.
        builder.Property<uint>("xmin").IsRowVersion();
        builder.Ignore(v => v.IsOpen);

        builder.HasOne<Hoek>()
            .WithMany()
            .HasForeignKey(v => v.HoekId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne<Subthema>()
            .WithMany()
            .HasForeignKey(v => v.SubthemaId)
            .OnDelete(DeleteBehavior.Cascade);

        // What a request asks: the open and rejected proposals of one corner for one subthema.
        builder.HasIndex(v => new { v.HoekId, v.SubthemaId });
    }
}
