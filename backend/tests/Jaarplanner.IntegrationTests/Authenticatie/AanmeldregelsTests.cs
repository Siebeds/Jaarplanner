using System.Net;
using Jaarplanner.Api.Infrastructure.Authenticatie;
using Microsoft.AspNetCore.Http;

namespace Jaarplanner.IntegrationTests.Authenticatie;

/// <summary>
/// The two small rules the sign-in leans on, tested directly: where a login may send the browser back to
/// (<see cref="LokaalPad"/>, ADR-0031 decision 4) and who the development sign-in accepts
/// (<see cref="OntwikkelAanmelding.IsLokaal"/>, decision 6). Here rather than in the unit tests because they live in the
/// Api, which only this project references.
/// </summary>
public sealed class AanmeldregelsTests
{
    [Theory]
    [InlineData("/agenda", "/agenda")]
    [InlineData("/instellingen/klassen?tab=2", "/instellingen/klassen?tab=2")]
    [InlineData("/", "/")]
    [InlineData(null, "/")]
    [InlineData("", "/")]
    [InlineData("agenda", "/")]
    [InlineData("https://evil.example/", "/")]
    [InlineData("//evil.example", "/")]
    [InlineData("/\\evil.example", "/")]
    [InlineData("/\t/evil.example", "/")]
    [InlineData("/\n/evil.example", "/")]
    [InlineData("/agenda\r\nSet-Cookie: x", "/")]
    public void Een_terugkeeradres_blijft_binnen_de_app(string? gevraagd, string verwacht) =>
        Assert.Equal(verwacht, LokaalPad.Veilig(gevraagd));

    [Theory]
    [InlineData("127.0.0.1", null, true)]
    [InlineData("::1", null, true)]
    [InlineData("::ffff:127.0.0.1", null, true)]
    [InlineData("127.0.0.1", "127.0.0.1", true)]
    [InlineData("127.0.0.1", "::1", true)]
    [InlineData("127.0.0.1", "::ffff:127.0.0.1", true)]
    [InlineData("127.0.0.1", "192.168.1.20", false)]
    [InlineData("127.0.0.1", "127.0.0.1, 192.168.1.20", false)]
    [InlineData("127.0.0.1", "not-an-address", false)]
    [InlineData("192.168.1.20", null, false)]
    [InlineData(null, null, false)]
    public void De_ontwikkellogin_aanvaardt_alleen_deze_machine(string? verbinding, string? doorgestuurd, bool lokaal)
    {
        var context = new DefaultHttpContext();
        context.Connection.RemoteIpAddress = verbinding is null ? null : IPAddress.Parse(verbinding);
        if (doorgestuurd is not null)
        {
            context.Request.Headers[OntwikkelAanmelding.DoorgestuurdVoorHeader] = doorgestuurd;
        }

        Assert.Equal(lokaal, OntwikkelAanmelding.IsLokaal(context));
    }
}
