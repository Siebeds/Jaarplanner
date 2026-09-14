using System.Globalization;
using Microsoft.Extensions.Configuration;

namespace Jaarplanner.Eval;

/// <summary>
/// The runner's settings, from the command line, the environment, user-secrets and <c>appsettings.json</c>, in that
/// order of precedence. The endpoint and the connection string are not secrets but stay out of the repo anyway: they
/// name a real resource. The messages are Dutch because the owner reads them (Art. II.6, clause 1).
/// </summary>
internal sealed record EvalOptions
{
    /// <summary>Command-line switches and the configuration keys they set.</summary>
    public static readonly IDictionary<string, string> Switches = new Dictionary<string, string>
    {
        ["--evalset"] = "Eval:Evalset",
        ["--models"] = "Eval:Models",
        ["--variants"] = "Eval:Variants",
        ["--embedding"] = "Eval:Embedding",
        ["--top"] = "Eval:Top",
        ["--max"] = "Eval:Max",
        ["--goal-format"] = "Eval:GoalFormat",
        ["--reasoning"] = "Eval:Reasoning",
        ["--out"] = "Eval:Out",
    };

    public required string EvalsetPath { get; init; }

    public required string Endpoint { get; init; }

    public string? ApiKey { get; init; }

    public required string ConnectionString { get; init; }

    public required IReadOnlyList<string> Models { get; init; }

    public required bool VariantA { get; init; }

    public required bool VariantB { get; init; }

    public string? Embedding { get; init; }

    public int Top { get; init; } = 25;

    public int Max { get; init; } = 8;

    public DoelWeergave GoalFormat { get; init; } = DoelWeergave.Compact;

    public string? ReasoningEffort { get; init; }

    public string? Out { get; init; }

    /// <summary>Reads and checks the settings; every problem is reported at once.</summary>
    public static EvalOptions Read(IConfiguration config)
    {
        var problems = new List<string>();

        string Required(string key, string hint)
        {
            var value = config[key];
            if (string.IsNullOrWhiteSpace(value))
            {
                problems.Add($"'{key}' ontbreekt: {hint}");
                return string.Empty;
            }

            return value.Trim();
        }

        int Number(string key, int fallback)
        {
            var value = config[key];
            if (string.IsNullOrWhiteSpace(value))
            {
                return fallback;
            }

            if (int.TryParse(value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var number) && number > 0)
            {
                return number;
            }

            problems.Add($"'{key}' moet een positief geheel getal zijn, niet '{value}'.");
            return fallback;
        }

        var evalset = Required("Eval:Evalset", "geef het pad van de evalset met --evalset.");
        var endpoint = Required("AzureAI:Endpoint", "zet het endpoint van de Foundry-resource (user-secrets).");
        var connectionString = Required("ConnectionStrings:Postgres", "zet de databank met de Op.stap-catalogus (user-secrets).");

        var models = List(config["Eval:Models"]);
        if (models.Count == 0)
        {
            problems.Add("'Eval:Models' ontbreekt: geef de chatdeployments met --models, gescheiden door komma's.");
        }

        var variants = List(config["Eval:Variants"] ?? "A,B").Select(v => v.ToUpperInvariant()).ToList();
        var unknown = variants.Where(v => v is not ("A" or "B")).ToList();
        if (unknown.Count > 0 || variants.Count == 0)
        {
            problems.Add($"'Eval:Variants' kent alleen A en B, niet '{string.Join(",", unknown)}'.");
        }

        var embedding = config["Eval:Embedding"]?.Trim();
        if (variants.Contains("B") && string.IsNullOrWhiteSpace(embedding))
        {
            problems.Add("'Eval:Embedding' ontbreekt: variant B heeft een embeddingdeployment nodig (--embedding).");
        }

        var goalFormat = DoelWeergave.Compact;
        switch (config["Eval:GoalFormat"]?.Trim().ToLowerInvariant())
        {
            case null or "" or "compact":
                break;
            case "full":
                goalFormat = DoelWeergave.Volledig;
                break;
            default:
                problems.Add($"'Eval:GoalFormat' is 'compact' of 'full', niet '{config["Eval:GoalFormat"]}'.");
                break;
        }

        var top = Number("Eval:Top", 25);
        var max = Number("Eval:Max", 8);

        if (problems.Count > 0)
        {
            throw new EvalException(string.Join(Environment.NewLine, problems));
        }

        return new EvalOptions
        {
            EvalsetPath = evalset,
            Endpoint = endpoint,
            ApiKey = Optional(config["AzureAI:ApiKey"]),
            ConnectionString = connectionString,
            Models = models,
            VariantA = variants.Contains("A"),
            VariantB = variants.Contains("B"),
            Embedding = embedding,
            Top = top,
            Max = max,
            GoalFormat = goalFormat,
            ReasoningEffort = Optional(config["Eval:Reasoning"]),
            Out = Optional(config["Eval:Out"]),
        };
    }

    /// <summary>The price list from the <c>Prices</c> section, by deployment name.</summary>
    public static IReadOnlyDictionary<string, ModelPrice> ReadPrices(IConfiguration config) =>
        config.GetSection("Prices").GetChildren()
            .ToDictionary(section => section.Key, section => section.Get<ModelPrice>() ?? new ModelPrice(), StringComparer.Ordinal);

    private static string? Optional(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static List<string> List(string? value) =>
        (value ?? string.Empty)
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Distinct(StringComparer.Ordinal)
            .ToList();
}
