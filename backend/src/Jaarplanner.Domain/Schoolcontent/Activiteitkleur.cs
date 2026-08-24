namespace Jaarplanner.Domain.Schoolcontent;

/// <summary>
/// A colour a teacher may put on an <see cref="Activiteit"/> to organise their own week.
///
/// <para>
/// <b>This is a label, not a signal, and the distinction is what keeps it inside Art. XII.</b> The
/// six doelsoort hues, the four suggestiestatus hues and the two dekking hues all mean something the
/// application decided; this means whatever the teacher decided, and nothing the application reads.
/// So it is rendered as a pale surface wash rather than as a saturated dot or badge, which puts it in
/// a different visual channel from every hue that carries meaning. Its name always appears with it:
/// colour alone is never the carrier (Art. XII, WCAG 2.2 AA).
/// </para>
/// <para>
/// Six, deliberately, and no more: a teacher sorting a week needs categories they can tell apart at a
/// glance, and a longer list produces neighbours nobody can distinguish. Null is the normal state.
/// </para>
/// <para>
/// Not written by the Excel import. The import's overwrite path deliberately leaves this alone
/// (Art. IV.2): the workbook has no colour column, so an import that set it would be an import that
/// erased a teacher's choice.
/// </para>
/// </summary>
public enum Activiteitkleur
{
    /// <summary>klei — a warm muted terracotta.</summary>
    Klei = 0,

    /// <summary>olijf — a muted yellow-green.</summary>
    Olijf = 1,

    /// <summary>zee — a muted blue-green, distinct from the chrome accent by saturation.</summary>
    Zee = 2,

    /// <summary>indigo — a muted blue-violet.</summary>
    Indigo = 3,

    /// <summary>pruim — a muted red-violet.</summary>
    Pruim = 4,

    /// <summary>zand — a muted warm neutral.</summary>
    Zand = 5,
}
