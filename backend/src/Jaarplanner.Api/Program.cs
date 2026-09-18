using Jaarplanner.Api.Configuration;
using Jaarplanner.Api.Infrastructure;
using Jaarplanner.Api.Infrastructure.Authenticatie;
using Jaarplanner.Api.Infrastructure.Autorisatie;
using Jaarplanner.Application.Toegang;
using Jaarplanner.Infrastructure;
using Microsoft.Extensions.Diagnostics.HealthChecks;

var builder = WebApplication.CreateBuilder(args);

// Cloud secrets (E0-07 / ADR-0012, Art. VI.4): add Azure Key Vault as a configuration
// source ONLY in non-Development environments when a "KeyVault:Uri" is configured.
// No-op locally and in tests (no URI present) — keeps zero Azure dependency for dev/CI.
builder.Configuration.AddAzureKeyVaultIfConfigured(builder.Environment);

// Add services to the container.
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

// REST controllers (thin Api, Art. VIII) for the school-content CRUD endpoints (E1-10).
// Serialise/accept enums by their name (e.g. ActiviteitType "Waarneming", KoppelingStatus
// "Manueel") so the JSON is legible and stable for the Dutch, non-technical-facing frontend —
// matching how the enums are persisted by name in the store.
builder.Services
    .AddControllers()
    .AddJsonOptions(options =>
        options.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter()));

// RFC 7807 ProblemDetails + the school-content exception handler: maps the CRUD application
// exceptions (not-found → 404, validation/scoping/goal-link → 400) without leaking plumbing
// into the controllers (Art. VIII).
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<SchoolcontentExceptionHandler>();

// AI goal-matching exception handler (E2-05): maps the matching faults (thema/suggestie not-found →
// 404, invalid teacher status → 400) to ProblemDetails. Runs after the school-content handler, which
// returns false for anything that is not its own (Art. VIII — keep controllers thin).
builder.Services.AddExceptionHandler<AiMatchingExceptionHandler>();

// Op.stap import exception handler (E1-15): maps the curriculum-integrity refusals — an unknown
// discipline (400), and the two 409s: minimumdoelen that are not loaded yet (E1-12) and a code that
// already belongs to another discipline. The translation from a PostgreSQL SQLSTATE to a typed fault
// happens in Infrastructure, next to the DbContext, so the controller names no EF/Npgsql type (Art. VIII).
builder.Services.AddExceptionHandler<OpstapImportExceptionHandler>();

// Planning exception handler (E3-01): maps the one planning-specific fault — a teacher asking to set a jaarplan
// placement back to `voorgesteld` (Art. IV.1/IV.2) — to a 400. Planning not-found reuses the school-content 404.
builder.Services.AddExceptionHandler<PlanningExceptionHandler>();

// The thema-opbouw wizard's refusals (E6-02 slice 3, ADR-0030 I23–I25): a run that has ended, content outside its
// thema, or an item it did not create. 403, with the service's Dutch sentence.
builder.Services.AddExceptionHandler<WizardrunExceptionHandler>();

// Gebruikerbeheer exception handler (E6-04): no such gebruiker/klas/schooljaar → 404, a bad sign-in name or jaarfase
// → 400, and the two 409s: a sign-in name that exists already, and the last admin (ADR-0031 decision 7).
builder.Services.AddExceptionHandler<GebruikerbeheerExceptionHandler>();

// The rights matrix (E6-02, Art. VI.1, ADR-0030 §3, ADR-0011 §2): every row of Rechtenmatrix becomes a named policy
// that requires a signed-in person plus the row's own rights, decided by one handler over the per-request rights
// service. Curriculumbeheer, the seam the Op.stap import routes already name (ADR-0022), is one of those rows and is
// bound to admin. Since slice 3 every write route names its row: [Authorize(Policy = …)] for a resource-free row,
// [RechtOp(…)] for a resource row, and ElkeWijzigendeRouteVraagtEenRechtTests fails on a write route that names none.
// *Until slice 3 this said the other rows were applied "in the next slice", which is this one.*
builder.Services.AddRechtenbeleid();

