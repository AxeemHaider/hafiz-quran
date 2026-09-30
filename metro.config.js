// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// The prepared Mushaf database (assets/generated/mushaf/mushaf.db) is bundled as an asset.
if (!config.resolver.assetExts.includes('db')) config.resolver.assetExts.push('db');

module.exports = config;
