using Jaarplanner.Application.Ai;
using Jaarplanner.Application.AiAuthoring;
using Jaarplanner.Application.AiMatching;
using Jaarplanner.Application.Curriculum;
using Jaarplanner.Application.Curriculum.Import;
using Jaarplanner.Application.Dekking;
using Jaarplanner.Application.Planning;
using Jaarplanner.Application.Planning.Beheer;
using Jaarplanner.Application.Planning.Generatie;
using Jaarplanner.Application.Planning.Weekplanning;
using Jaarplanner.Application.Planning.Rooster;
using Jaarplanner.Application.Schoolcontent.Beheer;
using Jaarplanner.Infrastructure.Ai;
using Jaarplanner.Infrastructure.AiAuthoring;
using Jaarplanner.Infrastructure.AiMatching;
using Jaarplanner.Infrastructure.Dekking;
using Jaarplanner.Infrastructure.Demo;
using Jaarplanner.Infrastructure.OpstapImport;
using Jaarplanner.Infrastructure.Persistence;
using Jaarplanner.Infrastructure.Planning;
using Jaarplanner.Infrastructure.PlanningBeheer;
using Jaarplanner.Infrastructure.SchoolcontentBeheer;
using Jaarplanner.Infrastructure.SchoolcontentImport;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;

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
    /// <param name="environment">
    /// Optional. When supplied, environment-gated registrations (currently only the demo data seeder) can
    /// require Development. Omitting it — as tests that call this directly would — simply means those
    /// registrations are skipped, which is the safe default.
    /// </param>
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration,
        IHostEnvironment? environment = null)
    {
        var connectionString = configuration.GetConnectionString(PostgresConnectionStringName);

        services.AddDbContext<AppDbContext>(options =>
            options.UseNpgsql(connectionString));

        // The Op.stap minimumdoelen register behind the "Bekijk minimumdoelen" toggle (FR-2.4): filter,
        // search and page through decreed minimumdoelen grouped by (discipline, domein, subdomein) derived
        // from concorded leerplandoelen. Pure read over read-only reference data (Art. III.1).
        services.AddScoped<IMinimumdoelenQuery, MinimumdoelenQuery>();

        // Bidirectional concordance read access (Art. V — enables minimumdoel-level coverage; E5).
        services.AddScoped<IConcordantieQuery, ConcordantieQuery>();

        // "Ongekoppelde doelen" gap list (E2-06, FR-4.4): the leerplandoelen not (yet) linked to any
        // thema. "Linked" = a DoelKoppeling with status aanvaard/manueel (Art. V), computed per call so
        // the list tracks the current link state. Pure read over read-only reference data (Art. III.1).
        services.AddScoped<IOngekoppeldeDoelenQuery, OngekoppeldeDoelenQuery>();

        // The Op.stap leerplandoel register behind the Doelen screen (E1-16, FR-2.4): filter, search, page
        // and open one doel. A pure read over read-only reference data (Art. III.1) — the interface has no
        // write method, so registering it grants no mutation path. Filtering/paging run in the database
        // because after a full import this is thousands of rows.
        services.AddScoped<ILeerplandoelenQuery, LeerplandoelenQuery>();

        // Discipline-selection seam (E1-06, Art. XIV "Disciplines first"): which disciplines the
        // Op.stap import path may process is DATA-DRIVEN, never compiled in. The in-scope set is bound
        // from the `Opstap:DisciplineSelectie` configuration section (appsettings / env / user-secrets
        // / Key Vault), so the directie can switch between "all" and a starter selection WITHOUT a code
        // change. Absent config resolves to the documented placeholder default (Modus = Alle) pending
        // the Art. XIV directie decision — itself overridable purely by adding the config section.
        services.Configure<DisciplineSelectieOptions>(
            configuration.GetSection(DisciplineSelectieOptions.SectionName));
        services.AddSingleton<IDisciplineSelectie, GeconfigureerdeDisciplineSelectie>();

        // The Op.stap per-discipline goal Excel parser (E1-03), reading columns A–M exclusively through
        // the single-source OpstapKolom mapping (Art. III.3 / VII.1). A pure parser/mapper with no
        // persistence, so it is stateless and singleton-safe — same as its school-content sibling below.
        //
        // It was NOT registered until E1-15, which is part of the same unreachability defect: the import
        // service had no caller, and the parser its caller would need had no registration either.
        services.AddSingleton<IOpstapParser, ClosedXmlOpstapParser>();

        // The single sanctioned writer of official Op.stap reference data: non-destructive,
        // idempotent (re-)import with a reviewable diff (E1-05, Art. III.4 / IV.2 / FR-2.5). It
        // consults the discipline-selection seam (E1-06) to decide which disciplines it processes.
        // Reachable since E1-15 through OpstapImportController — POST /api/opstap-import(/voorbeeld) —
        // rather than only from its own unit tests, which was the whole defect E1-15 exists to fix.
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

        // Planningsblok-indeling seam (E3-05, ADR-0013, Art. IX.3/XIV). The planning grain is DATA-DRIVEN:
        // the two-tier default ratified by directie on 2026-07-14 (themaperiode 4–6 wk + subthemaperiode
        // ~2 wk) lives in the `Planning:Blokindeling` configuration section, never as a literal in planning
        // logic, and never as a calendar month. Generation (E3-01), the calendar (E3-06/08) and
        // drag-and-drop (E3-07) all consume Planningsblok, so changing the grain is a config edit.
        // Stateless once bound → singleton-safe, matching the discipline-selection seam.
        services.Configure<PlanningsblokOptions>(
            configuration.GetSection(PlanningsblokOptions.SectionName));
        services.AddSingleton<IPlanningsblokIndeling, GeconfigureerdePlanningsblokIndeling>();

        // Klas CRUD (Art. IX.3). Without a creation path a fresh deployment can hold no class-scoped
        // content at all: the school-content import drops every subthema as "onbekende klas" and
        // MaakSubthemaAsync rejects every call. E3 generates a jaarplan PER CLASS, so this is a
        // prerequisite for that epic, not a convenience.
        services.AddScoped<IKlasBeheerService, KlasBeheerService>();

        // The corners of each classroom (owner, meeting 2026-08-30). Registered beside klas CRUD rather than
        // with the thema services because that is where it belongs: a hoek is the one piece of school content
        // that hangs off a klas directly instead of reaching one through a thema.
        services.AddScoped<IHoekBeheerService, HoekBeheerService>();

        // Schooljaar creation/read (E3-01, Art. IX.3). A Klas now REQUIRES a Schooljaar ("Schooljaar contains
        // multiple klassen"), so the container needs a creation path in the same change that makes it required —
        // otherwise class creation, and jaarplan generation with it, would be unreachable. Deliberately no update
        // or delete: editing vakanties reshapes the derived grid and must raise a review signal rather than move a
        // placement (directie 2026-07-28); full schooljaarbeheer stays E6-03.
        services.AddScoped<ISchooljaarBeheerService, SchooljaarBeheerService>();

        // The derived planning grid as a read model (E3-06). The calendar must render EMPTY periods and the
        // vacation gaps between them, which JaarplanWeergave cannot express — it returns placements only. Kept
        // server-side on purpose: re-deriving the grid in TypeScript would duplicate the ADR-0013 seam and
        // disagree with it the moment `Planning:Blokindeling` changes.
        services.AddScoped<IPlanningsroosterService, PlanningsroosterService>();

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

        // The read-only Op.stap leerplandoel query (E2-07). Shared by the authoring assist and — since
        // E2-08 — by the matching service, which needs it to resolve the candidate set a match run may
        // choose from and to check that an "aanpassen" substitution names a code Op.stap really carries
        // (Art. III.1/III.5). Registered once, above both consumers.
        services.AddScoped<ILeerdoelCatalogus, EfLeerdoelCatalogus>();

        // The AI goal-matching service (FR-4), wired end-to-end (E2-08 candidate selection → E2-02 prompt →
        // E2-01 client → E2-03 validation → E2-04 persistence as `voorgesteld`). It depends only on
        // IAiClient + IDoelMatchOpslag + ILeerdoelCatalogus, so the same registration works against the
        // fakes in tests (Art. IV.6). It is reachable through DoelsuggestiesController — POST
        // /api/themas/{themaId}/doelsuggesties/genereer — rather than only from its own unit tests, which
        // was the entire defect E2-08 exists to fix.
        services.AddScoped<DoelMatchingService>();

        // Goal-first authoring assist (E2-07, Art. IV.8, Gap A.7): the wizard's step 2 (themadoel) and
        // step 6 (subdoel) AI hooks. It depends only on IAiClient (E2-01) + ILeerdoelCatalogus (a
        // read-only Op.stap leerplandoel query), so the same registration works against the fakes in
        // tests (Art. IV.6). It returns advisory suggestions transiently — nothing is persisted or
        // auto-applied (Art. IV.1/IV.2); the wizard persists an accepted suggestion via the beheer path.
        services.AddScoped<IThemaOpbouwAssistService, ThemaOpbouwAssistService>();

        // AI jaarplan generation (E3-01, FR-5.1, Art. IV). The persistence port keeps EF Core out of the service;
        // the service itself depends only on IAiClient (E2-01), IPlanningsblokIndeling (E3-05) and this port, so
        // the whole flow runs against fakes with no network and no database in tests (Art. IV.6). It is reachable
        // through JaarplanController — POST /api/klassen/{klasId}/jaarplan/generatie — rather than only from tests.
        services.AddScoped<IJaarplanOpslag, EfJaarplanOpslag>();
        services.AddScoped<JaarplanGeneratieService>();

        // The read half of the jaarplan, registered as its own seam (E5-01). Resolved from the SAME scoped
        // JaarplanGeneratieService instance rather than as a second one, so a request that both reads the plan and
        // computes dekking sees one DbContext and one projection — two instances could answer differently about
        // staleness within a single request, which is exactly the disagreement IJaarplanLezer exists to prevent.
        services.AddScoped<IJaarplanLezer>(sp => sp.GetRequiredService<JaarplanGeneratieService>());

        // Day-level planning inside the plan (E9-03, FR-6.2/FR-7.2). A SECOND seam beside IJaarplanOpslag rather than
        // four more methods on it: that port documents itself as the generation flow's, and a fake for one flow that
        // has to implement the other's methods is how a test ends up asserting against a stub it never exercises.
        //
        // It shares IPlanningsblokIndeling with generation on purpose — that is what makes "this activiteit falls
        // outside its thema's period" measured against the same grid the board draws, rather than a second opinion
        // about which tier a thema lives on. Reachable through WeekplanningController, not only from tests.
        services.AddScoped<IWeekplanningOpslag, EfWeekplanningOpslag>();
        services.AddScoped<IWeekplanningService, WeekplanningService>();

        // Coverage computation (E5-01, FR-9.1, Art. V.1). Computed on read, never stored: there is no dekking
        // table to register, no cache and no invalidation. The service depends only on IJaarplanLezer and this
        // port, so the highest-risk logic in the system (Art. V.6) is unit-tested with no database.
        services.AddScoped<IDekkingOpslag, EfDekkingOpslag>();
        services.AddScoped<DekkingService>();

        // The coverage export as proof of coverage (E5-06, FR-9.5/FR-11.2, Art. V.4). Stateless apart from the
        // clock → singleton-safe. It renders a DekkingWeergave the endpoint has already computed, so there is no
        // second query and no second definition of "gedekt" that could drift from Art. V.1.
        //
        // TryAddSingleton for the clock, because TimeProvider is a framework abstraction other stories will want
        // and two AddSingleton calls for it would be a duplicate registration rather than an override. It is the
        // system clock in the app and a fake in the tests, which is what lets a test assert the document's
        // "opgemaakt op" stamp rather than merely assert that one exists.
        services.TryAddSingleton(TimeProvider.System);
        services.AddSingleton<IDekkingExport, ClosedXmlDekkingExport>();

        // Demo data for the E3-06 review session, OPT-IN ONLY. The flag is checked HERE rather than only
        // inside the service, so an environment that does not ask for it never registers a hosted service
        // that writes to its database at all.
        //
        // `Demo:Seed` is set in Properties/launchSettings.json — i.e. only when a developer starts the app by
        // hand — and deliberately NOT in appsettings.Development.json. WebApplicationFactory loads the latter,
        // so putting it there ran the seeder inside every integration test and broke one on a thema-name
        // collision. If you are tempted to move it back for convenience: that is the bug.
        // Belt and braces: the flag alone is not enough. `Demo__Seed=true` set as a stray environment
        // variable in staging or production would otherwise write demo rows into that database, so
        // Development is required as well.
        if (configuration.GetValue<bool>("Demo:Seed") && environment?.IsDevelopment() == true)
        {
            services.AddHostedService<DemoDataSeeder>();
        }

        services.AddHealthChecks()
            .AddDbContextCheck<AppDbContext>(
                name: "postgres",
                tags: ["db", "ready"]);

        return services;
    }
}
