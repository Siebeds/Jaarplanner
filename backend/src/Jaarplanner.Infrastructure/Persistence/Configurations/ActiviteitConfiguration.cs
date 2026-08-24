using Jaarplanner.Domain.Schoolcontent;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace Jaarplanner.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core mapping for <see cref="Activiteit"/> — class/age-scoped (Art. IX.2), inheriting the
/// class/age scope from its owning subthema. <see cref="Activiteit.ActiviteitType"/> is persisted
/// by name so adding an enum member never renumbers existing rows. It owns a collection of
/// <see cref="DoelKoppeling"/> links (one or more leerdoelen; Art. IX.2).
/// </summary>
public sealed class ActiviteitConfiguration : IEntityTypeConfiguration<Activiteit>
{
    public void Configure(EntityTypeBuilder<Activiteit> builder)
    {
        builder.ToTable("activiteiten");

        builder.HasKey(a => a.Id);
        builder.Property(a => a.SubthemaId).IsRequired();
        builder.Property(a => a.Naam).HasMaxLength(256).IsRequired();

        var typeConverter = new ValueConverter<ActiviteitType, string>(
            t => t.ToString(),
            t => Enum.Parse<ActiviteitType>(t));
        builder.Property(a => a.ActiviteitType)
            .HasConversion(typeConverter)
            .HasColumnName("activiteit_type")
            .HasMaxLength(32)
            .IsRequired();

        builder.Property(a => a.Hoek).HasMaxLength(128);
        builder.Property(a => a.VerwachteUitkomsten);

        // Stored by NAME, like ActiviteitType above: a column reading "Olijf" survives a reordering of
        // the enum, where a stored 1 would silently become another colour.
        var kleurConverter = new ValueConverter<Activiteitkleur, string>(
            k => k.ToString(),
            k => Enum.Parse<Activiteitkleur>(k));
        // Defaulted in the database as well as in the entity, so every row that predates the column
        // reads back as one lesuur rather than as zero.
        builder.Property(a => a.LengteInLesuren).IsRequired().HasDefaultValue(1).HasColumnName("lengte_in_lesuren");

        builder.Property(a => a.Kleur)
            .HasConversion(kleurConverter)
            .HasColumnName("kleur")
            .HasMaxLength(32);

        // Optional link to one onderzoeksvraag of the same subthema. SetNull on delete: losing the
        // onderzoeksvraag-tag is not data loss of the activiteit itself (Art. IX.2).
        builder.Property(a => a.OnderzoeksvraagId);
        builder.HasOne<Onderzoeksvraag>()
            .WithMany()
            .HasForeignKey(a => a.OnderzoeksvraagId)
            .IsRequired(false)
            .OnDelete(DeleteBehavior.SetNull);

        // Zero or more goal links — owned collection in its own table.
        builder.OwnsMany(a => a.Doelkoppelingen, DoelKoppelingMapping.Configure);
        builder.Navigation(a => a.Doelkoppelingen)
            .HasField("_doelkoppelingen")
            .UsePropertyAccessMode(PropertyAccessMode.Field);
    }
}
