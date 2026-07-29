using Jaarplanner.Api.Configuration;
using Jaarplanner.Api.Infrastructure;
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

// Planning exception handler (E3-01): maps the one planning-specific fault — a teacher asking to set a jaarplan
// placement back to `voorgesteld` (Art. IV.1/IV.2) — to a 400. Planning not-found reuses the school-content 404.
builder.Services.AddExceptionHandler<PlanningExceptionHandler>();

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
    app.MapOpenApi();
}

app.UseHttpsRedirection();

// Liveness: 200 as long as the app is running. Excludes the DB check so the API stays
// observably "up" even when Postgres is down (the DB state surfaces on /health/ready).
app.MapHealthChecks("/health", new Microsoft.AspNetCore.Diagnostics.HealthChecks.HealthCheckOptions
{
    Predicate = _ => false,
});

// Readiness: includes the Postgres DbContext check (tag "ready"); reports Unhealthy (503)
// when the database is unreachable rather than crashing the app.
app.MapHealthChecks("/health/ready", new Microsoft.AspNetCore.Diagnostics.HealthChecks.HealthCheckOptions
{
    Predicate = registration => registration.Tags.Contains("ready"),
});

app.MapControllers();

app.Run();

// Exposed so the integration test host (WebApplicationFactory) can reference the entry point.
public partial class Program;
