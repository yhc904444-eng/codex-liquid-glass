# Release validation

Release: **1.1.0**. Validation date: **2026-10-29**. Platform: Windows x64.

## Passed

- All six existing automated tests pass: known-source discovery, rejection of
  unsupported and ambiguous sources without mutation, archive bounds,
  preserved packed/unpacked/link entries, matching executable archive-integrity
  metadata, and compilation of the English settings renderer.
- The installer, launcher, uninstaller, and builder pass PowerShell parsing.
- The .NET Framework bootstrap compiles into the versioned Windows Setup EXE.
- The exact compiled Setup EXE installs into an isolated test directory from
  the signed official Store package **26.1021.3705.0**, using its bundled
  runtime. This test creates no shortcuts, copies no browser profile, and
  launches no client.
- The installed archive contains the release renderer and stylesheet exactly;
  the installation record and manifest report version **1.1.0** and revision
  **floating-surfaces-glass-2-en**. The official source archive and publisher
  signature remain unchanged. Isolated uninstall retains synthetic profile data.
- The installer ZIP matches its explicit 13-file allowlist and the Setup EXE
  embeds that same ZIP. No official application executable/archive, private
  profile, credential, log, or QA screenshot is included in the downloads.
- Real UI verification of the same floating-surface implementation used a
  signed-in compatible **26.1016.8622.0** client. The navigation rail's peeking
  sidebar now receives glass even though it is a layout panel rather than an
  ARIA menu. Native Windows captures and renderer inspection confirm the result.

At the tested workspace transparency of 95% and additional blur of 0 px:

| Surface | Background alpha | Backdrop blur |
| --- | --- | --- |
| Peeking navigation sidebar | 0.19 | 8 px |
| Profile menu | 0.38 | 10 px |
| Search dialog | 0.46 | 14 px |

The sidebar's text opacity stays at 1. Search dialog corners remain 20 px,
with an opaque internal layout fill cleared. Turning glass off restores the
native sidebar material; turning it back on restores glass. The dark glass
background color was checked by temporarily changing CSS theme state.
The floating implementation matches the local validated build; public
settings labels remain in English.

## Verification limits

- A complete fresh-account sign-in was not repeated for 1.1.0. Earlier 1.0.0
  testing with clean profiles reached the same native organization-settings
  policy/network gate in both the official and customized applications.
  The customization does not bypass account policy or copy cached account data.
- Full native dark-mode interaction was not repeated; the theme check above
  covers material color and restoration.
- Future upstream builds are rejected until their archive fingerprints and
  integration points are verified. The automatic prerequisite download may
  fetch a newer upstream build than this release supports.
- The official-prerequisite download path was not exercised by removing this
  machine's existing official application.

See **SHA256SUMS.txt** in the release for the Setup EXE, installer ZIP, and
this validation document. Source and installer material are MIT licensed;
OpenAI application binaries are obtained locally and are not redistributed.
