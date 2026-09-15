using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.Domain.Toegang;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Jaarplanner.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core mapping for <see cref="Woordweb"/> (FB-036, ADR-0043): one per gebruiker and subthema, enforced by a unique
/// index. Both foreign keys cascade (D4): a woordweb is personal content about one subthema, so it goes when the
/// subthema goes, and when its owner is removed as a gebruiker. Unlike an activiteit's maker (SetNull, I17), there is
/// nobody left for a web to belong to.
/// </summary>
public sealed class WoordwebConfiguration : IEntityTypeConfiguration<Woordweb>
{
    public void Configure(EntityTypeBuilder<Woordweb> builder)
    {
        builder.ToTable("woordwebs");

        builder.HasKey(w => w.Id);

        builder.HasOne<Subthema>()
            .WithMany()
            .HasForeignKey(w => w.SubthemaId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne<Gebruiker>()
            .WithMany()
            .HasForeignKey(w => w.EigenaarId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(w => new { w.SubthemaId, w.EigenaarId }).IsUnique();

        builder.HasMany(w => w.Woorden)
            .WithOne()
            .HasForeignKey(woord => woord.WoordwebId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.Navigation(w => w.Woorden)
            .HasField("_woorden")
            .UsePropertyAccessMode(PropertyAccessMode.Field);
    }
}
