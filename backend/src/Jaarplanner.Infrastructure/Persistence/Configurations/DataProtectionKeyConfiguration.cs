using Microsoft.AspNetCore.DataProtection.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Jaarplanner.Infrastructure.Persistence.Configurations;

/// <summary>
/// Where ASP.NET Core Data Protection keeps the keys that encrypt the session cookie (ADR-0031 decision 5). In the
/// database, so a restart or a second instance does not log everyone out. Only the table name is ours; the shape is
/// the framework's.
/// </summary>
public sealed class DataProtectionKeyConfiguration : IEntityTypeConfiguration<DataProtectionKey>
{
    public void Configure(EntityTypeBuilder<DataProtectionKey> builder) => builder.ToTable("data_protection_keys");
}
