using Jaarplanner.Application.Ai;
using Jaarplanner.Application.AiAuthoring;
using Jaarplanner.Application.AiMatching;
using Jaarplanner.Application.Curriculum;
using Jaarplanner.Application.Curriculum.Import;
using Jaarplanner.Application.Schoolcontent.Beheer;
using Jaarplanner.Infrastructure.Ai;
using Jaarplanner.Infrastructure.AiAuthoring;
using Jaarplanner.Infrastructure.AiMatching;
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

        // "Ongekoppelde doelen" gap list (E2-06, FR-4.4): the leerplandoelen not (yet) linked to any
        // thema. "Linked" = a DoelKoppeling with status aanvaard/manueel (Art. V), computed per call so
        // the list tracks the current link state. Pure read over read-only reference data (Art. III.1).
        services.AddScoped<IOngekoppeldeDoelenQuery, OngekoppeldeDoelenQuery>();

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

        // AI seam (E2-01, Art. IV.6 / VI.4). The matching/plan logic depends on the injectable
        // IAiClient interface (Application) so it is fakeable with no network in tests; the real
        // implementation is the Azure AI Foundry client (Infrastructure, Art. VIII). Its key/endpoint
        // are read from the server-side `AzureAI` config section only (user-secrets / Key Vault) —
        // the key never reaches the frontend (Art. VI.4).
        services.Configure<AzureAIOptions>(configuration.GetSection(AzureAIOptions.SectionName));
        services.AddHttpClient<IAiClient, AzureAiFoundryClient>();

        // The AI goal-matching persistence port (E2-04, Art. VIII layering): the matching service
        // persists/queries thema-level suggestions through this seam, so it stays free of EF Core and
        // is fakeable with no database in tests. EF Core implementation over AppDbContext.
        services.AddScoped<IDoelMatchOpslag, EfDoelMatchOpslag>();

        // The AI goal-matching service (FR-4), now wired end-to-end (E2-02 prompt → E2-01 client →
        // E2-03 validation → E2-04 persistence as `voorgesteld`). It depends only on IAiClient +
        // IDoelMatchOpslag, so the same registration works against the fakes in tests (Art. IV.6).
        services.AddScoped<DoelMatchingService>();

        // Goal-first authoring assist (E2-07, Art. IV.8, Gap A.7): the wizard's step 2 (themadoel) and
        // step 6 (subdoel) AI hooks. It depends only on IAiClient (E2-01) + ILeerdoelCatalogus (a
        // read-only Op.stap leerplandoel query), so the same registration works against the fakes in
        // tests (Art. IV.6). It returns advisory suggestions transiently — nothing is persisted or
        // auto-applied (Art. IV.1/IV.2); the wizard persists an accepted suggestion via the beheer path.
        services.AddScoped<ILeerdoelCatalogus, EfLeerdoelCatalogus>();
        services.AddScoped<IThemaOpbouwAssistService, ThemaOpbouwAssistService>();

        services.AddHealthChecks()
            .AddDbContextCheck<AppDbContext>(
                name: "postgres",
                tags: ["db", "ready"]);

        return services;
    }
}
