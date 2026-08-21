using Jaarplanner.Domain.Schoolcontent;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Jaarplanner.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core mapping for <see cref="Onderzoeksvraag"/> — one driving question per class/age-scoped subthema
/// (Art. IX.2). Multiple onderzoeksvragen may exist per subthema; each owns its <see cref="Onderzoeksvraag.Vraag"/>
/// (required) and an optional <see cref="Onderzoeksvraag.Probleemstelling"/>. Mutable autonomous school content
/// (Art. III). The FK is a required many-to-one to <see cref="Subthema"/>, cascading on delete.
/// </summary>
public sealed class OnderzoeksvraagConfiguration : IEntityTypeConfiguration<Onderzoeksvraag>
{
    public void Configure(EntityTypeBuilder<Onderzoeksvraag> builder)
    {
        builder.ToTable("onderzoeksvragen");

        builder.HasKey(ov => ov.Id);
        builder.Property(ov => ov.SubthemaId).IsRequired();
        builder.Property(ov => ov.Vraag).IsRequired();
        builder.Property(ov => ov.Probleemstelling);
    }
}
