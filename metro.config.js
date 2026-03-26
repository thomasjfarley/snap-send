const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

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

  // Force zustand's CJS builds on web to avoid import.meta in the ESM variants
  if (platform === 'web' && moduleName.startsWith('zustand')) {
    const subpath = moduleName.replace('zustand', '').replace(/^\//, '') || 'index';
    const cjsPath = path.join(__dirname, 'node_modules', 'zustand', `${subpath}.js`);
    return { type: 'sourceFile', filePath: cjsPath };
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
