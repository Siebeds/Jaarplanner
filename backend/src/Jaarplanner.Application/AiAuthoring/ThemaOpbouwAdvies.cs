namespace Jaarplanner.Application.AiAuthoring;

/// <summary>
/// One <b>advisory</b> authoring suggestion (E2-07, Art. IV.1/IV.8): a candidate Op.stap
/// leerplandoel the AI proposes as a themadoel (step 2) or subdoel (step 6), enriched with the
/// read-only curriculum content the wizard needs to show it. It is <b>transient</b> — deliberately
/// not a persisted <c>DoelKoppeling</c>: the assist never auto-creates a themadoel/subdoel
/// (Art. IV.2). The wizard shows the candidate + <see cref="Motivatie"/>; only on teacher accept is
/// it persisted (as <c>voorgesteld</c>/<c>manueel</c>) via the beheer endpoints (E1/E6).
/// <para>
/// The <see cref="Code"/> always resolves to a real loaded leerplandoel — a code the model returns
/// that is not in the loaded set is never turned into an advies (it is reported as skipped instead),
/// so nothing is fabricated (Art. III.5/IV.4). The enrichment fields are copied verbatim from that
/// read-only leerplandoel; they are not mutated (Art. III.1).
/// </para>
/// </summary>
public sealed record ThemaOpbouwAdvies
{
    /// <summary>The suggested leerplandoel's unique code — the stable identity the wizard persists on accept (Art. III.5).</summary>
    public required string Code { get; init; }

    /// <summary>The AI's short, one-line motivation ("waarom past dit doel hier?", Art. IV.3).</summary>
    public required string Motivatie { get; init; }

    /// <summary>The read-only leerplandoel text (Art. III.1) — shown to the teacher for review.</summary>
    public required string Tekst { get; init; }

    /// <summary>The doelsoort code (MD/G/+/P/S/A) of the suggested leerplandoel.</summary>
    public required string Doelsoort { get; init; }

    /// <summary>The jaar/fase of the suggested leerplandoel.</summary>
    public required string JaarFase { get; init; }
}
