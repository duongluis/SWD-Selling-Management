const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname)

module.exports = withNativeWind(config, { input: './global.css' })

config.resolver.sourceExts.push("js", "json", "ts", "tsx", "cjs");
module.exports = config;
