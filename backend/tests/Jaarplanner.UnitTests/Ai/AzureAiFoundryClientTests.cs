using System.Net;
using System.Text;
using System.Text.Json;
using Azure.Core;
using Jaarplanner.Application.Ai;
using Jaarplanner.Application.Planning;
using Jaarplanner.Application.Planning.Generatie;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.Infrastructure.Ai;
using Jaarplanner.Infrastructure.Planning;
using Jaarplanner.UnitTests.Planning;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace Jaarplanner.UnitTests.Ai;

/// <summary>
/// Exercises the <b>real</b> <see cref="AzureAiFoundryClient"/> — the one every other test in this repo replaces
/// with a fake. Before this file it appeared repo-wide only in its own definition and one DI registration, so its
/// URI construction, its <c>api-key</c> header, its <c>response_format</c>, its <c>EnsureSuccessStatusCode</c>, its
/// <c>choices[0].message.content</c> extraction and its <c>EnsureConfigured</c> guard had never executed once — not
/// in E2-01, not in E3-01.
/// <para>
/// <b>No endpoint, no key, no network.</b> The client is a typed <c>HttpClient</c> taking
/// <c>(HttpClient, IOptions&lt;AzureAIOptions&gt;)</c>, so a stub <see cref="HttpMessageHandler"/> plus dummy options
/// drives all of it offline, and an Entra credential is replaced by a <see cref="FakeCredential"/>. Only a genuine live
/// round-trip against Azure AI Foundry stays out of scope.
/// </para>
/// </summary>
public sealed class AzureAiFoundryClientTests
{
    private const string Endpoint = "https://jaarplanner-test.openai.azure.com/";
    private const string Deployment = "gpt-5-mini-jaarplan";
    private const string ApiKey = "test-key-not-a-real-secret";

    private static AzureAIOptions Opties(
        string? endpoint = Endpoint,
        string? apiKey = ApiKey,
        string? deployment = Deployment,
        AzureAIAuthentication authentication = AzureAIAuthentication.Key,
        string? reasoningEffort = null,
        int? maxCompletionTokens = null) =>
        new()
        {
            Endpoint = endpoint,
            ApiKey = apiKey,
            Deployment = deployment,
            Authentication = authentication,
            ReasoningEffort = reasoningEffort,
            MaxCompletionTokens = maxCompletionTokens,
        };

    private static AiRequest EenRequest() =>
        new() { SystemPrompt = "systeeminstructies", UserPrompt = "de schoolcontent" };

    /// <summary>An Azure OpenAI chat-completions success envelope wrapping <paramref name="content"/>.</summary>
    private static string AzureEnvelop(string content) =>
        JsonSerializer.Serialize(new
        {
            id = "chatcmpl-test",
            choices = new[]
            {
                new { index = 0, finish_reason = "stop", message = new { role = "assistant", content } },
            },
        });

    /// <summary>
    /// The outbound request is exactly what the Azure OpenAI v1 chat-completions API expects (ADR-0036): the
    /// version-less <c>/openai/v1/chat/completions</c> route with the deployment as <c>model</c>, the server-side key on
    /// the <c>api-key</c> header (Art. VI.4 — never in a query string, never exposed to the frontend), both prompt
    /// roles, and <c>response_format: json_object</c> so the model is *asked* for structured JSON (Art. IV.5).
    /// </summary>
    [Fact]
    public async Task De_uitgaande_aanroep_is_een_azure_chat_completion_met_json_response_format()
    {
        var handler = new StubHandler(AzureEnvelop("""{"plaatsingen":[]}"""));
        var client = new AzureAiFoundryClient(new HttpClient(handler), Options.Create(Opties()));

        await client.CompleteAsync(EenRequest());

        var verzonden = handler.LaatsteRequest!;
        Assert.Equal(HttpMethod.Post, verzonden.Method);

        // Note the endpoint's trailing slash is trimmed — a double slash is not a cosmetic issue on this API.
        Assert.Equal(
            "https://jaarplanner-test.openai.azure.com/openai/v1/chat/completions",
            verzonden.RequestUri!.ToString());

        // The key travels as a header, once, and only here.
        Assert.Equal([ApiKey], verzonden.Headers.GetValues("api-key"));
        Assert.Null(verzonden.Headers.Authorization);
        Assert.DoesNotContain(ApiKey, verzonden.RequestUri.ToString(), StringComparison.Ordinal);

        using var payload = JsonDocument.Parse(handler.LaatsteBody!);
        var root = payload.RootElement;

        Assert.Equal(Deployment, root.GetProperty("model").GetString());
        Assert.Equal("json_object", root.GetProperty("response_format").GetProperty("type").GetString());

        var messages = root.GetProperty("messages");
        Assert.Equal(2, messages.GetArrayLength());
        Assert.Equal("system", messages[0].GetProperty("role").GetString());
        Assert.Equal("systeeminstructies", messages[0].GetProperty("content").GetString());
        Assert.Equal("user", messages[1].GetProperty("role").GetString());
        Assert.Equal("de schoolcontent", messages[1].GetProperty("content").GetString());

        // Parameters that are not configured are not sent: a model that does not know them must never see them.
        Assert.False(root.TryGetProperty("reasoning_effort", out _));
        Assert.False(root.TryGetProperty("max_completion_tokens", out _));
    }

