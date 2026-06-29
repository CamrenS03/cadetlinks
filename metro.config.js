const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Enable package.json "exports" field resolution so packages like
// @base-ui/utils can resolve subpath exports (e.g. /useMergedRefs)
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
