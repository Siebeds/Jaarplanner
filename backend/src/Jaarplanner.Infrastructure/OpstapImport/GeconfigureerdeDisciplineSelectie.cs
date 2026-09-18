using Jaarplanner.Application.Curriculum.Import;
using Microsoft.Extensions.Options;

namespace Jaarplanner.Infrastructure.OpstapImport;

/// <summary>
/// Configuration-driven <see cref="IDisciplineSelectie"/> (Art. XIV seam, Art. VIII no-over-engineer):
/// it derives "is this discipline in scope?" entirely from <see cref="DisciplineSelectieOptions"/>,
/// which is bound from the <c>Opstap:DisciplineSelectie</c> configuration section. The directie sets
/// the scope in config; this class contains <b>no</b> compiled-in discipline list.
/// <para>
/// Behaviour is a pure function of configuration:
/// <list type="bullet">
/// <item><see cref="DisciplineSelectieModus.Alle"/> → every discipline is in scope.</item>
/// <item><see cref="DisciplineSelectieModus.Selectie"/> → only the configured
/// <see cref="DisciplineSelectieOptions.Disciplines"/> numbers are in scope.</item>
/// </list>
/// Changing the config flips the outcome with no code change — which is exactly the data-driven
/// guarantee this story requires.
/// </para>
/// </summary>
public sealed class GeconfigureerdeDisciplineSelectie : IDisciplineSelectie
{
    private readonly DisciplineSelectieModus _modus;
    private readonly HashSet<string> _disciplines;

    /// <summary>Constructs the selection from bound options (DI / options pattern).</summary>
    public GeconfigureerdeDisciplineSelectie(IOptions<DisciplineSelectieOptions> options)
        : this(options?.Value ?? throw new ArgumentNullException(nameof(options)))
    {
    }

    /// <summary>
    /// Constructs the selection directly from options — used by DI (above) and by tests that drive the
    /// selection purely from configuration values (proving the choice is data-driven, not compiled in).
    /// </summary>
    public GeconfigureerdeDisciplineSelectie(DisciplineSelectieOptions options)
    {
        ArgumentNullException.ThrowIfNull(options);

        _modus = options.Modus;
        // Trim/normalise the configured numbers; ordinal identity matches Discipline.Nummer.
        _disciplines = (options.Disciplines ?? [])
            .Where(d => !string.IsNullOrWhiteSpace(d))
            .Select(d => d.Trim())
            .ToHashSet(StringComparer.Ordinal);
    }

    /// <inheritdoc />
    public bool IsInScope(string disciplineNummer)
    {
        if (string.IsNullOrWhiteSpace(disciplineNummer))
        {
            return false;
        }

        return _modus switch
        {
            DisciplineSelectieModus.Alle => true,
            DisciplineSelectieModus.Selectie => _disciplines.Contains(disciplineNummer.Trim()),
            _ => false,
        };
    }

    /// <inheritdoc />
    public string Omschrijving =>
        _modus switch
        {
            DisciplineSelectieModus.Alle => "alle disciplines",
            DisciplineSelectieModus.Selectie => _disciplines.Count == 0
                ? "selectie: (geen disciplines geconfigureerd)"
                : $"selectie: {string.Join(", ", _disciplines.OrderBy(d => d, StringComparer.Ordinal))}",
            _ => "onbekende selectiemodus",
        };
}
