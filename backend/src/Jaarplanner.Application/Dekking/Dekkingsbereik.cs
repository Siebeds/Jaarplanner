namespace Jaarplanner.Application.Dekking;

/// <summary>
/// Which leerplandoelen a class's coverage is measured against (E5-02, owner ruling 2026-08-04).
/// <para>
/// <b>This is the Art. XIV question "waartegen wordt een klas gemeten?" answered for the single-leerjaar case,
/// and left open for the rest.</b> E5-01 shipped the computation with no scope at all and recorded that as the
/// only available answer rather than a considered one: a K3 class was measured against every L1–L6 goal, every
/// discipline and the illustrative doelsoorten. The owner ruled on 2026-08-04 that a class is measured against
/// its own jaar/fase by default, with the whole curriculum available as a switch.
/// </para>
/// <para>
/// <b>What the ruling does not settle:</b> a graadklas / menggroep spanning several leerjaren. <c>Klas.Leerjaar</c>
/// is one ordinal, so such a class cannot state its own set and this enum cannot express it. That half of the Art.
/// XIV decision stays open, and <see cref="EigenJaarFase"/> degrades honestly rather than guessing:
/// see <c>DekkingWeergave.IsTerugvalNaarHeelCurriculum</c>.
/// </para>
/// <para>
/// Shaped as a caller's choice rather than a configuration value, deliberately. Both answers are legitimate at
/// different moments: a teacher planning L3 wants L3, and a directie proving coverage to the onderwijsinspectie
/// wants to see what the school loaded. A setting would make one of them wrong for somebody.
/// </para>
/// </summary>
public enum Dekkingsbereik
{
    /// <summary>
    /// The jaar/fase codes derived from the class's own <c>Leerjaar</c> (<c>Jaarfasen.VoorLeerjaar</c>). The default:
    /// it is what makes "niet gedekt" mean "dit mis ik" rather than "dit hoort bij een ander leerjaar".
    /// </summary>
    EigenJaarFase = 0,

    /// <summary>
    /// Every loaded leerplandoel, unscoped: E5-01's original behaviour, kept as the deliberate escape hatch rather
    /// than as a default. It is also the honest fallback when a class's jaar/fase cannot be derived.
    /// </summary>
    HeelCurriculum = 1,
}
