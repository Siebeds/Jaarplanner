using System.ComponentModel;
using System.Diagnostics;

namespace Jaarplanner.Eval;

/// <summary>
/// Keeps real evaluation data out of git. This repository is public, and a report quotes a school's own content, so the
/// runner refuses to write inside the repo unless git ignores the place (TB-004, AC4).
/// </summary>
internal static class RepoGuard
{
    /// <summary>The repo root: the nearest folder upwards from <paramref name="start"/> that holds <c>global.json</c>.</summary>
    internal static string? FindRepoRoot(string start)
    {
        for (var folder = new DirectoryInfo(start); folder is not null; folder = folder.Parent)
        {
            if (File.Exists(Path.Combine(folder.FullName, "global.json")))
            {
                return folder.FullName;
            }
        }

        return null;
    }

    /// <summary>Whether <paramref name="path"/> lies inside <paramref name="root"/>.</summary>
    internal static bool IsInside(string root, string path)
    {
        var fullRoot = Path.TrimEndingDirectorySeparator(Path.GetFullPath(root)) + Path.DirectorySeparatorChar;
        return Path.GetFullPath(path).StartsWith(fullRoot, StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>Whether git ignores <paramref name="path"/>; null when git could not answer.</summary>
    internal static bool? IsIgnored(string root, string path) =>
        RunGit(root, "check-ignore", "-q", "--", Relative(root, path)) switch
        {
            0 => true,
            1 => false,
            _ => null,
        };

    /// <summary>Whether git tracks <paramref name="path"/> (such a file is in the public repo already).</summary>
    internal static bool IsTracked(string root, string path) =>
        RunGit(root, "ls-files", "--error-unmatch", "--", Relative(root, path)) == 0;

    private static string Relative(string root, string path) =>
        Path.GetRelativePath(root, Path.GetFullPath(path)).Replace('\\', '/');

    private static int RunGit(string root, params string[] arguments)
    {
        var start = new ProcessStartInfo("git")
        {
            WorkingDirectory = root,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
        };
        foreach (var argument in arguments)
        {
            start.ArgumentList.Add(argument);
        }

        try
        {
            using var process = Process.Start(start);
            if (process is null)
            {
                return -1;
            }

            process.StandardOutput.ReadToEnd();
            process.StandardError.ReadToEnd();
            return process.WaitForExit(TimeSpan.FromSeconds(10)) ? process.ExitCode : -1;
        }
        catch (Win32Exception)
        {
            // No git on the PATH: the answer is unknown, and the caller treats unknown as "not ignored".
            return -1;
        }
    }
}
