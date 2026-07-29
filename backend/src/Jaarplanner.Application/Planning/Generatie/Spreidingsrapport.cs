using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;

namespace Jaarplanner.Application.Planning.Generatie;

/// <summary>
/// A <b>measured</b> description of how a generated plan is spread over the school year (E3-02, FR-5.2).
/// <para>
/// <b>Why this exists at all.</b> FR-5.2's three properties — respect the number of available blocks, keep a
/// logical order, distribute the leerdoelen evenly — are asked of the model in the prompt. But a prompt is a
/// request, not a guarantee, and the AI client is injectable precisely so tests can run without a model
/// (Art. IV.6): with a faked client, "the model spreads well" is <b>unfalsifiable</b>. So the story's claim is
/// split in two. The prompt asks; this report measures what actually came back, deterministically, from the
/// persisted plan and the derived grid. That half is testable, and it is the half a teacher can act on.
/// </para>
/// <para>
/// <b>Advisory, never enforcement</b> (Art. IV.1/IV.2). Nothing here rejects a placement, reorders one or
/// refuses a run. A badly spread proposal is still returned in full, with the imbalance stated, because the
/// teacher decides. An earlier sketch had generation retry until the spread passed a threshold; that would
/// have made the tool the decider and buried a model weakness behind a loop.
/// </para>
/// <para>
/// <b>It is a fact, not a score.</b> There is no single "spreading quality" number, because nothing in the
/// functional analysis or the constitution defines an acceptable spread, and inventing a threshold here would
/// answer by code a question that belongs to the school — the same mistake as hard-coding a "te vol" limit
/// (E3-10 question C, still open). Counts and named outliers let a human judge; a green tick would pretend the
/// judgement was already made.
/// </para>
/// </summary>
/// <param name="AantalBlokken">Blocks the year offers at the generation tier — the denominator for FR-5.2's
/// "respect the number of available blocks".</param>
/// <param name="AantalGebruikteBlokken">How many of them hold at least one placement.</param>
/// <param name="Blokken">Per-block detail, chronological, including the blocks that hold nothing.</param>
public sealed record Spreidingsrapport(
    int AantalBlokken,
    int AantalGebruikteBlokken,
    IReadOnlyList<BlokspreidingWeergave> Blokken)
{
    /// <summary>Blocks holding no placement at all. Empty periods are legitimate; concentration is the signal.</summary>
    public IReadOnlyList<int> LegeBlokOrdinalen =>
        Blokken.Where(b => b.AantalThemas == 0).Select(b => b.Ordinaal).ToList();

    /// <summary>
    /// Blocks whose placed thema's need more weeks than the block spans — FR-5.2's "respect the number of
    /// available blocks" in its most concrete form. See <see cref="BlokspreidingWeergave.IsOverbelast"/> for
    /// why this is computed from the thema's own <c>DuurWeken</c> rather than a count.
    /// </summary>
    public IReadOnlyList<int> OverbelasteBlokOrdinalen =>
        Blokken.Where(b => b.IsOverbelast).Select(b => b.Ordinaal).ToList();

    /// <summary>
    /// Fewest goals carried by any <b>used</b> block, or 0 when nothing is placed. With
    /// <see cref="MeesteDoelenInEenBlok"/> this is the whole of the "evenwichtige verdeling" claim: a wide gap
    /// between them is an uneven year. Deliberately two plain numbers rather than a variance — a teacher can
    /// read "3 tegenover 24" and decide; a standard deviation would need a threshold nobody has set.
    /// </summary>
    public int MinsteDoelenInEenBlok =>
        Blokken.Where(b => b.AantalThemas > 0).Select(b => b.AantalDoelen).DefaultIfEmpty(0).Min();

    /// <summary>Most goals carried by any used block; see <see cref="MinsteDoelenInEenBlok"/>.</summary>
    public int MeesteDoelenInEenBlok =>
        Blokken.Where(b => b.AantalThemas > 0).Select(b => b.AantalDoelen).DefaultIfEmpty(0).Max();

    /// <summary>
    /// Measures a plan against the grid it was placed on.
    /// </summary>
    /// <param name="plaatsingen">
    /// The plan's placements. Stale ones (a <c>BlokStart</c> matching no current block) are <b>excluded</b>: they
    /// sit in no period, so counting them would attribute goals to a block that does not hold them. They are
    /// already surfaced as <c>IsVervallen</c> on the plan view, so nothing is hidden by leaving them out here.
    /// </param>
    /// <param name="blokken">The derived grid at the generation tier.</param>
    /// <param name="themaPerId">The placed thema's, for their duration and their goal codes.</param>
    /// <param name="schooljaar">
    /// The year the blocks were derived from, used only to measure each block in <b>open days</b> via
    /// <see cref="Schooljaar.TelOpenDagen"/>. Required rather than optional: this used to divide the raw
    /// calendar span by 7, while the kalender sized and labelled the same block in open days, so the two
    /// screens disagreed about how long a period was and a thema could be called "fitting" a period the
    /// ribbon beside it described as shorter (E3-02 code review).
    /// </param>
    public static Spreidingsrapport Meet(
        IEnumerable<Themaplaatsing> plaatsingen,
        IReadOnlyCollection<Planningsblok> blokken,
        IReadOnlyDictionary<Guid, Thema> themaPerId,
        Schooljaar schooljaar)
    {
        ArgumentNullException.ThrowIfNull(plaatsingen);
        ArgumentNullException.ThrowIfNull(blokken);
        ArgumentNullException.ThrowIfNull(themaPerId);
        ArgumentNullException.ThrowIfNull(schooljaar);

        var perBlokStart = plaatsingen
            .GroupBy(p => p.BlokStart)
            .ToDictionary(g => g.Key, g => g.ToList());

        var detail = blokken
            .OrderBy(b => b.Start)
            .Select(blok => BouwBlokspreiding(blok, perBlokStart, themaPerId, schooljaar))
            .ToList();

        return new Spreidingsrapport(
            AantalBlokken: detail.Count,
            AantalGebruikteBlokken: detail.Count(b => b.AantalThemas > 0),
            Blokken: detail);
    }

    private static BlokspreidingWeergave BouwBlokspreiding(
        Planningsblok blok,
        IReadOnlyDictionary<DateOnly, List<Themaplaatsing>> perBlokStart,
        IReadOnlyDictionary<Guid, Thema> themaPerId,
        Schooljaar schooljaar)
    {
        var inBlok = perBlokStart.TryGetValue(blok.Start, out var lijst) ? lijst : [];

        var themas = inBlok
            .Select(p => themaPerId.TryGetValue(p.ThemaId, out var thema) ? thema : null)
            .Where(t => t is not null)
            .Select(t => t!)
            .ToList();

        // Goals are counted DISTINCT across the block: two thema's in one period may share a leerplandoel, and
        // counting it twice would overstate what that period covers (Art. V.1 — dekking is about the doel being
        // taught, not about how many thema's mention it).
        var doelcodes = themas
            .SelectMany(JaarplanGeneratiePromptBuilder.ThemaDoelcodes)
            .Distinct(StringComparer.Ordinal)
            .Count();

        var benodigdeWeken = themas.Sum(t => t.DuurWeken);

        // Open days, NOT the calendar span — the same basis the kalender sizes and labels blocks with, so the
        // overload check and the "N,N weken" on screen can never contradict each other.
        var blokWeken = schooljaar.TelOpenDagen(blok.Start, blok.Eind) / 7.0;

        return new BlokspreidingWeergave(
            Ordinaal: blok.Ordinaal,
            Start: blok.Start,
            AantalThemas: inBlok.Count,
            AantalDoelen: doelcodes,
            BenodigdeWeken: benodigdeWeken,
            BeschikbareWeken: Math.Round(blokWeken, 1));
    }
}

