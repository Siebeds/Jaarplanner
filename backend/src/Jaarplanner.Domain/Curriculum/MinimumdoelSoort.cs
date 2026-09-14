namespace Jaarplanner.Domain.Curriculum;

/// <summary>
/// The kind of a decreed minimumdoel, as the decree distinguishes them and KOV's onderwijsdoelen endpoint publishes them
/// in <c>type</c> (TB-010). Decreed content like the text (Art. III.1): only the minimumdoelen import writes it.
/// </summary>
public enum MinimumdoelSoort
{
    /// <summary>KOV: "Te bereiken minimumdoelen op individueel niveau".</summary>
    TeBereikenIndividueel,

    /// <summary>KOV: "Te bereiken minimumdoelen op populatieniveau".</summary>
    TeBereikenPopulatie,

    /// <summary>KOV: "Na te streven minimumdoelen op populatieniveau".</summary>
    NaTeStreven,
}
