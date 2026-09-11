using Jaarplanner.Api.Configuration;
using Jaarplanner.Api.Infrastructure;
using Jaarplanner.Api.Infrastructure.Authenticatie;
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

// The single authorisation seam for curriculum reference-data administration (E1-15, Art. VI.1,
// ADR-0011 §2): one named policy that the Op.stap import endpoints — and E1-12's decreed-minimumdoelen
// import when it lands — authorise against. Since E6-01 it requires a signed-in person (ADR-0031 amends
// ADR-0022 §1); the role half, directie, is E6-02's, and E7-11 stays a deployment gate until then. See
// CurriculumbeheerAutorisatie for what changes when the role matrix arrives.
builder.Services.AddCurriculumbeheerAutorisatie();

// Personal login (E6-01, ADR-0031): a session cookie issued after an Entra sign-in (or the development sign-in, on a
// developer's machine), and a fallback policy under which every endpoint needs that session unless it says otherwise.
// Who may do what once signed in is E6-02's; this only establishes who someone is.
var authenticatie = builder.AddJaarplannerAuthenticatie();

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

app.Run();

// Exposed so the integration test host (WebApplicationFactory) can reference the entry point.
public partial class Program;
