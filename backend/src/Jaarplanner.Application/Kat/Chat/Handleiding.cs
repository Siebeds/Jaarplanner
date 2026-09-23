namespace Jaarplanner.Application.Kat.Chat;

/// <summary>
/// The tool's Dutch handleiding (FB-031, ADR-0066): the only source the cat explains the tool from (Art. IV.4). It
/// ships inside this assembly, so the text the model is sent is the text in the repo, and it is the stable part of every
/// chat request, which a provider can serve from its cache (TB-043).
/// <para>Its chapters are its <c>## </c> headings; an explanation must name at least one of them, by its exact title.</para>
/// </summary>
public sealed class Handleiding
{
    private const string Bron = "Jaarplanner.Kat.Handleiding.md";

    private static readonly Lazy<Handleiding> Ingebouwd = new(Laad);

    /// <summary>A handleiding with this text; the tests use it with a short one.</summary>
    public Handleiding(string tekst)
    {
        ArgumentNullException.ThrowIfNull(tekst);
        Tekst = tekst.Replace("\r\n", "\n", StringComparison.Ordinal);
        Hoofdstukken = Tekst
            .Split('\n')
            .Where(regel => regel.StartsWith("## ", StringComparison.Ordinal))
            .Select(regel => regel[3..].Trim())
            .Where(titel => titel.Length > 0)
            .ToList();
    }

    /// <summary>The handleiding in this assembly.</summary>
    public static Handleiding Standaard => Ingebouwd.Value;

    /// <summary>The whole text, with <c>\n</c> line ends so the request is the same on every machine.</summary>
    public string Tekst { get; }

    /// <summary>The chapter titles, in order.</summary>
    public IReadOnlyList<string> Hoofdstukken { get; }

    /// <summary>The chapter with this title, ignoring case and surrounding spaces, as the handleiding writes it.</summary>
    public string? Hoofdstuk(string titel) =>
        Hoofdstukken.FirstOrDefault(h => string.Equals(h, titel.Trim(), StringComparison.OrdinalIgnoreCase));

    private static Handleiding Laad()
    {
        using var stroom = typeof(Handleiding).Assembly.GetManifestResourceStream(Bron)
            ?? throw new InvalidOperationException($"Embedded resource '{Bron}' is missing from the Application assembly.");
        using var lezer = new StreamReader(stroom);
        return new Handleiding(lezer.ReadToEnd());
    }
}
