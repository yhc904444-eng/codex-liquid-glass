# Frosted Glass

Frosted Glass (formerly Codex Liquid Glass) is an independent appearance customization for the **OpenAI Codex desktop app on Windows**.
The customization brings a continuous acrylic window, translucent workspace,
glass composer, settings panels, peeking sidebars, menus, tooltips, and hover popovers. Adjust
tint, edge highlights, workspace transparency, composer transparency, and
additional blur in **Settings > Appearance**. Changes apply immediately and
are saved on your computer.

The project builds a separate local copy from a compatible
official installation. OpenAI application binaries and personal data are not
included in this repository or its downloads.

## Install

Existing 1.1.0 release assets, shortcuts, and installation paths retain the
**Codex Liquid Glass** name. Use those names when following the steps below.

1. Use **Windows 11 22H2 or newer, x64**. Allow approximately **5 GB of free
   disk space** for the separate client copy and temporary installation files.
2. Download **Codex-Liquid-Glass-1.1.0-Setup.exe** from this repository's
   Releases page and open it. No Node.js, npm, Python, build tools, or manual
   code changes are required. The installer runs for your Windows account;
   it does not request administrator access.
3. Open **Codex Liquid Glass** from the desktop or Start menu and sign in if
   prompted. Open **Settings > Appearance** for the glass controls.

If the official app is missing, setup downloads its Windows package directly
from OpenAI, verifies its publisher signature, and installs it for your
account. An internet connection is required for that step and normal Codex
sign-in/use. Your account must have access to Codex.

The installer is unsigned. Windows SmartScreen may ask you to confirm that
you trust a community download. Organization policies that forbid unsigned
applications or local application modifications can prevent installation.

The ZIP alternative contains the same installer scripts. Extract it and
double-click **Install.cmd**.

Version **1.1.0** extends glass to the sidebar that appears when hovering over
the navigation rail. Floating menus and dialogs share the same material,
including search dialog corners and nested panels. To upgrade from 1.0.0,
fully exit Liquid Glass, uninstall the old customized copy, then run the new
installer. The isolated profile and saved glass preferences are retained.

## Compatibility

| Official Store package | Application version | Windows architecture |
| --- | --- | --- |
| 26.1021.3705.0 | 26.1021.31345 | x64 |
| 26.1016.8622.0 | 26.1016.62342 | x64 |

Compatibility is checked against the original archive's SHA256 and the
expected integration points before any local copy is modified. Future Codex
updates may need a new Frosted Glass release. An unsupported version produces
a clear error. Do not downgrade a working official client to force a match.
The automatic prerequisite download always fetches OpenAI's latest version,
which may be newer than this release supports.

The original official installation remains available and receives its normal
updates. The customized copy is fixed to the compatible version used during
installation. To update it, close Liquid Glass, uninstall it, and install a
compatible new release. Your isolated profile is retained.

## Files and uninstall

| Item | Default location |
| --- | --- |
| Application | `%LOCALAPPDATA%\Programs\CodexLiquidGlass` |
| Isolated browser profile and glass settings | `%APPDATA%\CodexLiquidGlass` |
| Glass settings file | `%APPDATA%\CodexLiquidGlass\liquid-glass.json` |

No existing browser profile is copied. Normal Codex account configuration and
workspace access still follow the official client's behavior. Existing
official shortcuts are kept; the new shortcut is named **Codex Liquid Glass**.

Close Liquid Glass and uninstall it from **Windows Settings > Apps > Installed
apps**, or run `Uninstall.ps1` from its installation directory. Uninstall
preserves the isolated profile and does not stop any running app automatically.

The local executable's archive-integrity metadata changes to match the
customized archive. Archive-integrity checking remains enabled, but the
modified executable no longer has a valid original Authenticode signature.
Normal launch enables no debugging port and disables no security feature.

## Build and verify

The project has no npm dependencies. Contributors need Node.js 18+ for the
tests. The normal installer uses the runtime already bundled with the
official client.

```powershell
node --test tests/patch.test.cjs
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Build.ps1
```

`Build.ps1` uses Windows' .NET Framework compiler to produce the Setup EXE,
an installer ZIP, and SHA256 checksums. It packages an explicit file list,
excluding installed application binaries, profiles, credentials, logs, and
local QA output.

For isolated local verification, the script installer supports:

```powershell
.\Install.ps1 -SourceAppPath 'C:\path\to\official\app' `
  -InstallRoot 'D:\temporary-test\CodexLiquidGlass' -NoShortcut -NoLaunch
```

An unmodified official executable with a valid OpenAI signature is still
required. This optional command is for maintainers; ordinary installation
does not require terminal commands.

## License

The customization source is MIT licensed. OpenAI software and trademarks are
not covered by that license. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
