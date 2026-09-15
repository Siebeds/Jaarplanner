using Jaarplanner.Application.Schoolcontent.Beheer;
using Microsoft.AspNetCore.Mvc;

namespace Jaarplanner.Api.Controllers;

/// <summary>
/// Thin read controller (Art. VIII) for the doelen a thema reaches per leeftijd (FB-009). The computation is
/// <see cref="IThemaDoelenoverzichtQuery"/>'s. Reads stay open to every signed-in gebruiker, like the thema detail (I9); a
/// missing thema surfaces as the shared handler's 404.
/// </summary>
[ApiController]
[Route("api/themas/{themaId:guid}/doelenoverzicht")]
public sealed class ThemaDoelenoverzichtController : ControllerBase
{
    private readonly IThemaDoelenoverzichtQuery _query;

    public ThemaDoelenoverzichtController(IThemaDoelenoverzichtQuery query) => _query = query;

    [HttpGet]
    public async Task<ActionResult<ThemaDoelenoverzicht>> Lees(Guid themaId, CancellationToken cancellationToken) =>
        Ok(await _query.HaalOpAsync(themaId, cancellationToken));
}
