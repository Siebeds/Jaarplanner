using Jaarplanner.Application.Ai;
using Jaarplanner.Application.Kat;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace Jaarplanner.IntegrationTests.Postgres;

/// <summary>
/// Hosts the real API against a throwaway PostgreSQL database (<see cref="PostgresTestDatabase"/>).
/// <para>
/// Unlike the in-memory factory this replaces, only the <b>connection string</b> is overridden — the
/// production Npgsql provider, migrations, FKs, unique indexes and seed data all stay in force, so an
/// endpoint test exercises the same database guarantees the deployed app has.
/// </para>
/// </summary>
public sealed class PostgresApiFactory : JaarplannerApiFactory
{
    private readonly string _connectionString;

    /// <remarks>
    /// The session keys go to this factory's own throwaway database, as they would in production: it is the one host
    /// where that is safe, so it is the one that keeps the real persistence under test.
    /// </remarks>
    public PostgresApiFactory(string connectionString)
    {
        _connectionString = connectionString;
        SessiesleutelsInDatabase = true;
    }

    /// <summary>
    /// The canned completion the stubbed <see cref="IAiClient"/> returns, or <c>null</c> to make any model call fail
    /// the test (E3-03).
    /// <para>
    /// <b>The stub is always registered, deliberately.</b> Left unset it throws rather than answering, so a Postgres
    /// test that reaches the model by accident says so instead of trying to call Azure from CI. Art. IV.6 asks for the
    /// client to be injectable exactly so this is possible; every other seam here stays production.
    /// </para>
    /// </summary>
    public string? AiAntwoord { get; set; }

    /// <summary>The last request the stub received, so a test can check what the prompt holds.</summary>
    public AiRequest? LaatsteAiVerzoek { get; private set; }

    /// <summary>
    /// Detectors this host registers for the cat (TB-057). Empty in production terms: the app ships none until
    /// FB-069 and FB-070 add theirs, so a deurmat test that needs the cat to have noticed something supplies its own.
    /// They are ordinary <see cref="ISignaaldetector"/>s and see no AI client, exactly as a real one will not.
    /// </summary>
    public IList<ISignaaldetector> Detectoren { get; } = [];

    /// <summary>
    /// Extra configuration keys for this host, such as a low <c>AiPrompt:MaxTokens</c>. Read when the host is built, so
    /// set them before the first client.
    /// </summary>
    public IDictionary<string, string> Instellingen { get; } = new Dictionary<string, string>();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        base.ConfigureWebHost(builder);
        builder.UseEnvironment(Environments.Development);

        // Supply the connection string through configuration, the same key production reads, so the
        // Infrastructure wiring stays untouched.
        builder.UseSetting("ConnectionStrings:Postgres", _connectionString);
        foreach (var (sleutel, waarde) in Instellingen)
        {
            builder.UseSetting(sleutel, waarde);
        }

        builder.ConfigureServices(services =>
        {
            // Re-point the DbContext at the test database. The provider is already Npgsql, so only the
            // options descriptor is replaced — no "two providers in one container" juggling needed.
            var options = services
                .Where(d =>
                    d.ServiceType == typeof(DbContextOptions<AppDbContext>) ||
                    d.ServiceType == typeof(DbContextOptions))
                .ToList();
            foreach (var descriptor in options)
            {
                services.Remove(descriptor);
            }

            services.AddDbContext<AppDbContext>(o => o.UseNpgsql(_connectionString));

            foreach (var descriptor in services.Where(d => d.ServiceType == typeof(IAiClient)).ToList())
            {
                services.Remove(descriptor);
            }

            services.AddSingleton<IAiClient>(new StubAiClient(() => AiAntwoord, verzoek => LaatsteAiVerzoek = verzoek));

            foreach (var detector in Detectoren)
            {
                services.AddSingleton(detector);
            }
        });
    }

    /// <summary>Reads the canned answer at call time, so a test can set it after the host is built.</summary>
    private sealed class StubAiClient : IAiClient
    {
        private readonly Func<string?> _antwoord;
        private readonly Action<AiRequest> _ontvangen;

        public StubAiClient(Func<string?> antwoord, Action<AiRequest> ontvangen)
        {
            _antwoord = antwoord;
            _ontvangen = ontvangen;
        }

        public Task<AiCompletion> CompleteAsync(AiRequest request, CancellationToken cancellationToken = default)
        {
            _ontvangen(request);
            return Task.FromResult(new AiCompletion
            {
                Content = _antwoord()
                    ?? throw new InvalidOperationException(
                        "The AI client was reached on a Postgres test that set no canned answer."),
            });
        }
    }
}
