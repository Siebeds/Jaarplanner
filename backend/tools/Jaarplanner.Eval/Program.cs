using Azure.Identity;
using Jaarplanner.Application.AiAuthoring;
using Jaarplanner.Infrastructure.Ai;
using Jaarplanner.Infrastructure.AiAuthoring;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Options;

namespace Jaarplanner.Eval;

/// <summary>
/// Entry point of the eval runner (TB-004). See this project's README for the evalset format and the settings. The
/// console text is Dutch because the owner reads it (Art. II.6, clause 1); options and code are English (Art. II.2).
/// </summary>
internal static class Program
{
    private const string Usage =
        """
        Gebruik:
          dotnet run --project backend/tools/Jaarplanner.Eval -- --evalset <pad> --models <deployment>[,<deployment>] [opties]

        Opties:
          --variants A,B         A = alle doelen van de jaarfase, B = embeddings en top n (standaard: A,B)
          --embedding <naam>     embeddingdeployment voor variant B
          --top <n>              aantal kandidaten in variant B (standaard: 25)
          --max <n>              hoogstens zoveel suggesties per subthema (standaard: 8)
          --goal-format <v>      compact of full (standaard: compact)
          --reasoning <niveau>   reasoning_effort voor de gpt-5-familie, bv. minimal of low
          --out <map>            waar rapport en cache komen (standaard: eval-data/ in de repo, genegeerd door git)

        Instellingen via user-secrets (dotnet user-secrets set ... --project backend/tools/Jaarplanner.Eval):
          AzureAI:Endpoint, ConnectionStrings:Postgres, en optioneel Prices:<deployment>:Input|CachedInput|Output.
        Zonder AzureAI:ApiKey meldt de runner zich aan via de Azure CLI: doe eerst 'az login'.
        """;

    private static async Task<int> Main(string[] args)
    {
        if (args.Contains("--help") || args.Contains("-h"))
        {
            Console.WriteLine(Usage);
            return 0;
        }

        var config = new ConfigurationBuilder()
            .SetBasePath(AppContext.BaseDirectory)
            .AddJsonFile("appsettings.json", optional: true)
            .AddUserSecrets(typeof(Program).Assembly, optional: true)
            .AddEnvironmentVariables()
            .AddCommandLine(args, EvalOptions.Switches)
            .Build();

        EvalOptions options;
        Evalset evalset;
        try
        {
            options = EvalOptions.Read(config);
            evalset = EvalsetReader.ReadFile(options.EvalsetPath);
        }
        catch (Exception ex) when (ex is EvalException or IOException or UnauthorizedAccessException)
        {
            Console.Error.WriteLine(ex.Message);
            Console.Error.WriteLine();
            Console.Error.WriteLine(Usage);
            return 2;
        }

        var defaultRoot = RepoGuard.FindRepoRoot(Directory.GetCurrentDirectory()) ?? Directory.GetCurrentDirectory();
        var output = Path.GetFullPath(options.Out ?? Path.Combine(defaultRoot, "eval-data"));
        var reportPath = Path.Combine(output, $"rapport-{DateTime.Now:yyyyMMdd-HHmmss}.md");
        var cacheFolder = Path.Combine(output, "cache");

        // The report quotes the evalset (a school's own content), and this repository is public: inside a repo the
        // runner writes only where git ignores it, and when git cannot say, it does not write.
        var unsafeFile = RepoGuard.FirstUnsafe([reportPath, Path.Combine(cacheFolder, "embeddings.json")]);
        if (unsafeFile is not null)
        {
            Console.Error.WriteLine(
                $"{unsafeFile} ligt in de repo op een plaats die git niet negeert (of git kon het niet nagaan). " +
                "Deze repo is publiek: kies een map onder eval-data/ of buiten de repo.");
            return 2;
        }

        if (RepoGuard.IsExposed(options.EvalsetPath))
        {
            Console.Error.WriteLine(
                "Let op: de evalset staat in de repo op een plaats die git niet negeert. Een echte evalset hoort " +
                "onder eval-data/, want deze repo is publiek.");
        }

        Directory.CreateDirectory(output);

        using var stop = new CancellationTokenSource();
        Console.CancelKeyPress += (_, e) =>
        {
            e.Cancel = true;
            stop.Cancel();
        };

        await using var db = new AppDbContext(
            new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(options.ConnectionString).Options);
        ILeerdoelCatalogus catalogus = new CachingCatalogus(new EfLeerdoelCatalogus(db));
        using var http = new HttpClient { Timeout = TimeSpan.FromMinutes(5) };

        // Without a key: the Azure CLI's sign-in, chosen explicitly (ADR-0036), one cached token for every call.
        var entra = options.ApiKey is null ? new EntraTokenProvider(new AzureCliCredential()) : null;

        var models = options.Models
            .Select(deployment =>
            {
                var clientOptions = Options.Create(new AzureAIOptions
                {
                    Endpoint = options.Endpoint,
                    ApiKey = options.ApiKey,
                    Authentication = entra is null ? AzureAIAuthentication.Key : AzureAIAuthentication.Entra,
                    Deployment = deployment,
                    ReasoningEffort = options.ReasoningEffort,
                });
                var client = entra is null
                    ? new AzureAiFoundryClient(http, clientOptions)
                    : new AzureAiFoundryClient(http, clientOptions, entra);
                return new EvalModel(deployment, client);
            })
            .ToList();

        var variants = new List<IKandidaatSelectie>();
        if (options.VariantA)
        {
            variants.Add(new JaarfaseSelectie(catalogus));
        }

        if (options.VariantB)
        {
            variants.Add(new EmbeddingSelectie(
                catalogus,
                new AzureEmbeddingClient(http, options.Endpoint, options.Embedding!, options.ApiKey, entra),
                new EmbeddingCache(cacheFolder),
                options.Top,
                log: Console.WriteLine));
        }

        var runner = new EvalRunner(
            variants,
            models,
            options.GoalFormat,
            options.Max,
            EvalOptions.ReadPrices(config),
            Console.WriteLine);

        EvalRapport report;
        try
        {
            report = await runner.RunAsync(evalset, stop.Token);
        }
        catch (OperationCanceledException)
        {
            Console.Error.WriteLine("Gestopt; er is geen rapport geschreven.");
            return 1;
        }

        await File.WriteAllTextAsync(reportPath, ReportWriter.Write(report));
        Console.WriteLine();
        Console.WriteLine($"Rapport: {reportPath}");
        return 0;
    }
}
