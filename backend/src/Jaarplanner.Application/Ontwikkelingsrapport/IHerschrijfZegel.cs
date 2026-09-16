namespace Jaarplanner.Application.Ontwikkelingsrapport;

/// <summary>
/// Which text of which report a rewrite was proposed for: one rapportdoel of a child's report at a moment, or, when
/// <see cref="RapportdoelId"/> is <c>null</c>, its algemeen besluit.
/// </summary>
public sealed record Herschrijfdoel(Guid LeerlingId, int Moment, Guid? RapportdoelId);

/// <summary>
/// The server's signature on a rewrite proposal (FB-004, ADR-0035 §3.5 D13).
/// <para>
/// <b>Why a signature at all.</b> No proposal is stored (Art. IV.2 as amended): one nobody has decided on yet exists
/// only on the teacher's screen. Without a signature the server would have to take the browser's word for "this text is
/// the AI's proposal, accepted unchanged", and <c>aanvaard</c> would then mean whatever a request said. With one, the
/// server re-establishes for itself that the text it is asked to store is the text it proposed, for this very field, a
/// short while ago. <c>aanvaard</c> and <c>geweigerd</c> are then the server's finding.
/// </para>
/// <para>
/// <b>It seals both texts</b>: the proposal, so an acceptance can be recognised, and the text the proposal was made
/// for, so a rejection lands on that text and not on whatever stands there by the time she decides.
/// </para>
/// <para>
/// <b>It carries no text.</b> The seal binds the doel and a hash of each, never a text, so a teacher's browser holding
/// a seal is not the server storing a text, and a seal read off the wire tells no one what was proposed.
/// </para>
/// <para>
/// <b>It expires.</b> A seal is good for minutes, so one cannot be kept and replayed against a text the teacher wrote
/// weeks later.
/// </para>
/// </summary>
public interface IHerschrijfZegel
{
    /// <summary>Seals <paramref name="voorstel"/> as this doel's proposal for <paramref name="brontekst"/>.</summary>
    string Onderteken(Herschrijfdoel doel, string brontekst, string voorstel);

    /// <summary>
    /// Whether <paramref name="zegel"/> is this server's own, this doel's, still valid, and over exactly
    /// <paramref name="voorstel"/>. This is what makes a save <c>aanvaard</c>; anything else is <c>manueel</c>.
    /// </summary>
    bool DektVoorstel(Herschrijfdoel doel, string? voorstel, string? zegel);

    /// <summary>
    /// Whether <paramref name="zegel"/> is this server's own, this doel's, still valid, and was made for exactly
    /// <paramref name="brontekst"/>. A rejection asks this of the text as it now stands, and sends no text of its own,
    /// because none of the proposal may be stored.
    /// </summary>
    bool DektBrontekst(Herschrijfdoel doel, string? brontekst, string? zegel);
}
