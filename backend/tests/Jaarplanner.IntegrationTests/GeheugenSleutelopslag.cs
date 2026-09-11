using System.Xml.Linq;
using Microsoft.AspNetCore.DataProtection.Repositories;

namespace Jaarplanner.IntegrationTests;

/// <summary>
/// Keeps a test host's Data Protection keys in memory (E6-01). The real key manager runs, creates its key and
/// protects cookies with it; only the place it keeps the key differs from production, which is the database.
/// <para>
/// <b>Why a repository and not the ephemeral provider.</b> The ephemeral provider replaces what protects a cookie,
/// but Data Protection's own hosted service still reads the configured key ring at startup, so a host that inherits
/// the developer's user-secrets still queried <c>data_protection_keys</c> in their own development database. On a
/// database where that table exists, the key manager would have written a key there. Replacing the repository closes
/// both the read and the write.
/// </para>
/// </summary>
internal sealed class GeheugenSleutelopslag : IXmlRepository
{
    private readonly List<XElement> _sleutels = [];
    private readonly Lock _slot = new();

    public IReadOnlyCollection<XElement> GetAllElements()
    {
        lock (_slot)
        {
            return _sleutels.Select(sleutel => new XElement(sleutel)).ToList();
        }
    }

    public void StoreElement(XElement element, string friendlyName)
    {
        lock (_slot)
        {
            _sleutels.Add(new XElement(element));
        }
    }
}
