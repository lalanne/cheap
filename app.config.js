const config = require('./app.json');

// Locally the file exists on disk. On EAS Build it's gitignored, so a file
// environment variable (configured via `eas env:create`) supplies the
// materialized path instead. See specs/004-ios-deployment.md.
config.expo.ios.googleServicesFile =
  process.env.GOOGLE_SERVICE_INFO_PLIST ?? config.expo.ios.googleServicesFile;

module.exports = config;
