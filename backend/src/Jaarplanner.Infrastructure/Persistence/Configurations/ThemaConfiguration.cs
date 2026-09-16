using Jaarplanner.Domain.Schoolcontent;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Jaarplanner.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core mapping for <see cref="Thema"/> — school-scoped autonomous content (Art. IX.2).
/// The two-tier vocabulary (<see cref="Thema.Kernwoordenschat"/> / <see cref="Thema.RijkeWoordenschat"/>)
/// is mapped as PostgreSQL <c>text[]</c> primitive collections (school-wide, by design).
/// Themadoelen and subthema's are owned/related collections accessed through their backing fields.
/// </summary>
public sealed class ThemaConfiguration : IEntityTypeConfiguration<Thema>
{
    public void Configure(EntityTypeBuilder<Thema> builder)
    {
        builder.ToTable("themas");

        builder.HasKey(t => t.Id);

        builder.Property(t => t.Naam).HasMaxLength(256).IsRequired();
        builder.Property(t => t.Invalshoeken);
        builder.Property(t => t.DuurWeken).IsRequired();

        // School-wide two-tier vocabulary — Npgsql maps List<string> to text[] (Art. IX.2).
        builder.PrimitiveCollection(t => t.Kernwoordenschat)
            .HasField("_kernwoordenschat");
        builder.PrimitiveCollection(t => t.RijkeWoordenschat)
            .HasField("_rijkeWoordenschat");

        // School-scoped themadoelen that link a leerplandoel — related collection, accessed via backing field.
        builder.HasMany(t => t.Themadoelen)
            .WithOne()
            .HasForeignKey(td => td.ThemaId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.Navigation(t => t.Themadoelen)
            .HasField("_themadoelen")
            .UsePropertyAccessMode(PropertyAccessMode.Field);

        // The minimumdoelen the thema aims at (FB-043). Auto-included: every read of a thema shows them, and they are a
        // handful of refs.
        builder.HasMany(t => t.Minimumdoelen)
            .WithOne()
            .HasForeignKey(m => m.ThemaId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.Navigation(t => t.Minimumdoelen)
            .HasField("_minimumdoelen")
            .UsePropertyAccessMode(PropertyAccessMode.Field)
            .AutoInclude();

        // Class/age-scoped subthema's belong to the school-wide thema.
        builder.HasMany(t => t.Subthemas)
            .WithOne()
            .HasForeignKey(s => s.ThemaId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.Navigation(t => t.Subthemas)
            .HasField("_subthemas")
            .UsePropertyAccessMode(PropertyAccessMode.Field);

        // The AI's proposals of a minimumdoel as themadoel (FB-053, ADR-0050), open and decided, in their own table.
        // Not auto-included: only the suggestion flow reads them.
        builder.HasMany(t => t.Doelsuggesties)
            .WithOne()
            .HasForeignKey(s => s.ThemaId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.Navigation(t => t.Doelsuggesties)
            .HasField("_doelsuggesties")
            .UsePropertyAccessMode(PropertyAccessMode.Field);
    }
}
