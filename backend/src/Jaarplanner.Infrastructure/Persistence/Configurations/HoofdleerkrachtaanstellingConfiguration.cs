using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Toegang;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Jaarplanner.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core mapping for <see cref="Hoofdleerkrachtaanstelling"/> (E6-02, ADR-0030 R5): unique per (gebruiker, schooljaar,
/// jaarfase), several gebruikers per (schooljaar, jaarfase) allowed, removed with the gebruiker or the schooljaar.
/// </summary>
public sealed class HoofdleerkrachtaanstellingConfiguration : IEntityTypeConfiguration<Hoofdleerkrachtaanstelling>
{
    public void Configure(EntityTypeBuilder<Hoofdleerkrachtaanstelling> builder)
    {
        builder.ToTable("hoofdleerkrachtaanstellingen");

        builder.HasKey(a => a.Id);

        // One of nine codes, as klassen.Jaarfase; the domain refuses anything else.
        builder.Property(a => a.Jaarfase).HasMaxLength(8).IsRequired();

        builder.HasOne<Gebruiker>()
            .WithMany()
            .HasForeignKey(a => a.GebruikerId)
            .OnDelete(DeleteBehavior.Cascade);

        // Cascade, unlike schooljaren → klassen (Restrict): an appointment is not planning data a human must decide to
        // throw away, it is a right that means nothing without its year.
        builder.HasOne<Schooljaar>()
            .WithMany()
            .HasForeignKey(a => a.SchooljaarId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(a => new { a.GebruikerId, a.SchooljaarId, a.Jaarfase }).IsUnique();

        // The beheer screen lists a year's appointments per jaarfase.
        builder.HasIndex(a => new { a.SchooljaarId, a.Jaarfase });
    }
}
