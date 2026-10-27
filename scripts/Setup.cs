using System;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Windows.Forms;

internal static class Setup
{
    [STAThread]
    private static int Main(string[] args)
    {
        Application.EnableVisualStyles();
        bool testInstall = args.Length == 4 && args[0] == "--test-install";
        string testResult = testInstall ? Path.GetFullPath(args[3]) : null;
        string temporary = Path.Combine(Path.GetTempPath(), "CodexLiquidGlassSetup-" + Guid.NewGuid().ToString("N"));
        try
        {
            Directory.CreateDirectory(temporary);
            string payload = Path.Combine(temporary, "payload.zip");
            using (Stream input = Assembly.GetExecutingAssembly().GetManifestResourceStream("payload.zip"))
            using (FileStream output = File.Create(payload))
            {
                if (input == null) throw new InvalidOperationException("The installer payload is missing.");
                input.CopyTo(output);
            }
            ZipFile.ExtractToDirectory(payload, temporary);
            string script = Path.Combine(temporary, "Install.ps1");
            string powerShell = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Windows), "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
            string outputPath = Path.Combine(temporary, "result.txt");
            string runner = Path.Combine(temporary, "Run-Setup.ps1");
            string installArguments = " -NoLaunch";
            if (testInstall) installArguments += " -NoShortcut -SkipPrerequisiteDownload -SourceAppPath '" + Path.GetFullPath(args[1]).Replace("'", "''") + "' -InstallRoot '" + Path.GetFullPath(args[2]).Replace("'", "''") + "'";
            File.WriteAllText(runner, "$ErrorActionPreference='Stop'\r\ntry { & '" + script.Replace("'", "''") + "'" + installArguments + " *>&1 | Out-String | Set-Content -LiteralPath '" + outputPath.Replace("'", "''") + "'; exit 0 } catch { $_.Exception.Message | Set-Content -LiteralPath '" + outputPath.Replace("'", "''") + "'; exit 1 }\r\n");
            Form progress = testInstall ? null : new Form();
            if (progress != null) {
            progress.Text = "Installing Codex Liquid Glass";
            progress.Width = 500; progress.Height = 150;
            progress.StartPosition = FormStartPosition.CenterScreen;
            progress.FormBorderStyle = FormBorderStyle.FixedDialog;
            progress.MaximizeBox = false; progress.MinimizeBox = false; progress.ControlBox = false;
            Label label = new Label(); label.Left = 20; label.Top = 18; label.Width = 450; label.Height = 45;
            label.Text = "Checking compatibility and preparing your local copy.\r\nThis can take a few minutes. Your official app stays available.";
            ProgressBar bar = new ProgressBar(); bar.Left = 20; bar.Top = 75; bar.Width = 445; bar.Style = ProgressBarStyle.Marquee;
            progress.Controls.Add(label); progress.Controls.Add(bar); progress.Show();
            }
            ProcessStartInfo start = new ProcessStartInfo(powerShell, "-NoLogo -NoProfile -ExecutionPolicy Bypass -File \"" + runner + "\"");
            start.UseShellExecute = false; start.CreateNoWindow = true; start.WindowStyle = ProcessWindowStyle.Hidden;
            start.EnvironmentVariables.Remove("PSModulePath");
            int exitCode;
            using (Process process = Process.Start(start))
            {
                while (!process.WaitForExit(100)) Application.DoEvents();
                exitCode = process.ExitCode;
            }
            if (progress != null) { progress.Close(); progress.Dispose(); }
            string result = File.Exists(outputPath) ? File.ReadAllText(outputPath).Trim() : "No installer details were returned.";
            if (testInstall) { File.WriteAllText(testResult, result); return exitCode; }
            if (exitCode != 0)
            {
                MessageBox.Show("Installation could not finish.\r\n\r\n" + result, "Codex Liquid Glass", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return exitCode;
            }
            if (MessageBox.Show("Codex Liquid Glass is installed.\r\n\r\nUse the desktop or Start menu shortcut. Sign in if prompted.\r\nOpen Settings > Appearance to adjust the glass.\r\n\r\nLaunch it now?", "Codex Liquid Glass", MessageBoxButtons.YesNo, MessageBoxIcon.Information) == DialogResult.Yes)
            {
                string launch = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "CodexLiquidGlass", "Launch.ps1");
                ProcessStartInfo run = new ProcessStartInfo(powerShell, "-NoProfile -ExecutionPolicy Bypass -File \"" + launch + "\"");
                run.UseShellExecute = false; run.CreateNoWindow = true; run.WindowStyle = ProcessWindowStyle.Hidden;
                run.EnvironmentVariables.Remove("PSModulePath");
                Process.Start(run);
            }
            return 0;
        }
        catch (Exception error)
        {
            if (testInstall) File.WriteAllText(testResult, error.ToString());
            else MessageBox.Show(error.Message, "Codex Liquid Glass setup", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return 1;
        }
        finally
        {
            try {
                string resolved = Path.GetFullPath(temporary).TrimEnd(Path.DirectorySeparatorChar);
                string expected = Path.GetFullPath(Path.GetTempPath()).TrimEnd(Path.DirectorySeparatorChar);
                if (String.Equals(Path.GetDirectoryName(resolved), expected, StringComparison.OrdinalIgnoreCase) && Path.GetFileName(resolved).StartsWith("CodexLiquidGlassSetup-", StringComparison.Ordinal) && Directory.Exists(resolved)) Directory.Delete(resolved, true);
            } catch { }
        }
    }
}
