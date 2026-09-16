using System.Net;
using System.Text;
using System.Text.Json;
using Jaarplanner.Application.Ai;
using Jaarplanner.Infrastructure;
using Jaarplanner.Infrastructure.Ai;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace Jaarplanner.UnitTests.Ai;

/// <summary>
/// Exercises the real <see cref="AnthropicClaudeClient"/> (TB-041) offline: a stub <see cref="HttpMessageHandler"/>
/// under the SDK stands in for the Claude API, so the endpoint, the key header, the request body, the text extraction,
/// the usage, the refusal and the configuration guard all run with no network. Also covers the <c>Ai:Provider</c>
/// choice in <see cref="DependencyInjection.AddInfrastructure"/>.
/// </summary>
public sealed class AnthropicClaudeClientTests
{
    private const string ApiKey = "test-key-not-a-real-secret";
    private const string Model = "claude-opus-5";

    private static AnthropicOptions Opties(
        string? endpoint = null,
        string? apiKey = ApiKey,
        string? model = Model,
        int maxTokens = 16000,
        string? effort = null) =>
        new() { Endpoint = endpoint, ApiKey = apiKey, Model = model, MaxTokens = maxTokens, Effort = effort };

    private static AiRequest EenRequest() =>
        new() { SystemPrompt = "systeeminstructies", UserPrompt = "de schoolcontent" };

    /// <summary>A Messages API success envelope with the given content blocks.</summary>
    private static string Envelop(
        object[] content,
        string stopReason = "end_turn",
        int input = 12,
        int output = 34,
        int? cacheRead = null,
        int? cacheCreation = null) =>
        JsonSerializer.Serialize(new
        {
            id = "msg_test",
            type = "message",
            role = "assistant",
            model = Model,
            content,
            stop_reason = stopReason,
            stop_sequence = (string?)null,
            usage = new
            {
                input_tokens = input,
                output_tokens = output,
                cache_read_input_tokens = cacheRead,
                cache_creation_input_tokens = cacheCreation,
            },
        });

    private static object Tekst(string text) => new { type = "text", text };

    private static AnthropicClaudeClient Client(StubHandler handler, AnthropicOptions? opties = null) =>
        new(new HttpClient(handler), Options.Create(opties ?? Opties()));

    [Fact]
    public async Task De_aanroep_gaat_naar_de_messages_api_met_beide_prompts_en_de_sleutel()
    {
        var handler = new StubHandler(Envelop([Tekst("""{"plaatsingen":[]}""")]));

        var antwoord = await Client(handler).CompleteAsync(EenRequest());

        Assert.Equal("""{"plaatsingen":[]}""", antwoord.Content);
        var request = handler.LaatsteRequest!;
        Assert.Equal(HttpMethod.Post, request.Method);
        Assert.Equal("https://api.anthropic.com/v1/messages", request.RequestUri!.ToString());
        Assert.Equal(ApiKey, Assert.Single(request.Headers.GetValues("x-api-key")));
        Assert.False(request.Headers.Contains("Authorization"));

        using var body = JsonDocument.Parse(handler.LaatsteBody!);
        var root = body.RootElement;
        Assert.Equal(Model, root.GetProperty("model").GetString());
        Assert.Equal(16000, root.GetProperty("max_tokens").GetInt32());
        Assert.Equal("systeeminstructies", root.GetProperty("system").GetString());
        var bericht = Assert.Single(root.GetProperty("messages").EnumerateArray());
        Assert.Equal("user", bericht.GetProperty("role").GetString());
        Assert.Equal("de schoolcontent", bericht.GetProperty("content").GetString());
        Assert.False(root.TryGetProperty("output_config", out _));
    }

    /// <summary>A token or address in the environment never travels: only the configured key and endpoint count.</summary>
    [Fact]
    public async Task Omgevingsvariabelen_van_de_sdk_worden_genegeerd()
    {
        var vorigToken = Environment.GetEnvironmentVariable("ANTHROPIC_AUTH_TOKEN");
        var vorigAdres = Environment.GetEnvironmentVariable("ANTHROPIC_BASE_URL");
        Environment.SetEnvironmentVariable("ANTHROPIC_AUTH_TOKEN", "omgevingstoken");
        Environment.SetEnvironmentVariable("ANTHROPIC_BASE_URL", "https://verkeerd.example.test");
        try
        {
            var handler = new StubHandler(Envelop([Tekst("{}")]));

            await Client(handler).CompleteAsync(EenRequest());

            Assert.False(handler.LaatsteRequest!.Headers.Contains("Authorization"));
            Assert.Equal("https://api.anthropic.com/v1/messages", handler.LaatsteRequest.RequestUri!.ToString());
        }
        finally
        {
            Environment.SetEnvironmentVariable("ANTHROPIC_AUTH_TOKEN", vorigToken);
            Environment.SetEnvironmentVariable("ANTHROPIC_BASE_URL", vorigAdres);
        }
    }

    [Theory]
    [InlineData("https://gateway.example.test", "https://gateway.example.test/v1/messages")]
    [InlineData("https://gateway.example.test/", "https://gateway.example.test/v1/messages")]
    public async Task Een_ingesteld_endpoint_vervangt_het_standaardadres(string endpoint, string verwacht)
    {
        var handler = new StubHandler(Envelop([Tekst("{}")]));

        await Client(handler, Opties(endpoint: endpoint)).CompleteAsync(EenRequest());

        Assert.Equal(verwacht, handler.LaatsteRequest!.RequestUri!.ToString());
    }

