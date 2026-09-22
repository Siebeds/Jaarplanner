namespace Jaarplanner.Domain.Kat;

/// <summary>
/// What the cat noticed (TB-057, ADR-0059 K7). The vocabulary, not the detection: each soort's rule lives in the
/// detector that produces it, and every one of them is derived without AI (K1, D2).
/// <para>
/// <b>The vervanging soorten are not here yet.</b> ADR-0059 K7 also names a started vervanging and the
/// lesvoorbereidingen it makes ready, but a <c>Vervanging</c> does not exist in the model (FB-063, FB-068 are not
/// built), so no detector could produce them. They join this enum with the feature that produces them.
/// </para>
/// </summary>
public enum Signaalsoort
{
    /// <summary>
    /// A minimumdoel of the klas's mijlpaal is in the dekkingsprognose, not gedekt, and the free lesweken left are
    /// fewer than the shortest thema that carries it as themadoel needs (FB-069, ADR-0059 D4).
    /// </summary>
    MinimumdoelInGevaar,

    /// <summary>
    /// A thema's placement in the klas ends within five schooldagen while a subthema of it, at the klas's leeftijd,
    /// is not in the agenda (FB-069, ADR-0059 D4). A gepland-gat (Art. XII).
    /// </summary>
    SubthemaNietGepland,

    /// <summary>
    /// A thema starts in the klas within five schooldagen and a discipline of its jaarfase has an aanbod-gat: goals
    /// in no dekkingsprognose of the klas at all (FB-070, ADR-0060). The one soort that goes on to ask the AI.
    /// </summary>
    Aanbodgat,
}