    /// <summary>
    /// Entra is an explicit choice (ADR-0036): a bearer token for the Cognitive Services scope, and no <c>api-key</c>
    /// header, even when a key is configured too.
    /// </summary>
    [Fact]
    public async Task Met_entra_gekozen_meldt_de_client_zich_aan_met_een_token()
    {
        var handler = new StubHandler(AzureEnvelop("{}"));
        var credential = new FakeCredential("entra-token");
        var client = new AzureAiFoundryClient(
            new HttpClient(handler),
            Options.Create(Opties(authentication: AzureAIAuthentication.Entra)),
            new EntraTokenProvider(credential));

        await client.CompleteAsync(EenRequest());

        var verzonden = handler.LaatsteRequest!;
        Assert.Equal("Bearer", verzonden.Headers.Authorization!.Scheme);
        Assert.Equal("entra-token", verzonden.Headers.Authorization.Parameter);
        Assert.False(verzonden.Headers.Contains("api-key"));
        Assert.Equal([EntraTokenProvider.Scope], credential.GevraagdeScopes);
    }

    /// <summary>Entra needs no key at all.</summary>
    [Fact]
    public async Task Met_entra_is_geen_sleutel_nodig()
    {
        var handler = new StubHandler(AzureEnvelop("{}"));
        var client = new AzureAiFoundryClient(
            new HttpClient(handler),
            Options.Create(Opties(apiKey: null, authentication: AzureAIAuthentication.Entra)),
            new EntraTokenProvider(new FakeCredential("entra-token")));

        await client.CompleteAsync(EenRequest());

        Assert.Equal(1, handler.AantalAanroepen);
    }

    /// <summary>With the default, the key, Entra is never asked, so a key-based host needs no identity.</summary>
    [Fact]
    public async Task Met_de_sleutel_wordt_entra_niet_gevraagd()
    {
        var credential = new FakeCredential("ongebruikt");
        var client = new AzureAiFoundryClient(
            new HttpClient(new StubHandler(AzureEnvelop("{}"))),
            Options.Create(Opties()),
            new EntraTokenProvider(credential));

        await client.CompleteAsync(EenRequest());

        Assert.Equal(0, credential.AantalAanroepen);
    }

    /// <summary>
    /// A token is reused until five minutes before it expires, then renewed: a credential such as the Azure CLI's
    /// would otherwise start a process on every call.
    /// </summary>
    [Fact]
    public async Task Het_token_wordt_hergebruikt_tot_kort_voor_het_verloopt()
    {
        var tijd = new VasteTijd(new DateTimeOffset(2026, 9, 14, 12, 0, 0, TimeSpan.Zero));
        var credential = new FakeCredential("token", geldig: TimeSpan.FromHours(1), tijd);
        var provider = new EntraTokenProvider(credential, tijd);

        await provider.GetTokenAsync();
        tijd.Nu = tijd.Nu.AddMinutes(54);
        await provider.GetTokenAsync();
        Assert.Equal(1, credential.AantalAanroepen);

        tijd.Nu = tijd.Nu.AddMinutes(2);
        await provider.GetTokenAsync();
        Assert.Equal(2, credential.AantalAanroepen);
    }

    /// <summary>DI still builds the client through the key constructor, with no token provider registered.</summary>
    [Fact]
    public void De_di_registratie_bouwt_de_client_zonder_tokenprovider()
    {
        var services = new ServiceCollection();
        services.Configure<AzureAIOptions>(_ => { });
        services.AddHttpClient<IAiClient, AzureAiFoundryClient>();

        using var provider = services.BuildServiceProvider();

        Assert.IsType<AzureAiFoundryClient>(provider.GetRequiredService<IAiClient>());
    }

