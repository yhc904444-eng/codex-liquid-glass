# Release validation

Validation date: 2026-10-26. Platform: Windows x64.

## Passed

- Six automated tests cover hashed main-file discovery, unsupported-source
  rejection without mutation, ambiguous integration-point rejection, archive
  bounds validation, preserved packed/unpacked/link entries, matching archive
  integrity metadata, and compilation of the English renderer.
- Windows PowerShell parses the installer, launcher, uninstaller, and builder.
- The .NET Framework bootstrap compiles to a Windows Setup EXE.
- The exact compiled Setup EXE installs successfully in isolated test mode,
  including when the parent deliberately supplies an invalid PowerShell module
  path. The bootstrap initializes native Windows PowerShell module discovery.
- A clean isolated installation from the signed official Store package
  **26.1021.3705.0** completes without Node/npm setup, shortcuts, profile copying,
  or modifications to the official installation.
- Both isolated test installations uninstall successfully while retaining a
  synthetic profile file. The official archive hash and valid publisher
  signature remain unchanged afterward.
- The installer ZIP is checked against its explicit 13-file allowlist. It
  contains customization material only, with no official executable, archive,
  browser profile, credential, log, or QA screenshot.
- The existing compatible client **26.1016.8622.0** was used for real appearance
  UI verification. Actual settings surfaces become translucent; previously
  opaque native cards become transparent. A real mouse hover opens the native
  tooltip with opaque readable text. The real appearance dropdown uses
  `rgba(255,255,255,0.45)` and a 14 px backdrop blur at the tested preferences.
- Temporarily removing and restoring the glass CSS class restores native
  settings/menu materials and re-enables glass after its short transition.
  Saved preferences are preserved.

## Limits of verification

- On this machine, starting the current client with an empty QA browser profile
  reaches the official native **Unable to load organization settings** gate.
  The client reports an account-policy/network/proxy/firewall access problem.
  The untouched official executable, started with its own separate empty QA
  profile, reaches the identical native dialog, confirming this gate occurs
  independently of the customization.
  A complete fresh-account sign-in and authenticated session could therefore
  not be verified here. The customization does not bypass that gate or copy
  cached account data to work around it.
- Future upstream builds are intentionally rejected until their archive
  fingerprint and integration points have been verified for a new release.
- The automatic official-prerequisite download branch is implemented with
  HTTPS and OpenAI publisher-signature verification. It was not exercised by
  uninstalling this machine's existing official application.
- Existing signed-in appearance UI was checked visually using renderer
  screenshots. The preview's hidden native window did not expose a usable
  main-window handle for the normal screen-capture helper.
