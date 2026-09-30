'use strict';
const fs = require('node:fs');
const path = require('node:path');

// Remove only files shipped with the app. Never recursively delete the installation
// directory: it may contain the user's data, exports, or a custom data directory.
module.exports = async context => {
  if (context.electronPlatformName !== 'win32') return;
  const files = [], directories = [];
  function walk(folder) {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      const absolute = path.join(folder, entry.name);
      const relative = path.relative(context.appOutDir, absolute).replaceAll('/', '\\');
      if (entry.isDirectory()) { walk(absolute); directories.push(relative); }
      else files.push(relative);
    }
  }
  walk(context.appOutDir);
  if (files.some(file => /^(data|runtime|backups)\\/i.test(file) || /daynote\.config\.json$/i.test(file))) throw new Error('Personal data found in build output; refusing to package');
  const escape = value => value.replaceAll('$', '$$').replaceAll('"', '$\\"');
  const lines = ['!macro customRemoveFiles', '  SetOutPath "$TEMP"'];
  for (const file of files) lines.push(`  Delete /REBOOTOK "$INSTDIR\\${escape(file)}"`);
  lines.push('  Delete /REBOOTOK "$INSTDIR\\${UNINSTALL_FILENAME}"');
  for (const directory of directories) lines.push(`  RMDir "$INSTDIR\\${escape(directory)}"`);
  lines.push('  RMDir "$INSTDIR"', '!macroend', '');
  fs.writeFileSync(path.join(context.packager.projectDir, 'build/remove-files.nsh'), lines.join('\n'));
};
