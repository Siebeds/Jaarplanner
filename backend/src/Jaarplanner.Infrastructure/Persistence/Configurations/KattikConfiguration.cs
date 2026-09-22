using Jaarplanner.Infrastructure.Kat;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Jaarplanner.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core mapping for <see cref="Kattik"/> (TB-057, ADR-0059 D1). The scheduled moment is the key: that is the whole
/// mechanism, so it carries no surrogate id and no separate unique index.
/// </summary>
public sealed class KattikConfiguration : IEntityTypeConfiguration<Kattik>
{
    public void Configure(EntityTypeBuilder<Kattik> builder)
    {
        builder.ToTable("kattikken");

        builder.HasKey(t => t.Moment);
        builder.Property(t => t.Moment).ValueGeneratedNever();
        builder.Property(t => t.Instantie).HasMaxLength(Kattik.MaxInstantielengte).IsRequired();
        builder.Property(t => t.Gestart).IsRequired();
    }
}
