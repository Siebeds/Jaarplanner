using System.Diagnostics;
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

    /// <summary>Inside this repo: eval-data/ may be written, another folder may not, and a folder outside any repo may.</summary>
    [Fact]
    public void De_bewaking_laat_eval_data_toe_en_weigert_de_rest_van_de_repo()
    {
        var root = RepoRoot();
        var toegestaan = Path.Combine(root, "eval-data", "rapport-1.md");
        var inDeRepo = Path.Combine(root, "docs", "eval", "rapport-1.md");

        Assert.Null(RepoGuard.FirstUnsafe([toegestaan, Path.Combine(root, "eval-data", "cache", "embeddings-x.json")]));
        Assert.Equal(inDeRepo, RepoGuard.FirstUnsafe([toegestaan, inDeRepo]));
        Assert.Null(RepoGuard.FirstUnsafe([Path.Combine(Path.GetTempPath(), $"eval-{Guid.NewGuid():N}", "rapport-1.md")]));
    }

    /// <summary>
    /// The guard finds the repo from the path it checks, not from the working directory. The test host's working
    /// directory is inside the Jaarplanner repo; a second repo elsewhere is still recognised, so a runner started from
    /// outside a repo cannot write into one unnoticed. A guard that looked at the working directory fails this test.
    /// </summary>
    [Fact]
    public void De_bewaking_herkent_een_andere_repo_dan_die_van_de_werkmap()
    {
        var andereRepo = Path.Combine(Path.GetTempPath(), $"jaarplanner-guard-{Guid.NewGuid():N}");
        Directory.CreateDirectory(andereRepo);
        try
        {
            File.WriteAllText(Path.Combine(andereRepo, "global.json"), "{}");
            File.WriteAllText(Path.Combine(andereRepo, ".gitignore"), "/eval-data/\n");
            Git(andereRepo, "init", "-q");

            var zichtbaar = Path.Combine(andereRepo, "docs", "rapport-1.md");
            Assert.Equal(zichtbaar, RepoGuard.FirstUnsafe([zichtbaar]));
            Assert.Null(RepoGuard.FirstUnsafe([Path.Combine(andereRepo, "eval-data", "rapport-1.md")]));
        }
        finally
        {
            Verwijder(andereRepo);
        }
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

    private static void Git(string folder, params string[] arguments)
    {
        var start = new ProcessStartInfo("git")
        {
            WorkingDirectory = folder,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
        };
        foreach (var argument in arguments)
        {
            start.ArgumentList.Add(argument);
        }

        using var process = Process.Start(start)!;
        if (!process.WaitForExit(TimeSpan.FromSeconds(30)))
        {
            process.Kill(entireProcessTree: true);
            Assert.Fail($"git {string.Join(' ', arguments)} did not finish within 30 seconds.");
        }

        Assert.Equal(0, process.ExitCode);
    }

    // git marks some of its files read-only, which Directory.Delete refuses on Windows.
    private static void Verwijder(string folder)
    {
        if (!Directory.Exists(folder))
        {
            return;
        }

        foreach (var file in Directory.EnumerateFiles(folder, "*", SearchOption.AllDirectories))
        {
            File.SetAttributes(file, FileAttributes.Normal);
        }

        Directory.Delete(folder, recursive: true);
    }
}
