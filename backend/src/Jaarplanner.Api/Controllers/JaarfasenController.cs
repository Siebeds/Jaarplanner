using Jaarplanner.Domain.Curriculum;
using Microsoft.AspNetCore.Mvc;

namespace Jaarplanner.Api.Controllers;

/// <summary>
/// The Op.stap jaar/fase vocabulary: JK, K2, K3 and L1 to L6, in order.
/// <para>
/// <b>It exists because a form needed the list before any klas existed.</b> The codes reached the browser only on
/// <c>KlasWeergave.MogelijkeJaarfasen</c>, which is fine for editing a klas and useless for creating the first one:
/// on a fresh school there is no klas to read them off, so the leeftijd field had nothing to offer and disabled
/// itself, and a school could never create a klas at all. The same hole made the subthema form dead until a klas
/// existed, which is a dependency a subthema no longer has (Art. IX.2 as amended 2026-08-30).
/// </para>
/// <para>
/// <b>Still not spelled out in the browser</b>, which is the rule this endpoint serves rather than sidesteps:
/// <c>Jaarfasen</c> is domain vocabulary, a list of nine strings in TypeScript would be a second answer to what a
/// year group can be, and the two would drift the first time the graadklas decision (Art. XIV) changes one of them.
/// </para>
/// <para>
/// Read-only reference data with no dependencies, so it is served straight from the domain constant rather than
/// through a service (Art. VIII keeps the Api thin; there is no logic here to put anywhere else).
/// </para>
/// </summary>
[ApiController]
[Route("api/jaarfasen")]
public sealed class JaarfasenController : ControllerBase
{
    /// <summary>Every jaar/fase a klas may teach, coarse to fine: the three kleuter jaren then the six leerjaren.</summary>
    [HttpGet]
    public ActionResult<IReadOnlyList<string>> Lijst() => Ok(Jaarfasen.Alle);
}
