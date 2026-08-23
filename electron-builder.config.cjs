module.exports = {
  appId: 'com.seongppak.aipromptinterviewer',
  productName: 'AI Prompt Interviewer',
  executableName: 'AI Prompt Interviewer',
  asar: true,
  npmRebuild: false,
  directories: {
    output: 'release-desktop',
  },
  files: [
    'dist-desktop/**/*',
    'apps/desktop/electron/**/*',
    'package.json',
  ],
  extraResources: [
    {
      from: 'dist-native/AIPIInterceptor.exe',
      to: 'native/AIPIInterceptor.exe',
    },
  ],
  win: {
    target: [{ target: 'nsis', arch: ['x64'] }],
    icon: 'build/app-icon.ico',
    artifactName: '${productName}-Setup-${version}-${arch}.${ext}',
    requestedExecutionLevel: 'asInvoker',
  },
  nsis: {
    installerIcon: 'build/app-icon.ico',
    uninstallerIcon: 'build/app-icon.ico',
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'AI Prompt Interviewer',
    deleteAppDataOnUninstall: false,
  },
}