    /// <summary>The reasoning settings travel only when configured, under the names the gpt-5 family expects.</summary>
    [Fact]
    public async Task Ingestelde_reasoning_parameters_gaan_mee()
    {
        var handler = new StubHandler(AzureEnvelop("{}"));
        var client = new AzureAiFoundryClient(
            new HttpClient(handler),
            Options.Create(Opties(reasoningEffort: " minimal ", maxCompletionTokens: 2000)));

        await client.CompleteAsync(EenRequest());

        using var payload = JsonDocument.Parse(handler.LaatsteBody!);
        Assert.Equal("minimal", payload.RootElement.GetProperty("reasoning_effort").GetString());
        Assert.Equal(2000, payload.RootElement.GetProperty("max_completion_tokens").GetInt32());
    }

    /// <summary>The token usage the provider reports comes back on the completion, cached and reasoning tokens included.</summary>
    [Fact]
    public async Task Het_tokenverbruik_komt_mee_terug()
    {
        var handler = new StubHandler(
            """
            {"choices":[{"index":0,"message":{"role":"assistant","content":"{}"}}],
             "usage":{"prompt_tokens":1200,"completion_tokens":300,
                      "prompt_tokens_details":{"cached_tokens":1024},
                      "completion_tokens_details":{"reasoning_tokens":200}}}
            """);
        var client = new AzureAiFoundryClient(new HttpClient(handler), Options.Create(Opties()));

        var completion = await client.CompleteAsync(EenRequest());

        Assert.Equal(
            new AiUsage { InputTokens = 1200, CachedInputTokens = 1024, OutputTokens = 300, ReasoningTokens = 200 },
            completion.Usage);
    }

    /// <summary>Without a <c>usage</c> block the completion simply has none; its content still arrives.</summary>
    [Fact]
    public async Task Zonder_usage_is_het_verbruik_null()
    {
        var client = new AzureAiFoundryClient(
            new HttpClient(new StubHandler(AzureEnvelop("{}"))), Options.Create(Opties()));

        var completion = await client.CompleteAsync(EenRequest());

        Assert.Null(completion.Usage);
        Assert.Equal("{}", completion.Content);
    }

    /// <summary>
    /// The client returns the assistant message <b>verbatim</b> and parses nothing: validation against the
    /// structured-JSON contract is a separate concern (E2-03 / E3-01), and a client that pre-chewed the text would
    /// move the trust boundary into Infrastructure.
    /// </summary>
    [Fact]
    public async Task De_ruwe_assistant_inhoud_komt_onveranderd_terug()
    {
        const string ruw = """{"plaatsingen":[{"blokStart":"2026-09-01","thema":"Herfst","motivatie":"seizoen"}]}""";
        var handler = new StubHandler(AzureEnvelop(ruw));
        var client = new AzureAiFoundryClient(new HttpClient(handler), Options.Create(Opties()));

        var completion = await client.CompleteAsync(EenRequest());

        Assert.Equal(ruw, completion.Content);
    }

    /// <summary>
    /// TB-043: the stable context follows the system prompt in the system message, after a blank line, so every request
    /// of the same kind starts with the same bytes and the service's automatic prompt cache can match them.
    /// </summary>
    [Fact]
    public async Task De_vaste_context_volgt_de_systeemprompt_in_het_systeembericht()
    {
        var handler = new StubHandler(AzureEnvelop("{}"));
        var client = new AzureAiFoundryClient(new HttpClient(handler), Options.Create(Opties()));

        await client.CompleteAsync(EenRequest() with { VasteContext = "# Beschikbare doelen" });

        using var payload = JsonDocument.Parse(handler.LaatsteBody!);
        var messages = payload.RootElement.GetProperty("messages");
        Assert.Equal(2, messages.GetArrayLength());
        Assert.Equal("systeeminstructies\n\n# Beschikbare doelen", messages[0].GetProperty("content").GetString());
        Assert.Equal("de schoolcontent", messages[1].GetProperty("content").GetString());
    }

    /// <summary>TB-043: an answer cut off at <c>max_completion_tokens</c> is incomplete, so it never reaches a parser.</summary>
    [Fact]
    public async Task Een_antwoord_dat_op_de_lengtegrens_stopt_wordt_een_afgekapt_fout()
    {
        var handler = new StubHandler(
            """{"choices":[{"index":0,"finish_reason":"length","message":{"role":"assistant","content":"{\"suggesties\":["}}]}""");
        var client = new AzureAiFoundryClient(new HttpClient(handler), Options.Create(Opties(maxCompletionTokens: 10)));

        var fout = await Assert.ThrowsAsync<AiAntwoordAfgekaptFout>(() => client.CompleteAsync(EenRequest()));

        Assert.Equal(AiAntwoordAfgekaptFout.Melding, fout.Message);
    }

