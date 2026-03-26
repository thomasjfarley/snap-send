const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Redirect native-only packages to empty stubs when bundling for web
const NATIVE_ONLY = [
  '@stripe/stripe-react-native',
  'react-native-view-shot',
];

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && NATIVE_ONLY.includes(moduleName)) {
    return {
      type: 'sourceFile',
      filePath: require.resolve('./stubs/native-only.web.js'),
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
