using Jaarplanner.Application.Ai;

namespace Jaarplanner.UnitTests.Ai;

/// <summary>
/// In-memory <see cref="IAiClient"/> for tests (Art. IV.6). It returns a canned completion and does
/// <b>no</b> network I/O whatsoever — proving the matching/plan logic runs against a fake with no
/// network. It also records the last request so tests can assert on what the logic sent.
/// </summary>
public sealed class FakeAiClient : IAiClient
{
    private readonly string _cannedContent;

    /// <summary>The request most recently passed to <see cref="CompleteAsync"/>, or null if none.</summary>
    public AiRequest? LaatsteRequest { get; private set; }

    /// <summary>How many times <see cref="CompleteAsync"/> has been called.</summary>
    public int AantalAanroepen { get; private set; }

    /// <summary>Creates a fake that returns the given canned raw completion content.</summary>
    public FakeAiClient(string cannedContent = "{}")
    {
        _cannedContent = cannedContent;
    }

    /// <inheritdoc />
    public Task<AiCompletion> CompleteAsync(AiRequest request, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        LaatsteRequest = request;
        AantalAanroepen++;

        // Purely in-memory — no HttpClient, no sockets, no external call.
        return Task.FromResult(new AiCompletion { Content = _cannedContent });
    }
}
