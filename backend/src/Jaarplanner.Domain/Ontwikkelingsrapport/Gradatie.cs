namespace Jaarplanner.Domain.Ontwikkelingsrapport;

/// <summary>
/// One star on the one K3 scale a child is rated with (FB-002, FR-13.2, Art. IX.4, ADR-0035 §3.1): a label, a colour
/// from the fixed <see cref="Sterkleur"/> palette, and a place in the order. <b>Not pupil data</b> (ADR-0035 §3.1).
/// <para>
/// <b>One scale for all of K3, with no schooljaar</b> (R5, R7). A rename or recolour therefore changes every report
/// already written, which the owner chose with that cost stated. From FB-003 on, a gradatie a rating uses cannot be
/// deleted (D1); nothing uses one before then.
/// </para>
/// <para>
/// The scale starts with the owner's example, seeded by the migration <c>AddRapportdoelenEnGradaties</c>: "Volledig
/// bereikt" (groen) and "Nog niet volledig" (oranje). The K3 leerkrachten change it from there.
/// </para>
/// </summary>
public sealed class Gradatie
{
    /// <summary>The longest label accepted.</summary>
    public const int MaxLabelLengte = 60;

    // EF Core materialisation only.
    private Gradatie()
    {
        Label = null!;
    }

    /// <summary>Adds a star to the scale.</summary>
    /// <param name="label">Required, trimmed, at most <see cref="MaxLabelLengte"/> characters.</param>
    /// <param name="kleur">One of the <see cref="Sterkleur"/> members.</param>
    /// <param name="volgorde">Its place on the scale. Zero or more; the service appends at the end.</param>
    public Gradatie(string label, Sterkleur kleur, int volgorde)
    {
        Label = KeurLabel(label);
        Kleur = KeurKleur(kleur);
        Volgorde = KeurVolgorde(volgorde);
    }

    /// <summary>Surrogate identity.</summary>
    public Guid Id { get; private set; } = Guid.NewGuid();

    /// <summary>What the star means, shown beside it (Art. XII).</summary>
    public string Label { get; private set; }

    /// <summary>The star's colour, by name.</summary>
    public Sterkleur Kleur { get; private set; }

    /// <summary>Its place on the scale, ascending.</summary>
    public int Volgorde { get; private set; }

    /// <summary>Renames and recolours the star. Both are checked before either changes, so a refusal changes nothing.</summary>
    public void Wijzig(string label, Sterkleur kleur)
    {
        var nieuwLabel = KeurLabel(label);
        var nieuweKleur = KeurKleur(kleur);

        Label = nieuwLabel;
        Kleur = nieuweKleur;
    }

    /// <summary>Moves the star to another place on the scale.</summary>
    public void ZetVolgorde(int volgorde) => Volgorde = KeurVolgorde(volgorde);

    private static string KeurLabel(string? label)
    {
        if (string.IsNullOrWhiteSpace(label))
        {
            throw new ArgumentException("'label' is required.", nameof(label));
        }

        var getrimd = label.Trim();
        if (getrimd.Length > MaxLabelLengte)
        {
            throw new ArgumentException($"'label' is at most {MaxLabelLengte} characters long.", nameof(label));
        }

        return getrimd;
    }

    private static Sterkleur KeurKleur(Sterkleur kleur) =>
        Enum.IsDefined(kleur)
            ? kleur
            : throw new ArgumentOutOfRangeException(nameof(kleur), kleur, "Unknown sterkleur.");

    private static int KeurVolgorde(int volgorde) =>
        volgorde >= 0
            ? volgorde
            : throw new ArgumentOutOfRangeException(nameof(volgorde), volgorde, "'volgorde' is zero or more.");
}
