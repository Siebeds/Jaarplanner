namespace Jaarplanner.Domain.Ontwikkelingsrapport;

/// <summary>
/// A titled group of K3 subdoelen a child is rated on (FB-002, FR-13.2, Art. IX.4, ADR-0035 §3.1, R3). <b>Not pupil
/// data.</b> One set for all of K3 (R4), with no schooljaar (R7), so a change reaches every report already written.
/// <para>
/// <b>What it bundles is decided by the service, and read back through a filter.</b> A subdoel may only be bundled when
/// its subthema is at <see cref="SubdoelLeeftijd"/> and its goal link is decided (D11); that needs the subthema and the
/// link, which this aggregate cannot see, so <c>RapportsetService</c> checks it on every write and filters on it on every
/// read. This class keeps the titel, the order and a set of subdoel ids, each once.
/// </para>
/// <para>
/// From FB-003 on, a rapportdoel a rating uses cannot be deleted (D1); nothing uses one before then.
/// </para>
/// </summary>
public sealed class Rapportdoel
{
    /// <summary>The longest titel accepted.</summary>
    public const int MaxTitelLengte = 120;

    /// <summary>
    /// The leeftijd of the subthema's whose subdoelen can be bundled: the derde kleuter (R3, R4). A subthema's leeftijd is a
    /// jaar/fase code of its own, not a klas's, so the graadklas decision (Art. XIV), which maps klassen to leeftijden, does
    /// not reach this.
    /// </summary>
    public const string SubdoelLeeftijd = "K3";

    private readonly List<RapportdoelSubdoel> _subdoelen = [];

    // EF Core materialisation only.
    private Rapportdoel()
    {
        Titel = null!;
    }

    /// <summary>Adds a rapportdoel to the K3 set.</summary>
    /// <param name="titel">Required, trimmed, at most <see cref="MaxTitelLengte"/> characters.</param>
    /// <param name="volgorde">Its place in the set. Zero or more; the service appends at the end.</param>
    /// <param name="subdoelIds">The subdoelen it bundles. A repeated id counts once; none is allowed while editing.</param>
    public Rapportdoel(string titel, int volgorde, IEnumerable<Guid> subdoelIds)
    {
        Titel = KeurTitel(titel);
        Volgorde = KeurVolgorde(volgorde);
        ZetSubdoelen(KeurSubdoelIds(subdoelIds));
    }

    /// <summary>Surrogate identity.</summary>
    public Guid Id { get; private set; } = Guid.NewGuid();

    /// <summary>What the report shows for this group, e.g. "Luisteren en spreken".</summary>
    public string Titel { get; private set; }

    /// <summary>Its place in the set, ascending.</summary>
    public int Volgorde { get; private set; }

    /// <summary>The subdoelen it bundles, as stored: unfiltered, so a read must apply the D11 and D12 filter.</summary>
    public IReadOnlyList<RapportdoelSubdoel> Subdoelen => _subdoelen;

    /// <summary>
    /// Sets the titel and the subdoelen it bundles. Both are checked before either changes, so a refusal changes nothing.
    /// A subdoel that stays keeps its row; only the rows for ids that leave or join change.
    /// </summary>
    public void Wijzig(string titel, IEnumerable<Guid> subdoelIds)
    {
        var nieuweTitel = KeurTitel(titel);
        var nieuweIds = KeurSubdoelIds(subdoelIds);

        Titel = nieuweTitel;
        ZetSubdoelen(nieuweIds);
    }

    /// <summary>Moves the rapportdoel to another place in the set.</summary>
    public void ZetVolgorde(int volgorde) => Volgorde = KeurVolgorde(volgorde);

    private void ZetSubdoelen(IReadOnlyCollection<Guid> ids)
    {
        _subdoelen.RemoveAll(rij => !ids.Contains(rij.SubdoelId));

        foreach (var id in ids.Where(id => _subdoelen.TrueForAll(rij => rij.SubdoelId != id)))
        {
            _subdoelen.Add(new RapportdoelSubdoel(Id, id));
        }
    }

    private static string KeurTitel(string? titel)
    {
        if (string.IsNullOrWhiteSpace(titel))
        {
            throw new ArgumentException("'titel' is required.", nameof(titel));
        }

        var getrimd = titel.Trim();
        if (getrimd.Length > MaxTitelLengte)
        {
            throw new ArgumentException($"'titel' is at most {MaxTitelLengte} characters long.", nameof(titel));
        }

        return getrimd;
    }

    /// <summary>The ids, each once and in their first order. An empty id names no subdoel and is refused.</summary>
    private static List<Guid> KeurSubdoelIds(IEnumerable<Guid>? subdoelIds)
    {
        ArgumentNullException.ThrowIfNull(subdoelIds);

        var ids = subdoelIds.Distinct().ToList();
        if (ids.Contains(Guid.Empty))
        {
            throw new ArgumentException("A subdoel id is never empty.", nameof(subdoelIds));
        }

        return ids;
    }

    private static int KeurVolgorde(int volgorde) =>
        volgorde >= 0
            ? volgorde
            : throw new ArgumentOutOfRangeException(nameof(volgorde), volgorde, "'volgorde' is zero or more.");
}