// Personal login (E6-01, ADR-0031): a session cookie issued after an Entra sign-in (or the development sign-in, on a
// developer's machine), and a fallback policy under which every endpoint needs that session unless it says otherwise.
// Who may do what once signed in is E6-02's; this only establishes who someone is.
var authenticatie = builder.AddJaarplannerAuthenticatie();

// The last-admin guard counts only another admin who can sign in (E6-04, ADR-0031 decision 7). Under Entra that
// is a bound invitation. The development sign-in binds nobody and is refused outside Development, so only there does
// an unbound admin count; this line is the one place that says so.
builder.Services.Configure<GebruikerbeheerOpties>(opties =>
    opties.OngekoppeldeAdminKanAanmelden = authenticatie.Modus == AuthenticatieModus.Ontwikkeling);

// Data access + database health check live in Infrastructure (Art. VIII — keep Api thin).
// This registers AppDbContext (UseNpgsql, connection string from configuration) and a
// "db"/"ready"-tagged readiness check that /health/ready reflects.
builder.Services.AddInfrastructure(builder.Configuration, builder.Environment);

var app = builder.Build();

// Translate unhandled exceptions to ProblemDetails (uses SchoolcontentExceptionHandler above).
app.UseExceptionHandler();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    // Anonymous: it describes the API, and a developer reads it without signing in.
    app.MapOpenApi().AllowAnonymous();
}
else
{
    // HTTPS only, remembered by the browser (ADR-0031, Art. VI.5).
    app.UseHsts();
}

app.UseHttpsRedirection();

// The built frontend (E7-04, ADR-0034). The API serves it from wwwroot, so the browser stays on one origin and the
// session cookie of ADR-0031 needs no CORS. Before authentication on purpose: the bundle holds no data, and a browser
// without a session must be able to load the page that sends it to the sign-in. A folder without wwwroot, as on a
// developer's machine where Vite serves the frontend, serves nothing here. UseDefaultFiles turns "/" into
// "/index.html": the fallback below cannot, because its route constraint never matches an empty path.
app.UseDefaultFiles();
app.UseStaticFiles();

// Liveness: 200 as long as the app is running. Excludes the DB check so the API stays
// observably "up" even when Postgres is down (the DB state surfaces on /health/ready).
app.MapHealthChecks("/health", new Microsoft.AspNetCore.Diagnostics.HealthChecks.HealthCheckOptions
{
    Predicate = _ => false,
}).AllowAnonymous();

// Readiness: includes the Postgres DbContext check (tag "ready"); reports Unhealthy (503)
// when the database is unreachable rather than crashing the app.
app.MapHealthChecks("/health/ready", new Microsoft.AspNetCore.Diagnostics.HealthChecks.HealthCheckOptions
{
    Predicate = registration => registration.Tags.Contains("ready"),
}).AllowAnonymous();

// Authenticate, refuse a state-changing /api request without the anti-forgery header, then authorise. Called
// explicitly rather than relied on implicitly: an endpoint carrying authorisation metadata with no authorisation
// middleware in the pipeline throws at request time, so the seam must be visibly wired here.
app.UseJaarplannerAuthenticatie(authenticatie);

app.MapControllers();

// Every other path without a file extension is a client route (BrowserRouter, ADR-0021), so a deep link or a bookmark
// opened cold gets index.html instead of a 404 (E7-04). Anonymous for the same reason as the static files. Never for
// api/ or health/: an unknown API path stays an API answer, not a 200 carrying a page that no fetch can parse.
app.MapFallbackToFile(SpaHosting.Route, "index.html").AllowAnonymous();

app.Run();

// Exposed so the integration test host (WebApplicationFactory) can reference the entry point.
public partial class Program;
