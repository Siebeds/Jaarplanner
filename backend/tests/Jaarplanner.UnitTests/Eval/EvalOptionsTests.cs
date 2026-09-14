using Jaarplanner.Eval;
using Microsoft.Extensions.Configuration;

namespace Jaarplanner.UnitTests.Eval;

/// <summary>The runner's settings and its public-repo guard (TB-004).</summary>
public sealed class EvalOptionsTests
{
    private static IConfiguration Config(params (string Key, string Value)[] values) =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(values.Select(v => new KeyValuePair<string, string?>(v.Key, v.Value)))
            .Build();

    private static string RepoRoot() =>
        RepoGuard.FindRepoRoot(AppContext.BaseDirectory) ?? throw new InvalidOperationException("No repo root.");

    [Fact]
    public void Zonder_instellingen_worden_alle_ontbrekende_sleutels_genoemd()
    {
        var fout = Assert.Throws<EvalException>(() => EvalOptions.Read(Config()));

        Assert.Contains("Eval:Evalset", fout.Message);
        Assert.Contains("AzureAI:Endpoint", fout.Message);
        Assert.Contains("ConnectionStrings:Postgres", fout.Message);
        Assert.Contains("Eval:Models", fout.Message);
        Assert.Contains("Eval:Embedding", fout.Message);
    }

    [Fact]
    public void Een_volledige_configuratie_wordt_gelezen_met_standaardwaarden()
    {
        var options = EvalOptions.Read(Config(
            ("Eval:Evalset", "set.json"),
            ("AzureAI:Endpoint", "https://voorbeeld.openai.azure.com/"),
            ("ConnectionStrings:Postgres", "Host=localhost"),
            ("Eval:Models", "gpt-5.4-mini, gpt-5-mini"),
            ("Eval:Embedding", "text-embedding-3-small")));

        Assert.Equal(["gpt-5.4-mini", "gpt-5-mini"], options.Models);
        Assert.True(options.VariantA);
        Assert.True(options.VariantB);
        Assert.Equal(25, options.Top);
        Assert.Equal(8, options.Max);
        Assert.Equal(DoelWeergave.Compact, options.GoalFormat);
        Assert.Null(options.ApiKey);
    }

    [Fact]
    public void Alleen_variant_a_heeft_geen_embedding_nodig()
    {
        var options = EvalOptions.Read(Config(
            ("Eval:Evalset", "set.json"),
            ("AzureAI:Endpoint", "https://voorbeeld.openai.azure.com/"),
            ("ConnectionStrings:Postgres", "Host=localhost"),
            ("Eval:Models", "gpt-5-mini"),
            ("Eval:Variants", "a"),
            ("Eval:GoalFormat", "Full")));

        Assert.True(options.VariantA);
        Assert.False(options.VariantB);
        Assert.Equal(DoelWeergave.Volledig, options.GoalFormat);
    }

    [Theory]
    [InlineData("Eval:Variants", "C")]
    [InlineData("Eval:Top", "nul")]
    [InlineData("Eval:Max", "0")]
    [InlineData("Eval:GoalFormat", "kort")]
    public void Een_ongeldige_waarde_wordt_genoemd(string key, string value)
    {
        var fout = Assert.Throws<EvalException>(() => EvalOptions.Read(Config(
            ("Eval:Evalset", "set.json"),
            ("AzureAI:Endpoint", "https://voorbeeld.openai.azure.com/"),
            ("ConnectionStrings:Postgres", "Host=localhost"),
            ("Eval:Models", "gpt-5-mini"),
            ("Eval:Embedding", "text-embedding-3-small"),
            (key, value))));

        Assert.Contains(key, fout.Message);
    }

    [Fact]
    public void De_prijslijst_wordt_per_deployment_gelezen()
    {
        var prices = EvalOptions.ReadPrices(Config(
            ("Prices:gpt-5-mini:Input", "0.25"),
            ("Prices:gpt-5-mini:Output", "2")));

        Assert.Equal(0.25m, prices["gpt-5-mini"].Input);
        Assert.Equal(2m, prices["gpt-5-mini"].Output);
        Assert.Null(prices["gpt-5-mini"].CachedInput);
    }

    /// <summary>The eval-data/ folder is ignored by git and other places in the repo are not.</summary>
    [Fact]
    public void Git_negeert_eval_data_en_verder_niets()
    {
        var root = RepoRoot();

        Assert.True(RepoGuard.IsInside(root, Path.Combine(root, "eval-data", "rapport.md")));
        Assert.False(RepoGuard.IsInside(root, Path.GetTempPath()));
        Assert.Equal(true, RepoGuard.IsIgnored(root, Path.Combine(root, "eval-data", "rapport.md")));
        Assert.Equal(false, RepoGuard.IsIgnored(root, Path.Combine(root, "backend", "rapport.md")));
        Assert.True(RepoGuard.IsTracked(root, Path.Combine(root, "backend", "tools", "Jaarplanner.Eval", "voorbeeld-evalset.json")));
    }

    /// <summary>
    /// The guard finds the repo from the path it checks, never from the working directory, so a runner started outside
    /// the repo with an output folder inside it is still refused (the paths here are absolute, as they are then).
    /// </summary>
    [Fact]
    public void De_bewaking_zoekt_de_repo_vanuit_het_pad()
    {
        var root = RepoRoot();
        var toegestaan = Path.Combine(root, "eval-data", "rapport-1.md");
        var inDeRepo = Path.Combine(root, "docs", "eval", "rapport-1.md");

        Assert.Null(RepoGuard.FirstUnsafe([toegestaan, Path.Combine(root, "eval-data", "cache", "embeddings.json")]));
        Assert.Equal(inDeRepo, RepoGuard.FirstUnsafe([toegestaan, inDeRepo]));
        Assert.Null(RepoGuard.FirstUnsafe([Path.Combine(Path.GetTempPath(), $"eval-{Guid.NewGuid():N}", "rapport-1.md")]));
    }

    /// <summary>A real evalset where git would pick it up stands out; the tracked example and eval-data/ do not.</summary>
    [Fact]
    public void Een_evalset_op_een_zichtbare_plek_valt_op()
    {
        var root = RepoRoot();

        Assert.True(RepoGuard.IsExposed(Path.Combine(root, "backend", "echte-set.json")));
        Assert.False(RepoGuard.IsExposed(Path.Combine(root, "eval-data", "echte-set.json")));
        Assert.False(RepoGuard.IsExposed(Path.Combine(root, "backend", "tools", "Jaarplanner.Eval", "voorbeeld-evalset.json")));
    }
}
