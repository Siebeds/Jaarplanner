using Jaarplanner.Infrastructure;
using Microsoft.Extensions.Diagnostics.HealthChecks;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

// Data access + database health check live in Infrastructure (Art. VIII — keep Api thin).
// This registers AppDbContext (UseNpgsql, connection string from configuration) and a
// "db"/"ready"-tagged readiness check that /health/ready reflects.
builder.Services.AddInfrastructure(builder.Configuration);

var app = builder.Build();

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

app.Run();

// Exposed so the integration test host (WebApplicationFactory) can reference the entry point.
public partial class Program;
