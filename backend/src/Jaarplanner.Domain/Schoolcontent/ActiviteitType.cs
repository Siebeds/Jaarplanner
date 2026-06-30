namespace Jaarplanner.Domain.Schoolcontent;

/// <summary>
/// The form of an <see cref="Activiteit"/> — the palette of "rijk aanbod" activity types the
/// school uses inside a kennisrijk thema (Art. IX.2, glossary). The list mirrors the examples
/// in Art. IX.2 and the glossary's "rijk aanbod / activiteittype"; it is open to extension but
/// stays a closed enum so the value is legible and filterable. Persisted by name (see the EF
/// configuration) so adding a member does not renumber existing rows.
/// </summary>
public enum ActiviteitType
{
    /// <summary>experiment — a hands-on experiment.</summary>
    Experiment = 0,

    /// <summary>prentenboek — a picture-book reading activity.</summary>
    Prentenboek = 1,

    /// <summary>hoek — work in a learning corner (see <see cref="Activiteit.Hoek"/>).</summary>
    Hoek = 2,

    /// <summary>uitstap — a field trip / excursion.</summary>
    Uitstap = 3,

    /// <summary>spel — a (learning) game.</summary>
    Spel = 4,

    /// <summary>waarneming — an observation activity.</summary>
    Waarneming = 5,

    /// <summary>beweging — a movement activity.</summary>
    Beweging = 6,

    /// <summary>onderzoek — an inquiry / research activity.</summary>
    Onderzoek = 7,
}
