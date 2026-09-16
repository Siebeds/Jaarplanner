namespace Jaarplanner.Application.Ontwikkelingsrapport;

/// <summary>
/// Which text of which report a rewrite was proposed for: one rapportdoel of a child's report at a moment, or, when
/// <paramref name="RapportdoelId"/> is <c>null</c>, its algemeen besluit.
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
/// <b>It carries no text.</b> The seal binds the doel and a hash of the proposal, never the proposal, so a teacher's
/// browser holding a seal is not the server storing a text, and a seal read off the wire tells no one what was proposed.
/// </para>
/// <para>
/// <b>It expires.</b> A seal is good for minutes, so one cannot be kept and replayed against a text the teacher wrote
/// weeks later.
/// </para>
/// </summary>
public interface IHerschrijfZegel
{
    /// <summary>Seals <paramref name="voorstel"/> as this doel's proposal.</summary>
    string Onderteken(Herschrijfdoel doel, string voorstel);

    /// <summary>
    /// Whether <paramref name="zegel"/> is this doel's own, still valid, and over exactly <paramref name="voorstel"/>.
    /// A <c>null</c> <paramref name="voorstel"/> asks only whether the seal is this doel's and still valid, which is what
    /// a rejection can prove: it sends no text, because none may be stored.
    /// </summary>
    bool Klopt(Herschrijfdoel doel, string? voorstel, string zegel);
}
