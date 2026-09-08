export const tokenPublicApiDeprecationPolicyV1 = {
  issue: '#889',
  removalRelease: '3.0.0',
  rules: {
    namedThemes:
      'Public theme objects are named explicitly and their export names must agree with each runtime theme.name identity.',
    deprecatedExports:
      'A deprecated root export must preserve its existing runtime contract, carry a source @deprecated annotation, name a canonical replacement, and have machine-readable removal evidence.',
    deprecatedCssVariables:
      'A deprecated CSS variable remains platform-output compatibility only; it must not re-enter canonical TokenPath/ComponentTokenPath unions and must carry replacement/removal evidence.',
    removal:
      'Compatibility aliases introduced or retained during Token Architecture Normalization V1 are removed at the next major boundary, Vellira 3.0.0, unless a separately reviewed policy revision supersedes this contract.',
  },
} as const;

export const publicThemeContractsV1 = [
  { exportName: 'lightTheme', themeName: 'light' },
  { exportName: 'darkTheme', themeName: 'dark' },
  { exportName: 'highContrastTheme', themeName: 'high-contrast' },
] as const;

export const legacyPublicExportAliasesV1 = [
  {
    exportName: 'theme',
    replacementExport: 'darkTheme',
    issue: '#889',
    removeIn: '3.0.0',
    reason:
      'The historical theme export is a partial hard-wired Dark theme and therefore cannot represent a default/current theme contract unambiguously.',
  },
] as const;
