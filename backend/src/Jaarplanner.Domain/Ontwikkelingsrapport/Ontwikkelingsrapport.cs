namespace Jaarplanner.Domain.Ontwikkelingsrapport;

/// <summary>
/// The report of one child at one <see cref="Evaluatiemoment"/> (FB-003, FR-13.3, Art. IX.4, ADR-0035 §3.1): a star and
/// a text per rapportdoel (<see cref="Rapportbeoordeling"/>), and an algemeen besluit (R9). <b>Pupil data</b> (Art.
/// VI.7), and it never counts for dekking (FR-13.9): nothing in the dekking reads it.
/// <para>
/// <b>Made on the first write, never before.</b> Opening an empty report stores nothing, so a report exists only once a
/// teacher wrote something in it. It goes with its leerling (a database cascade, D8), and with the schooljaar when
/// directie wipes one (D7, FB-007).
/// </para>
/// <para>
/// <b>No text in an exception message.</b> A fault can reach a log (ADR-0035 §3.8), so validation names the field and
/// never its value.
/// </para>
/// </summary>
public sealed class Ontwikkelingsrapport
{
    /// <summary>The longest text accepted for one rapportdoel.</summary>
    public const int MaxTekstLengte = 2000;

    /// <summary>The longest algemeen besluit accepted.</summary>
    public const int MaxBesluitLengte = 4000;

    private readonly List<Rapportbeoordeling> _beoordelingen = [];

    // EF Core materialisation only.
    private Ontwikkelingsrapport()
    {
    }

    /// <summary>Starts the report of a child at a moment.</summary>
    /// <param name="leerlingId">The child. Required.</param>
    /// <param name="moment">1, 2 or 3 (<see cref="Evaluatiemoment"/>).</param>
    public Ontwikkelingsrapport(Guid leerlingId, int moment)
    {
        LeerlingId = leerlingId == Guid.Empty
            ? throw new ArgumentException("'leerlingId' is required.", nameof(leerlingId))
            : leerlingId;
        Moment = Evaluatiemoment.IsGeldig(moment)
            ? moment
            : throw new ArgumentOutOfRangeException(nameof(moment), moment, "'moment' is 1, 2 or 3.");
    }

    /// <summary>Surrogate identity.</summary>
    public Guid Id { get; private set; } = Guid.NewGuid();

    /// <summary>The child. Immutable.</summary>
    public Guid LeerlingId { get; private set; }

    /// <summary>1, 2 or 3. Immutable.</summary>
    public int Moment { get; private set; }

    /// <summary>The algemeen besluit (R9), trimmed, or none yet.</summary>
    public string? Besluit { get; private set; }

    /// <summary>Who wrote <see cref="Besluit"/>; <c>null</c> exactly when there is none.</summary>
    public Tekststatus? BesluitStatus { get; private set; }

    /// <summary>
    /// That an AI rewrite of <see cref="Besluit"/> was rejected (FB-004, R23), kept without the text that was proposed
    /// for it. The besluit's own <see cref="Rapportbeoordeling.HerschrijvingGeweigerd"/>, with the same rule: a besluit
    /// that changes clears it.
    /// </summary>
    public bool BesluitHerschrijvingGeweigerd { get; private set; }

    /// <summary>The rapportdoelen rated so far. A rapportdoel without a row has no star and no text yet.</summary>
    public IReadOnlyList<Rapportbeoordeling> Beoordelingen => _beoordelingen;

    /// <summary>
    /// Sets the algemeen besluit. Blank clears it. A besluit that changes takes <paramref name="herkomst"/>
    /// (<see cref="Tekststatus.Aanvaard"/> only for an AI rewrite accepted unchanged, FB-004); an unchanged one keeps its
    /// status.
    /// </summary>
    public void ZetBesluit(string? tekst, Tekststatus herkomst = Tekststatus.Manueel)
    {
        var nieuw = Keur(tekst, MaxBesluitLengte, nameof(tekst));
        if (!string.Equals(Besluit, nieuw, StringComparison.Ordinal))
        {
            Besluit = nieuw;
            BesluitStatus = nieuw is null ? null : herkomst;
            BesluitHerschrijvingGeweigerd = false;
        }
    }

    /// <summary>
    /// Records that a rewrite proposed for the algemeen besluit was rejected (R23). Nothing of the proposal is kept. It
    /// does nothing when there is no besluit to have proposed one for.
    /// </summary>
    public void WeigerBesluitHerschrijving()
    {
        if (Besluit is not null)
        {
            BesluitHerschrijvingGeweigerd = true;
        }
    }

    /// <summary>
    /// Records that a rewrite proposed for one rapportdoel's text was rejected (R23). It does nothing when that
    /// rapportdoel has no text on this report: the text a proposal was meant for is gone, so there is nothing to mark.
    /// </summary>
    public void WeigerHerschrijving(Guid rapportdoelId)
    {
        var rij = _beoordelingen.Find(b => b.RapportdoelId == rapportdoelId);
        if (rij?.Tekst is not null)
        {
            rij.WeigerHerschrijving();
        }
    }

    /// <summary>
    /// Sets the star and the text for one rapportdoel. Blank text and no star remove the row, so a report uses a gradatie
    /// or a rapportdoel only while it shows one (D1).
    /// </summary>
    /// <returns>The row as it now stands, or <c>null</c> when it was removed or never made.</returns>
    public Rapportbeoordeling? ZetBeoordeling(
        Guid rapportdoelId,
        Guid? gradatieId,
        string? tekst,
        Tekststatus herkomst = Tekststatus.Manueel)
    {
        if (rapportdoelId == Guid.Empty)
        {
            throw new ArgumentException("'rapportdoelId' is required.", nameof(rapportdoelId));
        }

        if (gradatieId == Guid.Empty)
        {
            throw new ArgumentException("'gradatieId' is null or a real id.", nameof(gradatieId));
        }

        var nieuweTekst = Keur(tekst, MaxTekstLengte, nameof(tekst));
        var rij = _beoordelingen.Find(b => b.RapportdoelId == rapportdoelId);

        if (rij is null)
        {
            if (gradatieId is null && nieuweTekst is null)
            {
                return null;
            }

            rij = new Rapportbeoordeling(Id, rapportdoelId);
            _beoordelingen.Add(rij);
        }

        rij.Zet(gradatieId, nieuweTekst, herkomst);
        if (rij.IsLeeg)
        {
            _beoordelingen.Remove(rij);
            return null;
        }

        return rij;
    }

    /// <summary>The trimmed text, <c>null</c> for blank, or a refusal that names the field and never the text.</summary>
    private static string? Keur(string? tekst, int max, string paramName)
    {
        if (string.IsNullOrWhiteSpace(tekst))
        {
            return null;
        }

        var getrimd = tekst.Trim();
        return getrimd.Length <= max
            ? getrimd
            : throw new ArgumentException($"'{paramName}' is at most {max} characters long.", paramName);
    }
}