/// <summary>One block's share of the plan.</summary>
/// <param name="Ordinaal">The block's display position ("periode 3").</param>
/// <param name="Start">The block's start date — the key placements are matched on (ADR-0020 §3).</param>
/// <param name="AantalThemas">Placements sitting in this block.</param>
/// <param name="AantalDoelen">Distinct leerplandoelen carried by those thema's.</param>
/// <param name="BenodigdeWeken">Sum of the placed thema's <c>DuurWeken</c>.</param>
/// <param name="BeschikbareWeken">The block's own span in weeks, to one decimal.</param>
public sealed record BlokspreidingWeergave(
    int Ordinaal,
    DateOnly Start,
    int AantalThemas,
    int AantalDoelen,
    int BenodigdeWeken,
    double BeschikbareWeken)
{
    /// <summary>
    /// <c>true</c> when the placed thema's need more weeks than this block spans.
    /// <para>
    /// Computed from each thema's own <c>DuurWeken</c> rather than from a count of thema's, because a count
    /// cannot distinguish three two-week thema's (which fit a 6-week period comfortably) from two six-week ones
    /// (which do not). This is also why it is <b>not</b> the same signal as the kalender's provisional "te vol"
    /// threshold: that one counts thema's and is an open review question, this one is arithmetic on data the
    /// school supplied.
    /// </para>
    /// </summary>
    public bool IsOverbelast => BenodigdeWeken > BeschikbareWeken;
}
