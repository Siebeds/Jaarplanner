using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Schoolcontent;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace Jaarplanner.Infrastructure.Persistence.Configurations;

/// <summary>
/// Shared mapping for the owned <see cref="DoelKoppeling"/> value (Art. IX.2 — the link entity used
/// by themadoelen, subdoelen and activity links alike). It is owned by each parent so the same CLR
/// type lands in a parent-specific table; this helper keeps the column shape and the FK to the
/// read-only leerplandoel identical everywhere (single source of mapping truth).
/// <para>
/// The <see cref="DoelKoppeling.LeerplandoelCode"/> is a FK to <see cref="Leerplandoel.Code"/>.
/// <see cref="DoelKoppeling.Status"/> is persisted by name (voorgesteld/aanvaard/geweigerd/manueel,
/// Art. IV.2) so the value is legible and stable in the database.
/// </para>
/// </summary>
internal static class DoelKoppelingMapping
{
    private static readonly ValueConverter<KoppelingStatus, string> StatusConverter =
        new(s => s.ToString(), s => Enum.Parse<KoppelingStatus>(s));

    public static void Configure<TOwner>(OwnedNavigationBuilder<TOwner, DoelKoppeling> builder)
        where TOwner : class
    {
        builder.Property(k => k.LeerplandoelCode).HasColumnName("leerplandoel_code").HasMaxLength(64).IsRequired();

        builder.Property(k => k.Status)
            .HasConversion(StatusConverter)
            .HasColumnName("status")
            .HasMaxLength(16)
            .IsRequired();

        builder.Property(k => k.AiMotivatie).HasColumnName("ai_motivatie");

        // FK to the read-only leerplandoel by its stable code (Art. III.5). Restrict: reference
        // data is not deleted by the app (Art. III.1), and a link must not dangle.
        builder.HasOne<Leerplandoel>()
            .WithMany()
            .HasForeignKey(k => k.LeerplandoelCode)
            .HasPrincipalKey(l => l.Code)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(k => k.LeerplandoelCode);
    }
}
