const { withPodfile } = require('@expo/config-plugins');

const FLAG = '$RNFirebaseAnalyticsWithoutAdIdSupport = true';

// Builds Firebase Analytics without the IDFA subspec so no advertising ID is collected on iOS
module.exports = function withFirebaseNoIdfa(config) {
  return withPodfile(config, (c) => {
    if (!c.modResults.contents.includes(FLAG)) {
      c.modResults.contents = `${FLAG}\n${c.modResults.contents}`;
    }
    return c;
  });
};
