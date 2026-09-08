/**
 * Legacy Web output identities retained for bounded compatibility.
 *
 * These paths are not canonical component tokens. #889 makes their lifecycle
 * explicit: they remain generated aliases during Vellira 2.x and are scheduled
 * for removal in 3.0.0. New consumers must use the canonical replacement.
 */
export const componentTokenWebCompatibilityAliases = [
  {
    path: 'components.modal.content.nativeMaxHeight',
    variable: '--modal-content-native-max-height',
    replacementPath: 'components.modal.content.maxHeight',
    replacementVariable: '--modal-content-max-height',
    migrationId: '884-remove-components-modal-content-nativeMaxHeight',
    issue: '#889',
    removeIn: '3.0.0',
  },
  {
    path: 'components.popover.content.shadow.web',
    variable: '--popover-content-shadow-web',
    replacementPath: 'components.popover.content.shadow',
    replacementVariable: '--popover-content-shadow',
    migrationId: '884-popover-shadow-web-to-canonical-intent',
    issue: '#889',
    removeIn: '3.0.0',
  },
  {
    path: 'components.popover.content.shadow.native.x',
    variable: '--popover-content-shadow-native-x',
    replacementPath: 'components.popover.content.shadow',
    replacementVariable: '--popover-content-shadow',
    migrationId: '884-remove-components-popover-content-shadow-native-x',
    issue: '#889',
    removeIn: '3.0.0',
  },
  {
    path: 'components.popover.content.shadow.native.y',
    variable: '--popover-content-shadow-native-y',
    replacementPath: 'components.popover.content.shadow',
    replacementVariable: '--popover-content-shadow',
    migrationId: '884-remove-components-popover-content-shadow-native-y',
    issue: '#889',
    removeIn: '3.0.0',
  },
  {
    path: 'components.popover.content.shadow.native.blur',
    variable: '--popover-content-shadow-native-blur',
    replacementPath: 'components.popover.content.shadow',
    replacementVariable: '--popover-content-shadow',
    migrationId: '884-remove-components-popover-content-shadow-native-blur',
    issue: '#889',
    removeIn: '3.0.0',
  },
  {
    path: 'components.popover.content.shadow.native.color',
    variable: '--popover-content-shadow-native-color',
    replacementPath: 'components.popover.content.shadow',
    replacementVariable: '--popover-content-shadow',
    migrationId: '884-remove-components-popover-content-shadow-native-color',
    issue: '#889',
    removeIn: '3.0.0',
  },
  {
    path: 'components.popover.content.shadow.native.opacity',
    variable: '--popover-content-shadow-native-opacity',
    replacementPath: 'components.popover.content.shadow',
    replacementVariable: '--popover-content-shadow',
    migrationId: '884-remove-components-popover-content-shadow-native-opacity',
    issue: '#889',
    removeIn: '3.0.0',
  },
  {
    path: 'components.popover.content.shadow.native.elevation',
    variable: '--popover-content-shadow-native-elevation',
    replacementPath: 'components.popover.content.shadow',
    replacementVariable: '--popover-content-shadow',
    migrationId:
      '884-remove-components-popover-content-shadow-native-elevation',
    issue: '#889',
    removeIn: '3.0.0',
  },
] as const;
