using Jaarplanner.Domain.Ontwikkelingsrapport;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace Jaarplanner.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core mapping for <see cref="Gradatie"/> (FB-002, Art. IX.4): one star of the one K3 scale. No schooljaar column
/// (ADR-0035 R7).
/// <para>
/// <b>The two starting stars are seeded by the migration <c>AddRapportdoelenEnGradaties</c>, not by <c>HasData</c>
/// here.</b> They are a proposal the K3 leerkrachten rename, recolour and delete, and <c>HasData</c> would make them the
/// model's: a later edit of the seed would then generate an <c>UpdateData</c> that overwrites what the teachers made of
/// them.
/// </para>
/// </summary>
public sealed class GradatieConfiguration : IEntityTypeConfiguration<Gradatie>
{
    // Stored by NAME, like KoppelingStatus and Activiteitkleur: a column reading "Oranje" survives a reordering of the enum,
    // where a stored 3 would silently become another colour.
    private static readonly ValueConverter<Sterkleur, string> KleurConverter =
        new(k => k.ToString(), k => Enum.Parse<Sterkleur>(k));

    public void Configure(EntityTypeBuilder<Gradatie> builder)
    {
        builder.ToTable("gradaties");

        builder.HasKey(g => g.Id);
        builder.Property(g => g.Id).ValueGeneratedNever();

        builder.Property(g => g.Label).HasMaxLength(Gradatie.MaxLabelLengte).IsRequired();
        builder.Property(g => g.Kleur).HasConversion(KleurConverter).HasMaxLength(16).IsRequired();
        builder.Property(g => g.Volgorde).IsRequired();
    }
}
