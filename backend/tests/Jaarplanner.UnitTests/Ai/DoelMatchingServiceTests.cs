using Jaarplanner.Application.Ai;
using Jaarplanner.Application.AiMatching;

namespace Jaarplanner.UnitTests.Ai;

/// <summary>
/// Pins the E2-01 seam (Art. IV.6 / VI.4): the AI matching service depends only on the injectable
/// <see cref="IAiClient"/>, so it runs against a <see cref="FakeAiClient"/> with <b>no network</b>.
/// These tests are the "Done when" evidence for E2-01.
/// </summary>
public sealed class DoelMatchingServiceTests
{
    private static AiRequest EenRequest() =>
        new() { SystemPrompt = "match doelen op thema", UserPrompt = "thema Herfst; doelen [WI-1, NL-2]" };

    [Fact]
    public async Task Matching_service_runs_against_the_fake_and_returns_its_canned_completion()
    {
        // Arrange: inject the fake AI client — no Azure client, no HttpClient, no network.
        var fake = new FakeAiClient(cannedContent: "{\"suggesties\":[]}");
        var service = new DoelMatchingService(fake);

        // Act
        var completion = await service.VraagSuggestiesAsync(EenRequest());

        // Assert: the service reached the injected client and returned its raw completion unchanged.
        Assert.Equal("{\"suggesties\":[]}", completion.Content);
        Assert.Equal(1, fake.AantalAanroepen);
    }

    [Fact]
    public async Task Matching_service_forwards_the_grounded_prompt_to_the_client()
    {
        var fake = new FakeAiClient();
        var service = new DoelMatchingService(fake);
        var request = EenRequest();

        await service.VraagSuggestiesAsync(request);

        // The exact request the logic built is what the client received (the seam is transparent).
        Assert.NotNull(fake.LaatsteRequest);
        Assert.Equal(request.SystemPrompt, fake.LaatsteRequest!.SystemPrompt);
        Assert.Equal(request.UserPrompt, fake.LaatsteRequest.UserPrompt);
    }

    [Fact]
    public void Matching_service_rejects_a_null_client()
    {
        Assert.Throws<ArgumentNullException>(() => new DoelMatchingService(null!));
    }
}
