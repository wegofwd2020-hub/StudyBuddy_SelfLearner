import AsyncStorage from "@react-native-async-storage/async-storage";
import { addReview, countReviews, type NewReview } from "@/storage/reviewStore";

// One-time demo seed: the real reviewer feedback received on the "Product Sense
// and AI" book (Sridhar Parthasarathy, 2026-06-10), so the Reviews feature has a
// populated example. Scoped to that one book id; guarded so it never re-adds
// after the user edits or deletes it.
const SEED_BOOK_ID = "authored-product-sense-ai-linkedin";
const seededKey = (bookId: string) => `sbq_reviews_seeded_${bookId}`;

const SRIDHAR_REVIEW: NewReview = {
  title: "Sridhar — targeting, flow & “Why AI Fails” gaps",
  reviewer: "Sridhar Parthasarathy",
  body: `GENERAL
I agree with both the premise and thesis, and much of the content and actions are good. It reads pretty well and I like the structure of each chapter.

WHO ARE YOU TARGETING?
Product Managers, or 'professionals'? If broader, you'd remove SDD, Requirements and Product Sense — but then you miss the hyper-personalised world that Mentible should be offering. I'd narrow the subtitle to "A Practical Guide for Experienced Product Managers": the examples (e.g. FreightCo leaders failing to adopt an AI tool) are Product Sense stories, and 'Product Sense', 'Requirements' and 'SDD' are clearly PM concepts. A PM scope lets you double-down rather than doing too much in one document.

FLOW DIDN'T REALLY WORK FOR ME
- It flows from various problems to recommendations without calling them out in sections. Either section them explicitly, or put all problems + context up front and all recommendations/actions at the end.
- Currently: Context Architect > Why AI Fails > Context Engineering. Should this be: Why AI Fails > How an experienced professional can optimise for that (better language!) — which then includes both Context Architecture and Engineering?
- Maybe move "The T-Shaped Professional" to the end of the book?

DETAILED
- The doc is a 'practical guide' — are learning objectives the right construct, or something else?
- "Why AI Fails" only expands on 2 of the 4 root causes it identifies.
- "Why AI Fails" is missing the 'Jagged Frontier' concept — an important one to grasp (Dell'Acqua/BCG 2023; I sent a long set of extracts to source it).
- Chapters 8 and 9 seem very thin if targeted at PMs and don't really say much about those 4 root causes and 4 components.`,
};

// Insert the sample review for the Product Sense book the first time it's seen,
// if it has no reviews yet. No-op for every other book. Safe to call on each
// load — it returns immediately unless seeding is actually due.
export async function maybeSeedReviews(bookId: string): Promise<boolean> {
  if (bookId !== SEED_BOOK_ID) return false;
  if (await AsyncStorage.getItem(seededKey(bookId))) return false;
  // Respect any reviews the user already added; only seed an empty book.
  if ((await countReviews(bookId)) === 0) {
    await addReview(bookId, SRIDHAR_REVIEW);
  }
  await AsyncStorage.setItem(seededKey(bookId), "1");
  return true;
}
