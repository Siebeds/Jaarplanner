using Jaarplanner.Api.Infrastructure.Authenticatie;
using Jaarplanner.Api.Infrastructure.Autorisatie;
using Jaarplanner.Application.Kat.Chat;
using Jaarplanner.Application.Planning.Beheer;
using Jaarplanner.Application.Toegang;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Jaarplanner.Api.Controllers;

/// <summary>
/// A question to the cat, the schooljaar the gebruiker is looking at, whose klassen the agenda answer covers, and the
/// sealed turns of the conversation so far, oldest first (FB-093). Its text never leaves through
/// <see cref="ToString"/>: the framework writes an action's arguments to its trace log that way, and no chat content may
/// reach a log (ADR-0059 D6).
/// </summary>
public sealed record Katchatvraag(string Vraag, Guid? SchooljaarId, IReadOnlyList<Katbeurt>? Gesprek = null)
{
    public override string ToString() => nameof(Katchatvraag);
}

/// <summary>
/// A lookup run again with the candidate the gebruiker picked, and <see cref="Vraag"/>, what her turn shows for it, so
/// the answer can carry a sealed turn. Its terms stay out of a log like a question.
/// </summary>
public sealed record Katchatopzoeking(Katopzoeking Opzoeking, Guid? SchooljaarId, string? Vraag = null)
{
    public override string ToString() => nameof(Katchatopzoeking);
}

/// <summary>
/// Thin REST controller (Art. VIII) for the cat's chat (FB-031, ADR-0066). Both routes are POST so the question never
/// lands in a URL, a log line or a browser history, and neither writes anything (ADR-0059 D6).
/// <para>
/// <b>No policy, on purpose.</b> Every signed-in gebruiker may ask the cat; what an answer shows is filtered for her
/// here and in <see cref="Katopzoeker"/>: the klassen she may read go through the very policy every planning screen
/// uses (<see cref="Klasinzagefilter"/>), and her rights decide which own activiteiten she sees (Art. VI.1).
/// </para>
/// </summary>
[ApiController]
public sealed class KatchatController : ControllerBase
{
    private readonly IKatchatService _chat;
    private readonly IKlasBeheerService _klassen;
    private readonly IAuthorizationService _autorisatie;
    private readonly IRechtenService _rechten;

    public KatchatController(
        IKatchatService chat,
        IKlasBeheerService klassen,
        IAuthorizationService autorisatie,
        IRechtenService rechten)
    {
        _chat = chat;
        _klassen = klassen;
        _autorisatie = autorisatie;
        _rechten = rechten;
    }

    /// <summary>Answers one question: an explanation from the handleiding, or a lookup over the school's content.</summary>
    [HttpPost("api/kat/chat")]
    public async Task<ActionResult<Katantwoord>> Vraag([FromBody] Katchatvraag vraag, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(vraag.Vraag) || vraag.Vraag.Length > KatchatPromptBuilder.MaxVraagLengte)
        {
            return Problem(
                statusCode: StatusCodes.Status400BadRequest,
                detail: $"A question is required and holds at most {KatchatPromptBuilder.MaxVraagLengte} characters.");
        }

        if (await LezerAsync(vraag.SchooljaarId, cancellationToken) is not { } lezer)
        {
            return Forbid();
        }

        try
        {
            return Ok(await _chat.BeantwoordAsync(vraag.Vraag, lezer, vraag.Gesprek, cancellationToken));
        }
        catch (GesprekKloptNietFout fout)
        {
            // A forged or changed turn, or one sealed before a restart: the model saw nothing, and the frontend starts
            // the conversation again with its own sentence.
            return Problem(statusCode: StatusCodes.Status409Conflict, detail: fout.Message);
        }
    }

    /// <summary>Runs a lookup again with the picked candidate. The model is not called.</summary>
    [HttpPost("api/kat/chat/opzoeking")]
    public async Task<ActionResult<Katantwoord>> ZoekOp([FromBody] Katchatopzoeking opzoeking, CancellationToken cancellationToken)
    {
        if (opzoeking.Opzoeking is null || !opzoeking.Opzoeking.IsVolledig)
        {
            return Problem(statusCode: StatusCodes.Status400BadRequest, detail: "The lookup lacks a term it needs, or a term is too long.");
        }

        if (await LezerAsync(opzoeking.SchooljaarId, cancellationToken) is not { } lezer)
        {
            return Forbid();
        }

        return Ok(await _chat.ZoekOpAsync(opzoeking.Opzoeking, lezer, opzoeking.Vraag, cancellationToken));
    }

    // Her rights, and the klassen of the schooljaar she is looking at whose planning she may read. Without a schooljaar,
    // every klas she may read.
    private async Task<Katlezer?> LezerAsync(Guid? schooljaarId, CancellationToken cancellationToken)
    {
        if (Aanmelding.GebruikerId(User) is not { } gebruikerId)
        {
            return null;
        }

        var rechten = await _rechten.HaalRechtenOpAsync(gebruikerId, cancellationToken);
        var leesbaar = await _autorisatie.LeesbaarAsync(User, await _klassen.HaalKlassenOpAsync(cancellationToken));
        var klassen = leesbaar
            .Where(k => schooljaarId is null || k.SchooljaarId == schooljaarId)
            .Select(k => new Chatklas(k.Id, k.Naam))
            .ToList();
        return new Katlezer(rechten, klassen);
    }
}
