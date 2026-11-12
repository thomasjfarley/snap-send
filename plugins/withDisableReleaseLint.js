const { withProjectBuildGradle } = require('expo/config-plugins');

// Stripe's optional push-provisioning dependency (compileOnly) needs play-services-tapandpay, which
// is not on public Maven, so Android lint's classpath cannot resolve. We don't use that feature, so
// exclude it from the lint classpaths only; compile classpaths are untouched.
const MARKER = '// exclude-push-provisioning-from-lint';
const SNIPPET = `
${MARKER}
subprojects { p ->
  p.configurations.configureEach { c ->
    def n = c.name.toLowerCase()
    if (n.contains('lint') && n.endsWith('classpath')) {
      c.exclude group: 'com.stripe', module: 'stripe-android-issuing-push-provisioning'
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
