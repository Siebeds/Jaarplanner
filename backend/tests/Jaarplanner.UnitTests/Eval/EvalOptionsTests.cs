using Jaarplanner.Eval;
using Microsoft.Extensions.Configuration;

namespace Jaarplanner.UnitTests.Eval;

/// <summary>The runner's settings: every problem at once, and sensible defaults (TB-004).</summary>
public sealed class EvalOptionsTests
{
    private static IConfiguration Config(params (string Key, string Value)[] values) =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(values.Select(v => new KeyValuePair<string, string?>(v.Key, v.Value)))
            .Build();

    [Fact]
    public void Zonder_instellingen_worden_alle_ontbrekende_sleutels_genoemd()
    {
        var fout = Assert.Throws<EvalsetFout>(() => EvalOptions.Read(Config()));

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
        var fout = Assert.Throws<EvalsetFout>(() => EvalOptions.Read(Config(
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

    /// <summary>The eval-data/ folder is ignored by git and other places in the repo are not (the public-repo guard).</summary>
    [Fact]
    public void Git_negeert_eval_data_en_verder_niets()
    {
        var root = RepoGuard.FindRepoRoot(AppContext.BaseDirectory);
        Assert.NotNull(root);

        Assert.True(RepoGuard.IsInside(root, Path.Combine(root, "eval-data", "rapport.md")));
        Assert.False(RepoGuard.IsInside(root, Path.GetTempPath()));
        Assert.Equal(true, RepoGuard.IsIgnored(root, Path.Combine(root, "eval-data", "rapport.md")));
        Assert.Equal(false, RepoGuard.IsIgnored(root, Path.Combine(root, "backend", "rapport.md")));
        Assert.True(RepoGuard.IsTracked(root, Path.Combine(root, "backend", "tools", "Jaarplanner.Eval", "voorbeeld-evalset.json")));
    }
}
