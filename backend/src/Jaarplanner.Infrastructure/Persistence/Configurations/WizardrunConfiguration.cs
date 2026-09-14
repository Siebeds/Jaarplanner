using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.Domain.Toegang;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Jaarplanner.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core mapping for <see cref="Wizardrun"/> (E6-02, ADR-0030 R32, I22–I25): one row per run, one run per thema, and
/// the items it created in a table of their own.
/// <para>
/// <b>The items carry no foreign key to what they name</b>, on purpose. One column names a subthema, a subdoel or an
/// activiteit, which live in three tables. An item whose target was deleted some other way (a subthema delete takes its
/// activiteiten) is left behind and can never match again, because ids are never reused; the run forgets the ones it
/// deletes itself. A FK per kind would buy tidiness at the price of three nullable columns, for no rule that needs it.
/// </para>
/// </summary>
public sealed class WizardrunConfiguration : IEntityTypeConfiguration<Wizardrun>
{
    public void Configure(EntityTypeBuilder<Wizardrun> builder)
    {
        builder.ToTable("wizardruns");

        builder.HasKey(r => r.Id);

        // The run goes with its thema: without it, there is nothing left for the run to be about.
        builder.HasOne<Thema>()
            .WithMany()
            .HasForeignKey(r => r.ThemaId)
            .OnDelete(DeleteBehavior.Cascade);

        // One run per thema: a run creates its thema, so a second one for the same thema cannot arise.
        builder.HasIndex(r => r.ThemaId).IsUnique();

        // SetNull, like an activiteit's maker: removing a gebruiker must not remove the record of what was built.
        builder.Property(r => r.GestartDoorId);
        builder.HasOne<Gebruiker>()
            .WithMany()
            .HasForeignKey(r => r.GestartDoorId)
            .IsRequired(false)
            .OnDelete(DeleteBehavior.SetNull);

        builder.Property(r => r.GestartOp).IsRequired();
        builder.Property(r => r.LaatsteSchrijfactieOp).IsRequired();
        builder.Property(r => r.AfgerondOp);
        builder.Property(r => r.GeslotenOp);

        // Derived from the last write action; stored nowhere, so it cannot disagree with it.
        builder.Ignore(r => r.SluitUiterlijkOp);

        builder.OwnsMany(r => r.Aangemaakt, item =>
        {
            item.ToTable("wizardrunitems");
            item.WithOwner().HasForeignKey("WizardrunId");
            item.HasKey(i => i.Id);

            // By name, like every other enum in this store, so a reordering never relabels a row.
            item.Property(i => i.Soort).HasConversion<string>().HasMaxLength(16).IsRequired();
            item.Property(i => i.ItemId).IsRequired();

            item.HasIndex("WizardrunId", nameof(Wizardrunitem.ItemId)).IsUnique();
        });
        builder.Navigation(r => r.Aangemaakt)
            .HasField("_aangemaakt")
            .UsePropertyAccessMode(PropertyAccessMode.Field);
    }
}
