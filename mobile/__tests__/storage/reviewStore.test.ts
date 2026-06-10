import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  addReview,
  countReviews,
  deleteReview,
  editReview,
  listReviews,
  reviewCounts,
} from "@/storage/reviewStore";

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe("reviewStore", () => {
  it("returns an empty list for a book with no reviews", async () => {
    expect(await listReviews("book-1")).toEqual([]);
    expect(await countReviews("book-1")).toBe(0);
  });

  it("adds a review and reads it back with an id + createdAt", async () => {
    const r = await addReview("book-1", { title: "Nice", body: "Reads well", reviewer: "Sridhar" });
    expect(r.id).toBeTruthy();
    expect(r.createdAt).toBeTruthy();

    const list = await listReviews("book-1");
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ title: "Nice", body: "Reads well", reviewer: "Sridhar" });
  });

  it("trims fields and drops an empty reviewer", async () => {
    const r = await addReview("book-1", { title: "  T  ", body: "  B  ", reviewer: "   " });
    expect(r.title).toBe("T");
    expect(r.body).toBe("B");
    expect(r.reviewer).toBeUndefined();
  });

  it("lists newest first", async () => {
    await AsyncStorage.setItem(
      "sbq_reviews_book-1",
      JSON.stringify([
        { id: "a", title: "older", body: "x", createdAt: "2026-06-01T00:00:00.000Z" },
        { id: "b", title: "newer", body: "y", createdAt: "2026-06-09T00:00:00.000Z" },
      ]),
    );
    const list = await listReviews("book-1");
    expect(list.map((r) => r.id)).toEqual(["b", "a"]);
  });

  it("scopes reviews per book id", async () => {
    await addReview("book-1", { title: "one", body: "b1" });
    await addReview("book-2", { title: "two", body: "b2" });
    expect(await countReviews("book-1")).toBe(1);
    expect(await countReviews("book-2")).toBe(1);
    expect(await reviewCounts(["book-1", "book-2", "book-3"])).toEqual({
      "book-1": 1,
      "book-2": 1,
      "book-3": 0,
    });
  });

  it("deletes a review by id", async () => {
    const r1 = await addReview("book-1", { title: "keep", body: "b1" });
    const r2 = await addReview("book-1", { title: "remove", body: "b2" });
    await deleteReview("book-1", r2.id);
    const list = await listReviews("book-1");
    expect(list.map((r) => r.id)).toEqual([r1.id]);
  });

  it("edits a review in place, preserving id and createdAt", async () => {
    const r = await addReview("book-1", { title: "old", body: "old body", reviewer: "A" });
    const updated = await editReview("book-1", r.id, {
      title: "new",
      body: "new body",
      reviewer: "",
    });
    expect(updated).toMatchObject({ id: r.id, createdAt: r.createdAt, title: "new", body: "new body" });
    expect(updated?.reviewer).toBeUndefined();
    const list = await listReviews("book-1");
    expect(list[0]).toMatchObject({ id: r.id, title: "new", body: "new body" });
    expect(list[0].reviewer).toBeUndefined();
  });

  it("returns null when editing a missing review id", async () => {
    expect(await editReview("book-1", "nope", { title: "x", body: "y" })).toBeNull();
  });

  it("tolerates corrupt stored JSON", async () => {
    await AsyncStorage.setItem("sbq_reviews_book-1", "{not json");
    expect(await listReviews("book-1")).toEqual([]);
  });
});
