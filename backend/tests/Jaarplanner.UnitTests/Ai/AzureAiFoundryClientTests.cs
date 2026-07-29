using System.Net;
using System.Text;
using System.Text.Json;
using Jaarplanner.Application.Ai;
using Jaarplanner.Application.Planning;
using Jaarplanner.Application.Planning.Generatie;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.Infrastructure.Ai;
using Jaarplanner.Infrastructure.Planning;
using Jaarplanner.UnitTests.Planning;
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
/// drives all of it offline. Only a genuine live round-trip against Azure AI Foundry stays out of scope.
/// </para>
/// </summary>
public sealed class AzureAiFoundryClientTests
{
    private const string Endpoint = "https://jaarplanner-test.openai.azure.com/";
    private const string Deployment = "gpt-4o-jaarplan";
    private const string ApiKey = "test-key-not-a-real-secret";

    private static AzureAIOptions Opties(
        string? endpoint = Endpoint,
        string? apiKey = ApiKey,
        string? deployment = Deployment) =>
        new() { Endpoint = endpoint, ApiKey = apiKey, Deployment = deployment };

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
    /// The outbound request is exactly what the Azure OpenAI chat-completions API expects: the deployment-scoped
    /// URI with an <c>api-version</c>, the server-side key on the <c>api-key</c> header (Art. VI.4 — never a bearer
    /// token in a query string, never exposed to the frontend), both prompt roles, and
    /// <c>response_format: json_object</c> so the model is *asked* for structured JSON (Art. IV.5).
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
            "https://jaarplanner-test.openai.azure.com/openai/deployments/gpt-4o-jaarplan/chat/completions" +
            "?api-version=2024-10-21",
            verzonden.RequestUri!.ToString());

        // The key travels as a header, once, and only here.
        Assert.Equal([ApiKey], verzonden.Headers.GetValues("api-key"));
        Assert.Null(verzonden.Headers.Authorization);
        Assert.DoesNotContain(ApiKey, verzonden.RequestUri.ToString(), StringComparison.Ordinal);

        using var payload = JsonDocument.Parse(handler.LaatsteBody!);
        var root = payload.RootElement;

        Assert.Equal("json_object", root.GetProperty("response_format").GetProperty("type").GetString());

        var messages = root.GetProperty("messages");
        Assert.Equal(2, messages.GetArrayLength());
        Assert.Equal("system", messages[0].GetProperty("role").GetString());
        Assert.Equal("systeeminstructies", messages[0].GetProperty("content").GetString());
        Assert.Equal("user", messages[1].GetProperty("role").GetString());
        Assert.Equal("de schoolcontent", messages[1].GetProperty("content").GetString());
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
    /// <b>The full offline seam of the story's "real AI client" criterion.</b> A canned Azure envelope goes through
    /// the real client, then the real parser, then the real generation service, and a reviewable <c>voorgesteld</c>
    /// plan comes out. Everything but the network hop between Azure and this process is genuine production code.
    /// </summary>
    [Fact]
    public async Task Een_azure_antwoord_levert_via_de_echte_client_een_beoordeelbaar_voorstel()
    {
        var schooljaar = TestSchooljaar.MetVakanties();
        var klas = schooljaar.VoegKlasToe("L3 — derde leerjaar", leerjaar: 3);
        var thema = new Thema("Herfst", duurWeken: 5, invalshoeken: "natuur");

        IPlanningsblokIndeling indeling =
            new GeconfigureerdePlanningsblokIndeling(new PlanningsblokOptions());
        var blok = indeling.Blokken(schooljaar, JaarplanGeneratieService.GeneratieNiveau)[0];

        var handler = new StubHandler(AzureEnvelop(
            $"{{\"plaatsingen\":[{{\"blokStart\":\"{blok.Start:yyyy-MM-dd}\",\"thema\":\"Herfst\"," +
            "\"motivatie\":\"seizoen past bij het begin van het schooljaar\"}]}"));

        // The REAL client, not a fake.
        IAiClient echteClient = new AzureAiFoundryClient(new HttpClient(handler), Options.Create(Opties()));
        var opslag = new FakeJaarplanOpslag(klas, schooljaar, [thema]);
        var service = new JaarplanGeneratieService(echteClient, indeling, opslag);

        var resultaat = await service.GenereerAsync(klas.Id);

        Assert.True(resultaat.IsGeslaagd);
        Assert.Equal(1, resultaat.AantalNieuw);

        var plaatsing = Assert.Single(resultaat.Jaarplan!.Plaatsingen);
        Assert.Equal("Herfst", plaatsing.ThemaNaam);
        Assert.Equal("Voorgesteld", plaatsing.Status);
        Assert.Equal("seizoen past bij het begin van het schooljaar", plaatsing.AiMotivatie);
        Assert.Equal(blok.Start, plaatsing.BlokStart);
        Assert.False(plaatsing.Vergrendeld);

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
    /// startup, so a dev/test host that never calls AI keeps running with no AI config at all.
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
        var client = new AzureAiFoundryClient(
            new HttpClient(handler), Options.Create(Opties(endpoint, apiKey, deployment)));

        var fout = await Assert.ThrowsAsync<InvalidOperationException>(() => client.CompleteAsync(EenRequest()));

        // The message names the config keys a deployer must set, and never echoes the key itself.
        Assert.Contains("AzureAI:Endpoint", fout.Message);
        Assert.DoesNotContain(ApiKey, fout.Message, StringComparison.Ordinal);

        // Nothing left the process.
        Assert.Equal(0, handler.AantalAanroepen);
    }

    [Fact]
    public async Task De_client_verwerpt_null_argumenten()
    {
        Assert.Throws<ArgumentNullException>(() =>
            new AzureAiFoundryClient(null!, Options.Create(Opties())));
        Assert.Throws<ArgumentNullException>(() =>
            new AzureAiFoundryClient(new HttpClient(new StubHandler("{}")), null!));

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
}
