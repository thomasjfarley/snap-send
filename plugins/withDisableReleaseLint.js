const { withProjectBuildGradle } = require('expo/config-plugins');

// Stripe's optional push-provisioning dependency needs play-services-tapandpay, which is not on
// public Maven, so lintVitalAnalyzeRelease cannot resolve its classpath. We don't use that feature.
const MARKER = '// disable-release-lint';
const SNIPPET = `
${MARKER}
subprojects { p ->
  ['com.android.application', 'com.android.library'].each { id ->
    p.plugins.withId(id) {
      p.android.lint.checkReleaseBuilds = false
    }
  }
}
`;

module.exports = function withDisableReleaseLint(config) {
  return withProjectBuildGradle(config, (cfg) => {
    if (cfg.modResults.language === 'groovy' && !cfg.modResults.contents.includes(MARKER)) {
      cfg.modResults.contents += SNIPPET;
    }
    return cfg;
  });
};