    /// <summary>A <c>null</c> assistant content is normalised to an empty string, which the parser then rejects.</summary>
    [Fact]
    public async Task Een_lege_assistant_inhoud_wordt_een_lege_string()
    {
        var handler = new StubHandler(
            """{"choices":[{"index":0,"message":{"role":"assistant","content":null}}]}""");
        var client = new AzureAiFoundryClient(new HttpClient(handler), Options.Create(Opties()));

        var completion = await client.CompleteAsync(EenRequest());

        Assert.Equal(string.Empty, completion.Content);
        Assert.False(Application.Planning.Generatie.Response.JaarplanGeneratieResponseParser
            .Parse(completion).IsGeldig);
    }

    /// <summary>
    /// <b>The full offline seam of the story's "real AI client" criterion.</b> A grounded prompt from the real prompt
    /// builder goes through the real client, and a canned Azure envelope comes back through the real parser as a valid
    /// placement. The generation service that stored it is switched off (ADR-0049 decision 9); the pieces it will be
    /// rebuilt from stay covered here.
    /// </summary>
    [Fact]
    public async Task Een_azure_antwoord_levert_via_de_echte_client_een_geldige_plaatsing()
    {
        var schooljaar = TestSchooljaar.MetVakanties();
        var klas = schooljaar.VoegKlasToe("L3 — derde leerjaar", "L3");
        var thema = new Thema("Herfst", duurWeken: 5, invalshoeken: "natuur");

        IPlanningsblokIndeling indeling =
            new GeconfigureerdePlanningsblokIndeling(new PlanningsblokOptions());
        var blok = indeling.Blokken(schooljaar, Planningsblokniveau.Themaperiode)[0];

        var handler = new StubHandler(AzureEnvelop(
            $"{{\"plaatsingen\":[{{\"blokStart\":\"{blok.Start:yyyy-MM-dd}\",\"thema\":\"Herfst\"," +
            "\"motivatie\":\"seizoen past bij het begin van het schooljaar\"}]}"));

        // The REAL client, not a fake.
        IAiClient echteClient = new AzureAiFoundryClient(new HttpClient(handler), Options.Create(Opties()));
        var request = JaarplanGeneratiePromptBuilder.Bouw(
            klas, schooljaar, indeling.Blokken(schooljaar, Planningsblokniveau.Themaperiode), [thema]);

        var completion = await echteClient.CompleteAsync(request);
        var parse = Application.Planning.Generatie.Response.JaarplanGeneratieResponseParser.Parse(completion);

        Assert.True(parse.IsGeldig);
        var plaatsing = Assert.Single(parse.Plaatsingen);
        Assert.Equal("Herfst", plaatsing.ThemaNaam);
        Assert.Equal("seizoen past bij het begin van het schooljaar", plaatsing.Motivatie);
        Assert.Equal(blok.Start, plaatsing.BlokStart);

        // The grounded prompt actually travelled over the wire the client built.
        Assert.Contains("Thema: Herfst", handler.LaatsteBody);
        Assert.Contains($"startdatum {blok.Start:yyyy-MM-dd}", handler.LaatsteBody);
    }

    /// <summary>
    /// A non-2xx from Azure throws rather than silently yielding an empty completion — an empty completion would be
    /// indistinguishable from "the model proposed nothing", and a throttled or misconfigured deployment would then
    /// read as a legitimately empty plan.
    /// </summary>
    [Theory]
    [InlineData(HttpStatusCode.Unauthorized)]
    [InlineData(HttpStatusCode.TooManyRequests)]
    [InlineData(HttpStatusCode.InternalServerError)]
    public async Task Een_niet_geslaagde_azure_respons_gooit(HttpStatusCode status)
    {
        var handler = new StubHandler("""{"error":{"code":"nope"}}""", status);
        var client = new AzureAiFoundryClient(new HttpClient(handler), Options.Create(Opties()));

        await Assert.ThrowsAsync<HttpRequestException>(() => client.CompleteAsync(EenRequest()));
    }

