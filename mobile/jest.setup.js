// Global test setup. Provide a working in-memory AsyncStorage so modules that
// touch it (bookStore, settingsStore, …) can be imported/rendered in any test
// without the native module (which is null under jest).
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
