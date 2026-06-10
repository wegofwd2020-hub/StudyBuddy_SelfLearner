import AsyncStorage from "@react-native-async-storage/async-storage";
import { randomUUID } from "@/lib/uuid";

// Local-first per-book reviews (same AsyncStorage shape as bookStore: one entry
// per book, keyed by book id). A "review" is feedback received on a book — e.g.
// the emailed reviewer notes the author pastes in to keep and re-read. Stored on
// the device only (no backend at MVP, consistent with ADR-003/ADR-004).
const reviewsKey = (bookId: string) => `sbq_reviews_${bookId}`;

export interface Review {
  id: string;
  // Short label for the list row (e.g. "Sridhar — structure & targeting").
  title: string;
  // The full review text shown in the reader.
  body: string;
  // Who gave the review (optional).
  reviewer?: string;
  // When it was added to the app (ISO).
  createdAt: string;
}

// Input for a new review (id + createdAt are assigned here).
export interface NewReview {
  title: string;
  body: string;
  reviewer?: string;
}

async function readAll(bookId: string): Promise<Review[]> {
  const raw = await AsyncStorage.getItem(reviewsKey(bookId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Review[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Reviews for a book, newest first.
export async function listReviews(bookId: string): Promise<Review[]> {
  const all = await readAll(bookId);
  return [...all].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function countReviews(bookId: string): Promise<number> {
  return (await readAll(bookId)).length;
}

// Review counts for several books at once (for the Library grid badges).
export async function reviewCounts(bookIds: string[]): Promise<Record<string, number>> {
  const entries = await Promise.all(
    bookIds.map(async (id) => [id, await countReviews(id)] as const),
  );
  return Object.fromEntries(entries);
}

export async function addReview(bookId: string, input: NewReview): Promise<Review> {
  const review: Review = {
    id: randomUUID(),
    title: input.title.trim(),
    body: input.body.trim(),
    reviewer: input.reviewer?.trim() || undefined,
    createdAt: new Date().toISOString(),
  };
  const all = await readAll(bookId);
  await AsyncStorage.setItem(reviewsKey(bookId), JSON.stringify([review, ...all]));
  return review;
}

// Update an existing review's editable fields (id + createdAt are preserved).
// Returns the updated review, or null if the id isn't found.
export async function editReview(
  bookId: string,
  reviewId: string,
  input: NewReview,
): Promise<Review | null> {
  const all = await readAll(bookId);
  let updated: Review | null = null;
  const next = all.map((r) => {
    if (r.id !== reviewId) return r;
    updated = {
      ...r,
      title: input.title.trim(),
      body: input.body.trim(),
      reviewer: input.reviewer?.trim() || undefined,
    };
    return updated;
  });
  if (updated) await AsyncStorage.setItem(reviewsKey(bookId), JSON.stringify(next));
  return updated;
}

export async function deleteReview(bookId: string, reviewId: string): Promise<void> {
  const all = await readAll(bookId);
  await AsyncStorage.setItem(
    reviewsKey(bookId),
    JSON.stringify(all.filter((r) => r.id !== reviewId)),
  );
}
