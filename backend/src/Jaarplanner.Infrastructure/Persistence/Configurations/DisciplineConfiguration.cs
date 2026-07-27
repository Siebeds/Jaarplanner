using Jaarplanner.Domain.Curriculum;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Jaarplanner.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core mapping for <see cref="Discipline"/> (read-only Op.stap reference data, Art. III.1).
/// The string <see cref="Discipline.Nummer"/> is the primary key; the 9.x nesting is a
/// self-reference via <see cref="Discipline.ParentDisciplineNummer"/>.
/// </summary>
public sealed class DisciplineConfiguration : IEntityTypeConfiguration<Discipline>
{
    public void Configure(EntityTypeBuilder<Discipline> builder)
    {
        builder.ToTable("disciplines");

        builder.HasKey(d => d.Nummer);

        builder.Property(d => d.Nummer).HasMaxLength(16);
        builder.Property(d => d.Naam).HasMaxLength(256).IsRequired();
        builder.Property(d => d.ParentDisciplineNummer).HasMaxLength(16);

        // Self-reference for the 9.x split. Restrict so a parent cannot be deleted while
        // children remain (reference data is not deleted by the app in any case — Art. III.1).
        builder.HasOne<Discipline>()
            .WithMany()
            .HasForeignKey(d => d.ParentDisciplineNummer)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasData(AuthoritativeDisciplines);
    }

    /// <summary>
    /// The authoritative Op.stap discipline list, seeded as reference data.
    /// <para>
    /// <b>Why this is seeded and not imported.</b> <see cref="Leerplandoel.DisciplineNummer"/> is a
    /// required <c>Restrict</c> FK to this table, but the per-discipline goal Excel carries only the
    /// discipline <i>number</i> (it is one file per discipline; the number is supplied by the caller)
    /// and <b>no discipline name</b> — see the Art. VII.1 column map, which has no such column. So no
    /// import path can populate this table, and without a seed the very first real import fails on the
    /// FK. The list is stable, official, decreed reference data, so a migration seed is the correct
    /// home (Art. III.1: the app never mutates official content).
    /// </para>
    /// <para>
    /// <b>Source.</b> <c>CONSTITUTION.md</c> Art. VII.0 "Disciplines are numbered and partly nested",
    /// verbatim and in order. Do not edit this list here — change the constitution first, then mirror
    /// it, then add a migration.
    /// </para>
    /// <para>
    /// <b>On the 9.x nesting.</b> <see cref="Discipline.ParentDisciplineNummer"/> is deliberately left
    /// <c>null</c> for 9.1/9.2/9.3. The authoritative list contains no bare <c>"9"</c> row and does not
    /// give discipline 9 a name; inventing one would fabricate official reference data, and the parent
    /// column is a self-FK so a parent cannot be referenced before it exists. The nesting seam (column
    /// + self-FK) stays in place — seed the <c>"9"</c> row and set these three parents in a follow-up
    /// migration once directie supplies its official name.
    /// </para>
    /// </summary>
    private static readonly Discipline[] AuthoritativeDisciplines =
    [
        new("1", "Nederlands en communicatie"),
        new("2", "Wiskunde"),
        new("3", "Wetenschap en techniek"),
        new("4", "Aardrijkskunde"),
        new("5", "Geschiedenis"),
        new("6", "Muzische vorming"),
        new("7", "Lichamelijke opvoeding en motoriek"),
        new("8", "ICT"),
        new("9.1", "Veilige en gezonde levensstijl"),
        new("9.2", "Leren leren"),
        new("9.3", "Sociaal en emotioneel leren"),
        new("10", "Frans"),
        new("11", "Rooms-katholieke godsdienst"),
    ];
}
