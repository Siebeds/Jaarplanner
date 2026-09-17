namespace Jaarplanner.Domain.Planning;

/// <summary>
/// What kind of closure a <see cref="Schoolsluiting"/> is — and therefore whether it <b>ends a planning
/// period</b> or is merely a day off inside one.
/// <para>
/// This distinction exists because the two are pedagogically different, not because of any arithmetic
/// threshold. A school year is interrupted both by real vacations (herfst, kerst, krokus, paas) and by
/// scattered single free days (Hemelvaart, Pinkstermaandag, een pedagogische studiedag, een facultatieve
/// vrije dag). Treating all of them as period boundaries fragments the grid: the 5 days between Hemelvaart
/// and Pinksteren would become a one-week "themaperiode", which no teacher can plan a thema into.
/// </para>
/// <para>
/// Directie ruling (2026-07-28): the school classifies each closure when it enters the calendar. That keeps
/// the answer in <b>data the school owns</b> rather than in an invented threshold ("interruptions of ≤ 3 days
/// don't count") compiled into planning logic — and it makes the rule "a vakantie splits a thema,
/// a free day does not" (ADR-0053) exactly true instead of approximately true.
/// </para>
/// </summary>
public enum Sluitingssoort
{
    /// <summary>
    /// A real school vacation. <b>Splits a thema:</b> a placement is stored in parts around it
    /// (ADR-0053).
    /// </summary>
    Vakantie = 0,

    /// <summary>
    /// A single free day or short bridge — Hemelvaart, Pinkstermaandag, a pedagogische studiedag, a
    /// facultatieve vrije dag. <b>Does not split a thema:</b> it is a non-teaching day <i>inside</i> a
    /// placement.
    /// </summary>
    VrijeDag = 1,
}
