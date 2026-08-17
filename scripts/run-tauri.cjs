const cli = require('../node_modules/.pnpm/@tauri-apps+cli@2.11.4/node_modules/@tauri-apps/cli/main');

const argumentsList = process.argv
  .slice(2)
  .filter((argument) => !argument.endsWith('DSH Desktop.exe'));

cli
  .run(argumentsList, 'pnpm tauri')
  .catch((error) => {
    cli.logError(error.message);
    process.exit(1);
  });
