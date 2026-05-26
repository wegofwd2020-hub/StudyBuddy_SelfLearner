const mockGetDocument = jest.fn();
const mockReadAsString = jest.fn();

jest.mock("expo-document-picker", () => ({
  getDocumentAsync: (...args: unknown[]) => mockGetDocument(...args),
}));
jest.mock("expo-file-system", () => ({
  readAsStringAsync: (...args: unknown[]) => mockReadAsString(...args),
}));
jest.mock("react-native", () => ({ Platform: { OS: "ios" } }));

import { pickBookFileContents } from "@/storage/pickBookFile";

describe("pickBookFileContents", () => {
  beforeEach(() => {
    mockGetDocument.mockReset();
    mockReadAsString.mockReset();
  });

  it("returns null when the picker is cancelled", async () => {
    mockGetDocument.mockResolvedValue({ canceled: true, assets: null });
    expect(await pickBookFileContents()).toBeNull();
    expect(mockReadAsString).not.toHaveBeenCalled();
  });

  it("returns null when no asset comes back", async () => {
    mockGetDocument.mockResolvedValue({ canceled: false, assets: [] });
    expect(await pickBookFileContents()).toBeNull();
  });

  it("reads the picked file's contents on native", async () => {
    mockGetDocument.mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file:///tmp/book.json", name: "book.json" }],
    });
    mockReadAsString.mockResolvedValue('{"title":"x"}');
    expect(await pickBookFileContents()).toBe('{"title":"x"}');
    expect(mockReadAsString).toHaveBeenCalledWith("file:///tmp/book.json");
  });
});
