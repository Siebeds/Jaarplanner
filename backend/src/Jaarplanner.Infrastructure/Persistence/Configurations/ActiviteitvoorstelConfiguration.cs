using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.Domain.Toegang;
using Jaarplanner.Infrastructure.Activiteitvoorstellen;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace Jaarplanner.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core mapping for <see cref="Activiteitvoorstel"/> (FB-025, ADR-0056; FB-070, ADR-0060). It goes with its subthema
/// and with its asker (D9), as a woordweb does; the activiteit an accepted one became outlives it as ordinary content,
/// so that link is cleared, not cascaded. The goal codes are a text array: they name goals the proposal holds no link
/// to, and an accepted proposal's goals live on the activiteit's own links.
/// <para>
/// <b>A cat proposal has a klas where a asked-for one has an asker</b> (ADR-0060 D2), so both foreign keys are optional
/// and each cascades: a deleted gebruiker takes her own proposals, a deleted klas takes the ones addressed to it.
/// <see cref="Activiteitvoorstel.ThemaplaatsingId"/> gets no foreign key on purpose — a themaplaatsing is an owned
/// collection of <c>Jaarplan</c> with no table to reference (see the property).
/// </para>
/// </summary>
public sealed class ActiviteitvoorstelConfiguration : IEntityTypeConfiguration<Activiteitvoorstel>
{
    private static readonly ValueConverter<ActiviteitType, string> SoortConverter =
        new(t => t.ToString(), t => Enum.Parse<ActiviteitType>(t));

    private static readonly ValueConverter<Voorstelbron, string> BronConverter =
        new(b => b.ToString(), b => Enum.Parse<Voorstelbron>(b));

    public void Configure(EntityTypeBuilder<Activiteitvoorstel> builder)
    {
        builder.ToTable("activiteitvoorstellen");

        builder.HasKey(v => v.Id);
        builder.Property(v => v.Bron).HasConversion(BronConverter).HasMaxLength(32).IsRequired();
        builder.Property(v => v.Naam).HasMaxLength(Activiteitvoorstel.MaxNaamlengte).IsRequired();
        builder.Property(v => v.ActiviteitType).HasConversion(SoortConverter).HasMaxLength(32);
        builder.Property(v => v.VerwachteUitkomsten).HasMaxLength(Activiteitvoorstel.MaxUitkomstlengte).IsRequired();
        builder.Property(v => v.LengteInLesuren).IsRequired();
        builder.Property(v => v.Status).HasConversion(SubthemavoorstelConfiguration.StatusConverter).HasMaxLength(16).IsRequired();
        builder.Property(v => v.AiMotivatie).IsRequired();
        builder.PrimitiveCollection(v => v.LeerplandoelCodes)
            .HasField("_leerplandoelCodes")
            .UsePropertyAccessMode(PropertyAccessMode.Field)
            .IsRequired();
        builder.Property<int>(ActiviteitvoorstelService.Volgnummer).IsRequired();

        // PostgreSQL's xmin as row version: two simultaneous decisions on one proposal cannot both be saved.
        builder.Property<uint>("xmin").IsRowVersion();
        builder.Ignore(v => v.IsOpen);

        builder.HasOne<Subthema>()
            .WithMany()
            .HasForeignKey(v => v.SubthemaId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne<Gebruiker>()
            .WithMany()
            .HasForeignKey(v => v.GebruikerId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne<Onderzoeksvraag>()
            .WithMany()
            .HasForeignKey(v => v.OnderzoeksvraagId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne<Activiteit>()
            .WithMany()
            .HasForeignKey(v => v.ActiviteitId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne<Klas>()
            .WithMany()
            .HasForeignKey(v => v.KlasId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(v => new { v.SubthemaId, v.GebruikerId });

        // What the cat asks on every tick: "did I already bring proposals for this placement?" (ADR-0060 G3).
        builder.HasIndex(v => new { v.KlasId, v.ThemaplaatsingId });
    }
}
