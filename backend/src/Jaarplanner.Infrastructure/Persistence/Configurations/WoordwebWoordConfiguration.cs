using Jaarplanner.Domain.Schoolcontent;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace Jaarplanner.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core mapping for <see cref="WoordwebWoord"/> (FB-036). The status is stored by name, as a goal link's is
/// (<see cref="DoelKoppelingMapping"/>), so the value reads the same in the database as in Art. IV.2.
/// </summary>
public sealed class WoordwebWoordConfiguration : IEntityTypeConfiguration<WoordwebWoord>
{
    private static readonly ValueConverter<KoppelingStatus, string> StatusConverter =
        new(s => s.ToString(), s => Enum.Parse<KoppelingStatus>(s));

    public void Configure(EntityTypeBuilder<WoordwebWoord> builder)
    {
        builder.ToTable("woordweb_woorden");

        builder.HasKey(w => w.Id);

        builder.Property(w => w.Woord).HasMaxLength(Woordweb.MaxWoordlengte).IsRequired();
        builder.Property(w => w.Status).HasConversion(StatusConverter).HasMaxLength(16).IsRequired();
        builder.Property(w => w.AiMotivatie);
        builder.Property(w => w.Volgnummer).IsRequired();

        builder.HasIndex(w => w.WoordwebId);
    }
}
