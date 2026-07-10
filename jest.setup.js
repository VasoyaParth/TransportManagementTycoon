// Jest environment shims for native modules the game imports at module scope.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('react-native-sound', () => {
  class Sound { constructor(f, b, cb) { if (cb) cb(null); } play() {} pause() {} stop(cb) { if (cb) cb(); } setVolume() {} setNumberOfLoops() {} release() {} }
  Sound.setCategory = () => {};
  Sound.MAIN_BUNDLE = 0;
  return Sound;
});
jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'Icon');
jest.mock('react-native-webview', () => ({ WebView: 'WebView' }));
jest.mock('react-native-blob-util', () => ({ default: null }), { virtual: true });
jest.mock('@notifee/react-native', () => ({
  requestPermission: jest.fn(), createChannel: jest.fn(), displayNotification: jest.fn(),
  createTriggerNotification: jest.fn(), cancelNotification: jest.fn(), cancelAllNotifications: jest.fn(),
  TriggerType: { TIMESTAMP: 0 }, AndroidImportance: { HIGH: 4, DEFAULT: 3 },
}), { virtual: true });
