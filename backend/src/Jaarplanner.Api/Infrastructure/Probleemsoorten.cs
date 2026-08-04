using Jaarplanner.Application.Curriculum.Import;

namespace Jaarplanner.Api.Infrastructure;

/// <summary>
/// The RFC 7807 <c>ProblemDetails.type</c> URIs this API answers where a client has to tell <b>which</b>
/// fault of one status code it received.
/// <para>
/// <b>Why this exists (E1-13 fix round 1, antagonist MAJOR 3).</b> The Op.stap import answers <b>409</b> for
/// two refusals whose owners are opposite: the decreed minimumdoelen are not loaded (nothing the uploader can
/// do, and nothing that will change until E1-12 lands) and the file's codes already belong to another
/// discipline (the uploader fixes it, by correcting the discipline number or by uploading the other file).
/// Status and <see cref="Probleemtitels.ImportNietDoorgevoerd"/> were identical for both, so the import screen
/// applied one "the application cannot read this yet" frame to each and printed it two lines above the
/// server's own <c>detail</c> saying <i>"Controleer of dit bestand bij discipline N hoort"</i>. Two
/// contradictory sentences, and the reader sent off to wait for a change that was never coming.
/// </para>
/// <para>
/// <b><c>type</c> rather than an extension member or a distinct <c>Title</c>.</b> It is RFC 7807's own
/// discriminator, so no wire field is invented for a copy nuance. A <c>Title</c> would not do: titles are
/// user-facing Dutch (Art. II.3, see <see cref="Probleemtitels"/>), and branching UI behaviour on Dutch prose
/// is precisely the string-matching the import screen was built to avoid. Setting <c>Type</c> explicitly is
/// safe: <c>ProblemDetailsDefaults</c> fills it in only when it is null.
/// </para>
/// <para>
/// <b>The frontend holds the same literals</b> in <c>frontend/src/features/import/api.ts</c>
/// (<c>OPSTAP_WEIGERINGSOORT</c>), because there is no generated contract between the two. The URIs carry no
/// version and are not resolvable addresses: they are identifiers, so renaming one is a breaking change on
/// both sides and should stay a rare event.
/// </para>
/// </summary>
public static class Probleemsoorten
{
    /// <summary>The stated discipline is not an official Op.stap discipline (400).</summary>
    public const string OpstapOnbekendeDiscipline = "urn:jaarplanner:opstap-import:onbekende-discipline";

    /// <summary>The file concords to decreed minimumdoelen that are not loaded (409, blocked on E1-12).</summary>
    public const string OpstapOntbrekendeMinimumdoelen =
        "urn:jaarplanner:opstap-import:ontbrekende-minimumdoelen";

    /// <summary>The file claims a leerplandoel code that is loaded under another discipline (409).</summary>
    public const string OpstapCodeInAndereDiscipline =
        "urn:jaarplanner:opstap-import:code-in-andere-discipline";

    /// <summary>
    /// The <c>type</c> URI for an Op.stap import refusal.
    /// <para>
    /// Every member of <see cref="OpstapImportFoutSoort"/> maps to one, asserted by a unit test rather than by
    /// a throwing default: this runs inside an exception handler, where throwing would replace a 409 the UI can
    /// explain with a 500 it cannot. A new member therefore fails a test instead of a request.
    /// </para>
    /// </summary>
    public static string? VoorOpstapImport(OpstapImportFoutSoort soort) => soort switch
    {
        OpstapImportFoutSoort.OnbekendeDiscipline => OpstapOnbekendeDiscipline,
        OpstapImportFoutSoort.OntbrekendeMinimumdoelen => OpstapOntbrekendeMinimumdoelen,
        OpstapImportFoutSoort.CodeInAndereDiscipline => OpstapCodeInAndereDiscipline,
        _ => null,
    };
}
