namespace Jaarplanner.Application.Schoolcontent.Beheer;

/// <summary>
/// Thrown when a school-content CRUD request targets an entity that does not exist (or does not exist
/// within the requested parent scope). The (thin) Api maps this to a 404 so it never has to know the
/// store internals (Art. VIII). The message is Dutch domain language for direct surfacing.
/// </summary>
public sealed class SchoolcontentNietGevondenFout : Exception
{
    public SchoolcontentNietGevondenFout(string message)
        : base(message)
    {
    }
}

/// <summary>
/// Thrown when a school-content CRUD request is structurally invalid — e.g. a subthema without a
/// klas/leeftijd scope (Art. IX.2), a goal link to an unknown leerplandoel code (Art. III.5), or a
/// 4th themadoel (Art. IX.2). The (thin) Api maps this to a 400.
/// </summary>
public sealed class SchoolcontentValidatieFout : Exception
{
    public SchoolcontentValidatieFout(string message)
        : base(message)
    {
    }
}