    /// <summary>
    /// Missing configuration fails loudly on <b>first use</b> and never reaches the network — deliberately not at
    /// startup, so a dev/test host that never calls AI keeps running with no AI config at all. A missing key is
    /// missing configuration: it never turns into an Entra sign-in (ADR-0036).
    /// </summary>
    [Theory]
    [InlineData(null, ApiKey, Deployment)]
    [InlineData(Endpoint, null, Deployment)]
    [InlineData(Endpoint, ApiKey, null)]
    [InlineData("   ", ApiKey, Deployment)]
    [InlineData(Endpoint, "   ", Deployment)]
    public async Task Ontbrekende_configuratie_gooit_voor_er_iets_verstuurd_wordt(
        string? endpoint,
        string? apiKey,
        string? deployment)
    {
        var handler = new StubHandler(AzureEnvelop("{}"));
        var credential = new FakeCredential("ongebruikt");
        var client = new AzureAiFoundryClient(
            new HttpClient(handler),
            Options.Create(Opties(endpoint, apiKey, deployment)),
            new EntraTokenProvider(credential));

        var fout = await Assert.ThrowsAsync<InvalidOperationException>(() => client.CompleteAsync(EenRequest()));

        // The message names the config keys a deployer must set, and never echoes the key itself.
        Assert.Contains("AzureAI:Endpoint", fout.Message);
        Assert.Contains("AzureAI:ApiKey", fout.Message);
        Assert.DoesNotContain(ApiKey, fout.Message, StringComparison.Ordinal);

        // Nothing left the process, and no token was requested.
        Assert.Equal(0, handler.AantalAanroepen);
        Assert.Equal(0, credential.AantalAanroepen);
    }

    /// <summary>With Entra chosen, an endpoint and a deployment are still required.</summary>
    [Fact]
    public async Task Ook_met_entra_zijn_endpoint_en_deployment_verplicht()
    {
        var handler = new StubHandler(AzureEnvelop("{}"));
        var client = new AzureAiFoundryClient(
            new HttpClient(handler),
            Options.Create(Opties(deployment: null, authentication: AzureAIAuthentication.Entra)),
            new EntraTokenProvider(new FakeCredential("ongebruikt")));

        await Assert.ThrowsAsync<InvalidOperationException>(() => client.CompleteAsync(EenRequest()));
        Assert.Equal(0, handler.AantalAanroepen);
    }

    [Fact]
    public async Task De_client_verwerpt_null_argumenten()
    {
        Assert.Throws<ArgumentNullException>(() =>
            new AzureAiFoundryClient(null!, Options.Create(Opties())));
        Assert.Throws<ArgumentNullException>(() =>
            new AzureAiFoundryClient(new HttpClient(new StubHandler("{}")), null!));
        Assert.Throws<ArgumentNullException>(() =>
            new AzureAiFoundryClient(new HttpClient(new StubHandler("{}")), Options.Create(Opties()), null!));
        Assert.Throws<ArgumentNullException>(() => new EntraTokenProvider(null!));

        var client = new AzureAiFoundryClient(
            new HttpClient(new StubHandler(AzureEnvelop("{}"))), Options.Create(Opties()));
        await Assert.ThrowsAsync<ArgumentNullException>(() => client.CompleteAsync(null!));
    }

    /// <summary>
    /// Records the outbound request (including its body, read before the handler returns, since the client disposes
    /// the request afterwards) and replies with a canned response. No sockets are opened.
    /// </summary>
    private sealed class StubHandler : HttpMessageHandler
    {
        private readonly string _antwoord;
        private readonly HttpStatusCode _status;

        public StubHandler(string antwoord, HttpStatusCode status = HttpStatusCode.OK)
        {
            _antwoord = antwoord;
            _status = status;
        }

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

            return new HttpResponseMessage(_status)
            {
                Content = new StringContent(_antwoord, Encoding.UTF8, "application/json"),
            };
        }
    }

    /// <summary>An Entra credential that hands out a fixed token and records which scopes were asked for.</summary>
    private sealed class FakeCredential(string token, TimeSpan? geldig = null, TimeProvider? tijd = null) : TokenCredential
    {
        public int AantalAanroepen { get; private set; }

        public IReadOnlyList<string> GevraagdeScopes { get; private set; } = [];

        public override AccessToken GetToken(TokenRequestContext requestContext, CancellationToken cancellationToken)
        {
            AantalAanroepen++;
            GevraagdeScopes = requestContext.Scopes;
            var nu = (tijd ?? TimeProvider.System).GetUtcNow();
            return new AccessToken(token, nu + (geldig ?? TimeSpan.FromHours(1)));
        }

        public override ValueTask<AccessToken> GetTokenAsync(
            TokenRequestContext requestContext,
            CancellationToken cancellationToken) =>
            ValueTask.FromResult(GetToken(requestContext, cancellationToken));
    }

    /// <summary>A clock the test moves by hand.</summary>
    private sealed class VasteTijd(DateTimeOffset nu) : TimeProvider
    {
        public DateTimeOffset Nu { get; set; } = nu;

        public override DateTimeOffset GetUtcNow() => Nu;
    }
}
