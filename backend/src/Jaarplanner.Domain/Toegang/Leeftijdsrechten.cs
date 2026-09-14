using Jaarplanner.Domain.Curriculum;

namespace Jaarplanner.Domain.Toegang;

/// <summary>
/// <b>The one place that maps a klas to the leeftijden it grants rights for</b> (Art. VI.1, ADR-0030 R22). A
/// klastoewijzing on a klas gives its leerkracht the "LK leeftijd" right on the shared content of these leeftijden.
/// <para>
/// <b>Provisional, and a seam on purpose</b> (Art. XIV, graadklassen). A klas states one jaarfase, so the leerkrachten
/// of a graadklas get that one jaarfase's rights, and a hoofdleerkracht or directie edits the other leeftijd's shared
/// content (R22). When directie decides the graadklas question, this method is what changes, and nothing else.
/// </para>
/// <para>
/// <b>The opposite failure direction from <c>Klasleeftijden</c>, deliberately not a reuse of it.</b> That helper
/// answers "which content does this klas plan and measure", and when it cannot tell it <b>widens</b>: every leeftijd,
/// or all three kleuter codes for leerjaar 0. That is the safe direction for a coverage figure and the unsafe one for
/// a right. This one reads the <b>stated</b> <c>Klas.Jaarfase</c> only, never the <c>Leerjaar</c> ordinal, and a klas
/// without a stated jaarfase grants <b>nothing</b> (ADR-0030 I12, a default): it fails closed.
/// </para>
/// </summary>
public static class Leeftijdsrechten
{
    /// <summary>
    /// The leeftijden a leerkracht of this klas holds the "LK leeftijd" right for: the klas's stated jaarfase when it
    /// is one of the nine codes, and otherwise none.
    /// </summary>
    /// <param name="gesteldeJaarfase">The klas's <c>Jaarfase</c> exactly as stored. Never derive it from the leerjaar.</param>
    public static IReadOnlyList<string> VoorKlas(string? gesteldeJaarfase)
    {
        var code = gesteldeJaarfase?.Trim();
        return Jaarfasen.IsBekend(code) ? [code!] : [];
    }
}
