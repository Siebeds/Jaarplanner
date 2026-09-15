using Jaarplanner.Domain.Curriculum;

namespace Jaarplanner.Domain.Toegang;

/// <summary>
/// A gebruiker appointed hoofdleerkracht of one jaarfase for one schooljaar (Art. VI.1, ADR-0030 R5). Several may be
/// appointed for the same jaarfase and schooljaar; one gebruiker is appointed at most once per pair.
/// <para>
/// <b>It needs no klastoewijzing</b> (ADR-0030 I20): the appointment alone gives the right. It counts while its
/// schooljaar has not ended, including a schooljaar that has not started, so a hoofdleerkracht can prepare the next
/// year in June (R20). That is computed by the rights service from <c>Schooljaar.Eind</c>, not stored.
/// </para>
/// </summary>
public sealed class Hoofdleerkrachtaanstelling
{
    // EF Core materialisation only.
    private Hoofdleerkrachtaanstelling()
    {
        Jaarfase = null!;
    }

    /// <summary>Appoints <paramref name="gebruikerId"/> hoofdleerkracht of <paramref name="jaarfase"/> in a schooljaar.</summary>
    /// <param name="jaarfase">One of the nine jaar/fase codes (JK, K2, K3, L1–L6). Anything else is refused.</param>
    public Hoofdleerkrachtaanstelling(Guid gebruikerId, Guid schooljaarId, string jaarfase)
    {
        if (gebruikerId == Guid.Empty)
        {
            throw new ArgumentException("'gebruikerId' is required.", nameof(gebruikerId));
        }

        if (schooljaarId == Guid.Empty)
        {
            throw new ArgumentException("'schooljaarId' is required.", nameof(schooljaarId));
        }

        // The rule a klas's jaarfase obeys, so an appointment and a subthema's leeftijd speak the same nine codes.
        var mis = Jaarfasen.WatIsErMisMet(jaarfase);
        if (mis is not null)
        {
            throw new ArgumentException(mis, nameof(jaarfase));
        }

        GebruikerId = gebruikerId;
        SchooljaarId = schooljaarId;
        Jaarfase = jaarfase.Trim();
    }

    /// <summary>Surrogate identity, assigned here because no Guid key in this model is store-generated.</summary>
    public Guid Id { get; private set; } = Guid.NewGuid();

    /// <summary>The hoofdleerkracht. Removing the gebruiker removes the appointment.</summary>
    public Guid GebruikerId { get; private set; }

    /// <summary>The schooljaar the appointment is for. Removing the schooljaar removes the appointment.</summary>
    public Guid SchooljaarId { get; private set; }

    /// <summary>The jaarfase whose subthema's, subdoelen and goal links the hoofdleerkracht holds (R5, R19, R21, R24).</summary>
    public string Jaarfase { get; private set; }
}
