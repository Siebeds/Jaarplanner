namespace Jaarplanner.Domain.Schoolcontent;

/// <summary>
/// An activiteit (Art. IX.2) — <b>class/age-scoped</b> (it inherits the class/age scope from its
/// owning <see cref="Subthema"/>). It has an <see cref="ActiviteitType"/>, an optional
/// <see cref="Hoek"/> (learning corner) and optional <see cref="VerwachteUitkomsten"/>, and can
/// link to one or more leerdoelen through its <see cref="Doelkoppelingen"/> (each carrying status
/// + AI motivation). Mutable autonomous school content (Art. III).
/// </summary>
public sealed class Activiteit
{
    private readonly List<DoelKoppeling> _doelkoppelingen = [];

    // EF Core materialisation only.
    private Activiteit()
    {
        Naam = null!;
    }

    internal Activiteit(
        Guid subthemaId,
        string naam,
        ActiviteitType activiteitType,
        string? hoek = null,
        string? verwachteUitkomsten = null)
    {
        SubthemaId = subthemaId;
        Naam = Require(naam, nameof(naam));
        ActiviteitType = Validate(activiteitType);
        Hoek = Optional(hoek);
        VerwachteUitkomsten = Optional(verwachteUitkomsten);
    }

    /// <summary>Surrogate identity.</summary>
    public Guid Id { get; private set; } = Guid.NewGuid();

    /// <summary>The owning (class/age-scoped) subthema.</summary>
    public Guid SubthemaId { get; private set; }

    /// <summary>The activiteit name.</summary>
    public string Naam { get; private set; }

    /// <summary>The form of activity (Art. IX.2).</summary>
    public ActiviteitType ActiviteitType { get; private set; }

    /// <summary>The optional learning corner (ontdektafel, techniekhoek, …).</summary>
    public string? Hoek { get; private set; }

    /// <summary>The optional expected outcomes.</summary>
    public string? VerwachteUitkomsten { get; private set; }

    /// <summary>The goal links for this activiteit (zero or more leerdoelen; Art. IX.2).</summary>
    public IReadOnlyList<DoelKoppeling> Doelkoppelingen => _doelkoppelingen;

    /// <summary>Links this activiteit to a leerdoel.</summary>
    public void VoegDoelkoppelingToe(DoelKoppeling koppeling)
    {
        ArgumentNullException.ThrowIfNull(koppeling);
        _doelkoppelingen.Add(koppeling);
    }

    private static ActiviteitType Validate(ActiviteitType type) =>
        Enum.IsDefined(type)
            ? type
            : throw new ArgumentOutOfRangeException(nameof(type), type, "Unknown activiteit type.");

    private static string Require(string value, string paramName)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new ArgumentException($"'{paramName}' is required.", paramName);
        }

        return value.Trim();
    }

    private static string? Optional(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
