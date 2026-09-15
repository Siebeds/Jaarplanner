namespace Jaarplanner.Domain.Planning;

/// <summary>
/// What one hoek of a class is enriched with while one subthema runs: "prentenboeken over de herfst, bladerenpers op
/// tafel" (owner, meeting 2026-08-30; per subthemaperiode since 2026-09-15, FB-020, ADR-0040).
/// <para>
/// <b>One hoek and one <see cref="Subthemaplaatsing"/>, and that pair is the whole model.</b> The owner asked for the
/// verrijking to belong to the subthema that is running: she clicks the subthema in the agenda and writes, per hoek,
/// what goes in it for that stretch. Before FB-020 it hung off a <see cref="Hoekplaatsing"/> with two dates of its own,
/// which had no tie to what the class was working on and made her type a window the subthema already had. The hoek
/// says which class (a hoek belongs to one), the window says which days, and neither is stored here a second time.
/// </para>
/// <para>
/// <b>Free text on purpose.</b> The owner's first sketch had verrijkingen configured per subthema and picked from a
/// list; that was dropped in the same session, because what a teacher puts in her boekenhoek for these two weeks is too
/// specific to be worth choosing from a menu she would first have had to fill in. So there is nothing to validate here
/// beyond "she wrote something".
/// </para>
/// <para>
/// <b>Outside the <see cref="Jaarplan"/> aggregate, like the hoekplaatsing, though the window it names is inside it.</b>
/// That is safe because nothing discards a window: a (re)generation removes only placements that are <c>Voorgesteld</c>
/// and not <c>vergrendeld</c> (Art. IX.3), a window carries no status, and re-planning an overlapping window moves the
/// same row (<see cref="Jaarplan.PlaatsSubthema"/>), so the text follows the days. A verrijking goes only with its hoek
/// or with its subthema, and deleting either one says first how many go with it.
/// </para>
/// <para>
/// <b>It grants no dekking.</b> Art. V.1 counts links hanging off a placed thema or a planned algemene fiche, and a
/// verrijking carries no doelkoppeling at all.
/// </para>
/// </summary>
public sealed class Hoekverrijking
{
    // EF Core materialisation only.
    private Hoekverrijking()
    {
        Tekst = null!;
    }

    /// <summary>Writes what <paramref name="hoekId"/> holds while the subthema of one window runs.</summary>
    /// <param name="hoekId">
    /// The corner. That it belongs to the klas whose plan holds the window is checked by the service, the one layer
    /// that can read both rows; this type stores honest keys.
    /// </param>
    /// <param name="subthemaplaatsingId">The window of the subthema, in the klas's own plan.</param>
    /// <param name="tekst">
    /// What she puts in the corner. Required: the service reads a blank field as "remove it", so a blank never reaches
    /// here from a screen, and one that does is a programmer error.
    /// </param>
    public Hoekverrijking(Guid hoekId, Guid subthemaplaatsingId, string tekst)
    {
        HoekId = RequireId(hoekId, nameof(hoekId));
        SubthemaplaatsingId = RequireId(subthemaplaatsingId, nameof(subthemaplaatsingId));
        Tekst = Require(tekst, nameof(tekst));
    }

    /// <summary>Surrogate identity.</summary>
    public Guid Id { get; private set; } = Guid.NewGuid();

    /// <summary>The corner this is about.</summary>
    public Guid HoekId { get; private set; }

    /// <summary>The window of the subthema it belongs to.</summary>
    public Guid SubthemaplaatsingId { get; private set; }

    /// <summary>What the corner is enriched with. Free text, required.</summary>
    public string Tekst { get; private set; }

    /// <summary>Rewrites the text. The hoek and the window are what the row IS, so they never change.</summary>
    public void Wijzig(string tekst) => Tekst = Require(tekst, nameof(tekst));

    private static Guid RequireId(Guid value, string paramName) =>
        value == Guid.Empty ? throw new ArgumentException($"'{paramName}' is required.", paramName) : value;

    private static string Require(string value, string paramName)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new ArgumentException($"'{paramName}' is required.", paramName);
        }

        return value.Trim();
    }
}
