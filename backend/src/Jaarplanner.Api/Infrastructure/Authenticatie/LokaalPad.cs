namespace Jaarplanner.Api.Infrastructure.Authenticatie;

/// <summary>
/// Keeps the return address after a login inside the app (ADR-0031 decision 4). The same rules as ASP.NET Core's
/// <c>IsLocalUrl</c>, written out because the value is used before any controller exists to ask.
/// </summary>
public static class LokaalPad
{
    /// <summary>
    /// <paramref name="pad"/> when it is a local path, otherwise <c>/</c>. A local path:
    /// <list type="bullet">
    /// <item>starts with a single <c>/</c>;</item>
    /// <item>does not start with <c>//</c> or <c>/\</c>, which a browser reads as another host;</item>
    /// <item>contains no control character. A tab or a newline is stripped by the browser, so
    /// <c>/%09/evil.example</c> (a tab after decoding) would otherwise navigate to <c>//evil.example</c>.</item>
    /// </list>
    /// </summary>
    public static string Veilig(string? pad)
    {
        if (string.IsNullOrEmpty(pad) || pad[0] != '/')
        {
            return "/";
        }

        if (pad.Length > 1 && (pad[1] == '/' || pad[1] == '\\'))
        {
            return "/";
        }

        return pad.Any(char.IsControl) ? "/" : pad;
    }
}
