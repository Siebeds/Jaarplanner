using Jaarplanner.Application.Curriculum;
using Jaarplanner.Application.Curriculum.Import;
using Jaarplanner.Application.Schoolcontent.Beheer;
using Jaarplanner.Infrastructure.OpstapImport;
using Jaarplanner.Infrastructure.Persistence;
using Jaarplanner.Infrastructure.SchoolcontentBeheer;
using Jaarplanner.Infrastructure.SchoolcontentImport;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Jaarplanner.Infrastructure;

/// <summary>
/// Composition root for the Infrastructure layer. The (thin) Api calls
/// <see cref="AddInfrastructure"/> from Program.cs so that data-access concerns
/// stay in Infrastructure (Art. VIII layering: Domain ← Application ← Infrastructure).
/// </summary>
public static class DependencyInjection
{
    /// <summary>
    /// Configuration key holding the PostgreSQL connection string.
    /// Provided via .NET user-secrets locally and Azure Key Vault in the cloud (E0-07,
    /// ADR-0012) — never committed (Art. VI.4). Read as <c>ConnectionStrings:Postgres</c>.
    /// </summary>
    public const string PostgresConnectionStringName = "Postgres";

    /// <summary>
    /// Registers the EF Core <see cref="AppDbContext"/> on the Npgsql (PostgreSQL) provider
    /// and a database readiness health check (tagged "db", "ready") that <c>/health</c> uses.
    /// The connection string is resolved from configuration; if absent the app still starts
    /// and the health check reports Unhealthy rather than crashing.
    /// </summary>
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString(PostgresConnectionStringName);

        services.AddDbContext<AppDbContext>(options =>
            options.UseNpgsql(connectionString));

        // Bidirectional concordance read access (Art. V — enables minimumdoel-level coverage; E5).
        services.AddScoped<IConcordantieQuery, ConcordantieQuery>();

        // Discipline-selection seam (E1-06, Art. XIV "Disciplines first"): which disciplines the
        // Op.stap import path may process is DATA-DRIVEN, never compiled in. The in-scope set is bound
        // from the `Opstap:DisciplineSelectie` configuration section (appsettings / env / user-secrets
        // / Key Vault), so the directie can switch between "all" and a starter selection WITHOUT a code
        // change. Absent config resolves to the documented placeholder default (Modus = Alle) pending
        // the Art. XIV directie decision — itself overridable purely by adding the config section.
        services.Configure<DisciplineSelectieOptions>(
            configuration.GetSection(DisciplineSelectieOptions.SectionName));
        services.AddSingleton<IDisciplineSelectie, GeconfigureerdeDisciplineSelectie>();

        // The single sanctioned writer of official Op.stap reference data: non-destructive,
        // idempotent (re-)import with a reviewable diff (E1-05, Art. III.4 / IV.2 / FR-2.5). It
        // consults the discipline-selection seam (E1-06) to decide which disciplines it processes.
        services.AddScoped<IOpstapImportService, OpstapImportService>();

        // The school-content (thema/subthema/activiteit) Excel parser/validator: validates
        // required columns/fields and produces clear per-row diagnostics (E1-07, FR-1.1/1.2). A
        // pure parser/validator (no persistence) so it is stateless and singleton-safe.
        services.AddSingleton<ISchoolcontentParser, ClosedXmlSchoolcontentParser>();

        // The downloadable import template generator: emits the header + one valid example row from
        // the SAME single-source column mapping the parser reads, so template and parser never drift
        // (E1-09, FR-1.5, Gap A.4, Art. III.3). Stateless → singleton-safe.
        services.AddSingleton<ISchoolcontentTemplateGenerator, ClosedXmlSchoolcontentTemplateGenerator>();

        // The school-content import-commit path: preview/diff + add/update-overwrite re-import, with the
        // non-destructive guarantee that teacher DoelKoppeling decisions survive an overwrite (E1-08,
        // FR-1.3/1.4, Art. IV.2 — the school-content analogue of IOpstapImportService).
        services.AddScoped<ISchoolcontentImportService, SchoolcontentImportService>();

        // CRUD for the autonomous school-content hierarchy + manual goal links (E1-10, FR-3.1/3.2).
        // Enforces level scoping (Art. IX.2) and persists manual links as `manueel` (Art. IV.2); a
        // sibling of the import service that drives the same domain mutators.
        services.AddScoped<ISchoolcontentBeheerService, SchoolcontentBeheerService>();

        services.AddHealthChecks()
            .AddDbContextCheck<AppDbContext>(
                name: "postgres",
                tags: ["db", "ready"]);

        return services;
    }
}
