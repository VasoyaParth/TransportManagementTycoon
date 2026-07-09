module.exports = {
  root: true,
  extends: '@react-native',
  rules: {
    // Advisory, not blocking — this codebase intentionally uses mount-only
    // animation/lifecycle effects with stable refs. Keep it visible as a
    // warning (React's own default) rather than a hard error.
    'react-hooks/exhaustive-deps': 'warn',
  },
};
