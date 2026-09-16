namespace Jaarplanner.Domain.Ontwikkelingsrapport;

/// <summary>
/// How a child did on one rapportdoel at one moment (FB-003, FR-13.3, Art. IX.4, ADR-0035 §3.1): a star from the K3
/// scale and a text. <b>Pupil data</b> (Art. VI.7). Part of the <see cref="Ontwikkelingsrapport"/> aggregate, identified
/// by the pair (report, rapportdoel), and changed only through <see cref="Ontwikkelingsrapport.ZetBeoordeling"/>.
/// <para>
/// <b>A row exists only while it holds something</b>: a star, a text, or both. So "a gradatie or rapportdoel that a
/// report uses" (D1) is exactly "one a row names", and the database's <c>Restrict</c> on both keys holds D1 against a
/// path that forgets to ask. A rapportdoel without a row is simply not rated yet: one added later shows empty for the
/// moments before it (D2).
/// </para>
/// </summary>
public sealed class Rapportbeoordeling
{
    // EF Core materialisation only.
    private Rapportbeoordeling()
    {
    }

    internal Rapportbeoordeling(Guid ontwikkelingsrapportId, Guid rapportdoelId)
    {
        OntwikkelingsrapportId = ontwikkelingsrapportId;
        RapportdoelId = rapportdoelId;
    }

    /// <summary>The report (one child, one moment) this belongs to.</summary>
    public Guid OntwikkelingsrapportId { get; private set; }

    /// <summary>The rapportdoel it rates.</summary>
    public Guid RapportdoelId { get; private set; }

    /// <summary>The chosen star, or none yet: a star is not required until the teacher picks one (FB-003).</summary>
    public Guid? GradatieId { get; private set; }

    /// <summary>The text, trimmed, or none.</summary>
    public string? Tekst { get; private set; }

    /// <summary>Who wrote <see cref="Tekst"/>; <c>null</c> exactly when there is no text.</summary>
    public Tekststatus? TekstStatus { get; private set; }

    /// <summary>
    /// That an AI rewrite of <see cref="Tekst"/> was rejected (FB-004, R23): the decision, kept without the text that was
    /// proposed for it (Art. IV.2 as amended, ADR-0035 §3.5). It is a mark beside the text, not the text's own status,
    /// because the saved text and its status stay exactly as they were.
    /// <para>
    /// <b>It belongs to the text it was proposed for</b>, so a text that changes clears it: a mark left behind would say
    /// a proposal was rejected for a text nobody ever proposed one for.
    /// </para>
    /// </summary>
    public bool HerschrijvingGeweigerd { get; private set; }

    /// <summary>
    /// Whether the row holds nothing and should not exist. A rejection alone never keeps a row alive: it is only ever set
    /// on a row that holds a text, and clearing that text clears the mark with it.
    /// </summary>
    internal bool IsLeeg => GradatieId is null && Tekst is null;

    /// <summary>
    /// Sets the star and the text. A text that changes takes <paramref name="herkomst"/>: <see cref="Tekststatus.Manueel"/>
    /// for anything the teacher typed, and <see cref="Tekststatus.Aanvaard"/> only for an AI rewrite the server itself
    /// found to be accepted unchanged (FB-004, D13). An unchanged text keeps its status, so choosing a star does not
    /// relabel an accepted rewrite.
    /// </summary>
    internal void Zet(Guid? gradatieId, string? tekst, Tekststatus herkomst = Tekststatus.Manueel)
    {
        GradatieId = gradatieId;
        if (!string.Equals(Tekst, tekst, StringComparison.Ordinal))
        {
            Tekst = tekst;
            TekstStatus = tekst is null ? null : herkomst;
            HerschrijvingGeweigerd = false;
        }
    }

    /// <summary>Records that a rewrite proposed for the current text was rejected (R23). Nothing of the proposal is kept.</summary>
    internal void WeigerHerschrijving() => HerschrijvingGeweigerd = true;
}
