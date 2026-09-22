using Jaarplanner.Domain.Kat;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Toegang;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace Jaarplanner.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core mapping for <see cref="Signaal"/> (TB-057, ADR-0059 D2). It goes with its klas and with its recipient:
/// a signal about a klas that is gone, or for a gebruiker who is gone, is about nothing.
/// <para>
/// The unique index is the idempotence of the tick (D1): a second instance that races the first on the same finding
/// cannot write a second row for it.
/// </para>
/// </summary>
public sealed class SignaalConfiguration : IEntityTypeConfiguration<Signaal>
{
    private static readonly ValueConverter<Signaalsoort, string> SoortConverter =
        new(s => s.ToString(), s => Enum.Parse<Signaalsoort>(s));

    public void Configure(EntityTypeBuilder<Signaal> builder)
    {
        builder.ToTable("signalen");

        builder.HasKey(s => s.Id);
        builder.Property(s => s.Soort).HasConversion(SoortConverter).HasMaxLength(32).IsRequired();
        builder.Property(s => s.Sleutel).HasMaxLength(Signaal.MaxSleutellengte).IsRequired();
        builder.Property(s => s.Aangemaakt).IsRequired();

        builder.HasOne<Klas>()
            .WithMany()
            .HasForeignKey(s => s.KlasId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne<Gebruiker>()
            .WithMany()
            .HasForeignKey(s => s.OntvangerId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(s => new { s.Soort, s.KlasId, s.OntvangerId, s.Sleutel }).IsUnique();
        builder.HasIndex(s => s.OntvangerId);
    }
}
