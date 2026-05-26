import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Book, BookMeta, StructuredTOC } from "@/types/book";

// Local-first book storage (ADR-003 D1) — same AsyncStorage shape as the lesson
// library: a single index + one entry per book. Migrate to expo-sqlite if books
// outgrow AsyncStorage's quota (ADR-003 open question).
const INDEX_KEY = "sbq_book_index";
const bookKey = (id: string) => `sbq_book_${id}`;

function countUnits(toc: StructuredTOC): number {
  return toc.subjects.reduce((n, s) => n + s.units.length, 0);
}

function toMeta(book: Book): BookMeta {
  return {
    id: book.id,
    title: book.title,
    subjectCount: book.toc.subjects.length,
    unitCount: countUnits(book.toc),
    updatedAt: book.updatedAt,
  };
}

export async function saveBook(book: Book): Promise<void> {
  await AsyncStorage.setItem(bookKey(book.id), JSON.stringify(book));

  const index = await loadBookIndex();
  const deduped = index.filter((m) => m.id !== book.id);
  await AsyncStorage.setItem(
    INDEX_KEY,
    JSON.stringify([toMeta(book), ...deduped]),
  );
}

export async function loadBookIndex(): Promise<BookMeta[]> {
  const raw = await AsyncStorage.getItem(INDEX_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as BookMeta[];
  } catch {
    return [];
  }
}

export async function loadBook(id: string): Promise<Book | null> {
  const raw = await AsyncStorage.getItem(bookKey(id));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Book;
  } catch {
    return null;
  }
}

export async function deleteBook(id: string): Promise<void> {
  const index = await loadBookIndex();
  await Promise.all([
    AsyncStorage.removeItem(bookKey(id)),
    AsyncStorage.setItem(
      INDEX_KEY,
      JSON.stringify(index.filter((m) => m.id !== id)),
    ),
  ]);
}