    [Fact]
    public async Task Een_ingestelde_effort_gaat_mee_in_output_config()
    {
        var handler = new StubHandler(Envelop([Tekst("{}")]));

        await Client(handler, Opties(effort: " Medium ", maxTokens: 4000)).CompleteAsync(EenRequest());

        using var body = JsonDocument.Parse(handler.LaatsteBody!);
        Assert.Equal("medium", body.RootElement.GetProperty("output_config").GetProperty("effort").GetString());
        Assert.Equal(4000, body.RootElement.GetProperty("max_tokens").GetInt32());
    }

    [Fact]
    public async Task Alleen_de_tekstblokken_vormen_het_antwoord()
    {
        var handler = new StubHandler(Envelop(
        [
            new { type = "thinking", thinking = "", signature = "sig" },
            Tekst("{\"a\":"),
            Tekst("1}"),
        ]));

        var antwoord = await Client(handler).CompleteAsync(EenRequest());

        Assert.Equal("{\"a\":1}", antwoord.Content);
    }

    [Fact]
    public async Task Het_tokenverbruik_komt_in_usage()
    {
        var handler = new StubHandler(Envelop([Tekst("{}")], input: 100, output: 50, cacheRead: 30, cacheCreation: 20));

        var antwoord = await Client(handler).CompleteAsync(EenRequest());

        Assert.Equal(
            new AiUsage { InputTokens = 150, CachedInputTokens = 30, OutputTokens = 50, ReasoningTokens = 0 },
            antwoord.Usage);
    }

    [Fact]
    public async Task Een_weigering_van_het_model_wordt_een_fout_zonder_inhoud()
    {
        var handler = new StubHandler(Envelop([Tekst("geheime inhoud")], stopReason: "refusal"));

        var fout = await Assert.ThrowsAsync<InvalidOperationException>(
            () => Client(handler).CompleteAsync(EenRequest()));

        Assert.DoesNotContain("geheime inhoud", fout.Message, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Een_foutstatus_van_de_api_wordt_een_uitzondering()
    {
        var handler = new StubHandler(
            """{"type":"error","error":{"type":"invalid_request_error","message":"nope"}}""",
            HttpStatusCode.BadRequest);

        await Assert.ThrowsAnyAsync<Exception>(() => Client(handler).CompleteAsync(EenRequest()));
    }

    [Theory]
    [InlineData(null, Model, 16000, null)]
    [InlineData("  ", Model, 16000, null)]
    [InlineData(ApiKey, null, 16000, null)]
    [InlineData(ApiKey, " ", 16000, null)]
    [InlineData(ApiKey, Model, 0, null)]
    [InlineData(ApiKey, Model, 16000, "extreem")]
    public async Task Onvolledige_configuratie_faalt_luid_en_verstuurt_niets(
        string? apiKey, string? model, int maxTokens, string? effort)
    {
        var handler = new StubHandler(Envelop([Tekst("{}")]));

        var fout = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            Client(handler, Opties(apiKey: apiKey, model: model, maxTokens: maxTokens, effort: effort))
                .CompleteAsync(EenRequest()));

        Assert.Contains("Anthropic:", fout.Message, StringComparison.Ordinal);
        Assert.DoesNotContain(ApiKey, fout.Message, StringComparison.Ordinal);
        Assert.Equal(0, handler.AantalAanroepen);
    }

    [Theory]
    [InlineData(null, typeof(AzureAiFoundryClient))]
    [InlineData("", typeof(AzureAiFoundryClient))]
    [InlineData("AzureAI", typeof(AzureAiFoundryClient))]
    [InlineData("anthropic", typeof(AnthropicClaudeClient))]
    [InlineData("Anthropic", typeof(AnthropicClaudeClient))]
    public void De_provider_volgt_ai_provider(string? provider, Type verwacht)
    {
        using var services = Bouw(provider);

        Assert.IsType(verwacht, services.GetRequiredService<IAiClient>());
    }

    [Fact]
    public void Een_onbekende_provider_stopt_de_registratie()
    {
        var fout = Assert.Throws<InvalidOperationException>(() => Bouw("OpenAI"));

        Assert.Contains("Ai:Provider", fout.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void De_claude_client_krijgt_een_ruimere_timeout_dan_de_standaard()
    {
        using var services = Bouw("Anthropic");

        var client = services.GetRequiredService<IHttpClientFactory>().CreateClient(nameof(IAiClient));

        Assert.Equal(TimeSpan.FromMinutes(10), client.Timeout);
    }

    private static ServiceProvider Bouw(string? provider)
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                [AiProvider.ConfigKey] = provider,
                ["ConnectionStrings:Jaarplanner"] = "Host=localhost;Database=niet-gebruikt",
            })
            .Build();
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddInfrastructure(configuration);
        return services.BuildServiceProvider();
    }

    private sealed class StubHandler(string antwoord, HttpStatusCode status = HttpStatusCode.OK) : HttpMessageHandler
    {
        public HttpRequestMessage? LaatsteRequest { get; private set; }

        public string? LaatsteBody { get; private set; }

        public int AantalAanroepen { get; private set; }

        protected override async Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            AantalAanroepen++;
            LaatsteRequest = request;
            LaatsteBody = request.Content is null
                ? null
                : await request.Content.ReadAsStringAsync(cancellationToken);

            return new HttpResponseMessage(status)
            {
                Content = new StringContent(antwoord, Encoding.UTF8, "application/json"),
            };
        }
    }
}
