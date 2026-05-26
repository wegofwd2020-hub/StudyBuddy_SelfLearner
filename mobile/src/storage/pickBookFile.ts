import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { Platform } from "react-native";

// Pick a .json file and return its text contents, or null if the user cancels.
// Used by the import screen for books too large to paste (e.g. a migrated
// "Everything"-scope book is ~1.5 MB). Pairs with importBook() in importBook.ts.
//
// Reading differs by platform: on web the picked asset uri is a blob/data URL
// (read with fetch); on native it's a file uri (read with expo-file-system).
export async function pickBookFileContents(): Promise<string | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: "application/json",
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (res.canceled || !res.assets || res.assets.length === 0) return null;
  const uri = res.assets[0].uri;

  if (Platform.OS === "web") {
    const r = await fetch(uri);
    return await r.text();
  }
  return await FileSystem.readAsStringAsync(uri);
}
