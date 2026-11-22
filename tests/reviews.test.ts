import { describe, expect, it } from "vitest";
import { AppError } from "../src/shared/application/app-error";
import {
  applyToSummary,
  authorName,
  decodeCursor,
  eligibleBooking,
  emptySummary,
  ratingDisplay,
  reviewState,
  type Review,
  type ReviewableBooking,
  type ReviewSummary,
} from "../src/modules/reviews/domain/review";
import type { ReviewRepository } from "../src/modules/reviews/application/ports/review-repository";
import { WriteReview } from "../src/modules/reviews/application/use-cases/write-review";
import { DeleteReview } from "../src/modules/reviews/application/use-cases/delete-review";
import {
  GetRatingSummary,
  ListReviews,
} from "../src/modules/reviews/application/use-cases/list-reviews";
import { ModerateReview } from "../src/modules/reviews/application/use-cases/moderate-review";

// Follows the port's contract: every write adjusts the listing summary.
class MemoryReviews implements ReviewRepository {
  rows = new Map<string, Review>();
  summaries = new Map<string, ReviewSummary>();
  private bump(before: Review | null, after: Review | null) {
    const id = (before ?? after)!.productId;
    this.summaries.set(
      id,
      applyToSummary(this.summaries.get(id) ?? emptySummary(), before, after),
    );
  }
  async findByAuthor(userId: string, productId: string) {
    return (
      [...this.rows.values()].find(
        (r) => r.userId === userId && r.productId === productId,
      ) ?? null
    );
  }
  async findById(id: string) {
    return this.rows.get(id) ?? null;
  }
  async save(review: Review, expectedVersion: number | null) {
    const before = this.rows.get(review.id) ?? null;
    if ((before?.version ?? null) !== expectedVersion) return null;
    this.rows.set(review.id, review);
    this.bump(before, review);
    return review;
  }
  async remove(review: Review) {
    this.rows.delete(review.id);
    this.bump(review, null);
  }
  async setStatus(
    id: string,
    status: Review["status"],
    reason: string | null,
    expectedVersion: number,
  ) {
    const before = this.rows.get(id);
    if (!before || before.version !== expectedVersion) return null;
    const after = {
      ...before,
      status,
      hiddenReason: reason,
      version: before.version + 1,
    };
    this.rows.set(id, after);
    this.bump(before, after);
    return after;
  }
  async listPublished(
    productId: string,
    sort: "recent" | "highest" | "lowest",
    cursor: { publishedAt: string; rating: number; id: string } | null,
    limit: number,
  ) {
    const key = (r: Review) =>
      [
        sort === "recent" ? 0 : sort === "highest" ? -r.rating : r.rating,
        -r.publishedAt.getTime(),
        r.id,
      ] as const;
    const before = (a: readonly (number | string)[], b: typeof a) => {
      for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i];
      return false;
    };
    const rows = [...this.rows.values()]
      .filter((r) => r.productId === productId && r.status === "PUBLISHED")
      .sort((a, b) => (before(key(a), key(b)) ? -1 : 1));
    const start = cursor ? rows.findIndex((r) => r.id === cursor.id) + 1 : 0;
    return rows.slice(start, start + limit);
  }
  async listForStaff() {
    const items = [...this.rows.values()];
    return { items, total: items.length };
  }
  async summary(productId: string) {
    return this.summaries.get(productId) ?? emptySummary();
  }
}

const today = "2026-11-22";
const now = () => Date.parse(today + "T10:00:00Z");
const booking = (
  status: ReviewableBooking["status"],
  localDate = "2026-11-15",
  id = `b-${status}-${localDate}`,
): ReviewableBooking => ({ id, productId: "offer-club", localDate, status });
const input = { rating: 5, body: "Brilliant night, great music and staff." };

function setup(bookings: ReviewableBooking[]) {
  const reviews = new MemoryReviews();
  const write = new WriteReview(
    reviews,
    { forListing: async () => bookings },
    now,
  );
  return { reviews, write };
}
async function refusal(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (e) {
    if (e instanceof AppError) return e.code;
    throw e;
  }
  throw Error("expected a refusal");
}
const ada = { id: "user-ada", name: "Ada Okafor" };

describe("review eligibility", () => {
  it("only a completed booking inside the window qualifies", () => {
    for (const status of [
      "AWAITING_PARTNER",
      "CONFIRMED",
      "DECLINED",
      "CANCELLED",
      "NO_SHOW",
    ] as const)
      expect(eligibleBooking([booking(status)], "offer-club", today)).toBe(
        null,
      );
    expect(
      eligibleBooking([booking("COMPLETED")], "offer-club", today)?.id,
    ).toBe("b-COMPLETED-2026-11-15");
    // 90 days after the activity is the last day.
    expect(
      eligibleBooking(
        [booking("COMPLETED", "2026-08-24")],
        "offer-club",
        today,
      ),
    ).not.toBe(null);
    expect(
      eligibleBooking(
        [booking("COMPLETED", "2026-08-23")],
        "offer-club",
        today,
      ),
    ).toBe(null);
    // Another listing's booking never counts.
    expect(eligibleBooking([booking("COMPLETED")], "offer-other", today)).toBe(
      null,
    );
  });

  it("picks the most recent qualifying booking", () => {
    expect(
      eligibleBooking(
        [
          booking("COMPLETED", "2026-10-01"),
          booking("COMPLETED", "2026-11-20"),
        ],
        "offer-club",
        today,
      )?.localDate,
    ).toBe("2026-11-20");
  });

  it("tells My bookings what to offer", () => {
    expect(reviewState(booking("CONFIRMED"), false, today)).toBe("NOT_YET");
    expect(reviewState(booking("COMPLETED"), false, today)).toBe("CAN_REVIEW");
    expect(reviewState(booking("COMPLETED"), true, today)).toBe("REVIEWED");
    expect(reviewState(booking("COMPLETED", "2026-01-01"), false, today)).toBe(
      "CLOSED",
    );
  });
});

describe("writing a review", () => {
  it("refuses travellers who haven't completed the activity", async () => {
    const { write } = setup([booking("CONFIRMED"), booking("NO_SHOW")]);
    expect(
      await refusal(
        write.execute({ user: ada, productId: "offer-club", input }),
      ),
    ).toBe("NOT_ELIGIBLE");
  });

  it("explains when the window has closed", async () => {
    const { write } = setup([booking("COMPLETED", "2026-01-10")]);
    expect(
      await refusal(
        write.execute({ user: ada, productId: "offer-club", input }),
      ),
    ).toBe("REVIEW_WINDOW_CLOSED");
  });

  it("validates the stars and text", async () => {
    const { write } = setup([booking("COMPLETED")]);
    for (const bad of [
      { rating: 0, body: input.body },
      { rating: 4.5, body: input.body },
      { rating: 5, body: "Too short" },
      { rating: 5, body: input.body, title: "x".repeat(81) },
    ])
      expect(
        await refusal(
          write.execute({ user: ada, productId: "offer-club", input: bad }),
        ),
      ).toBe("INVALID_REVIEW");
  });

  it("keeps one review per traveller per listing and updates it", async () => {
    const { write, reviews } = setup([booking("COMPLETED")]);
    const first = await write.execute({
      user: ada,
      productId: "offer-club",
      input: { ...input, title: "  " },
    });
    expect(first).toMatchObject({
      authorName: "Ada O.",
      title: null,
      status: "PUBLISHED",
      version: 1,
      activityDate: "2026-11-15",
    });
    // Replacing needs the version the traveller saw.
    expect(
      await refusal(
        write.execute({ user: ada, productId: "offer-club", input }),
      ),
    ).toBe("VERSION_CONFLICT");
    const second = await write.execute({
      user: ada,
      productId: "offer-club",
      input: { ...input, rating: 3 },
      expectedVersion: 1,
    });
    expect(second.id).toBe(first.id);
    expect(reviews.rows.size).toBe(1);
    expect(await reviews.summary("offer-club")).toEqual({
      count: 1,
      sum: 3,
      histogram: [0, 0, 1, 0, 0],
    });
  });

  it("leaves a hidden review hidden when its author edits it", async () => {
    const { write, reviews } = setup([booking("COMPLETED")]);
    const first = await write.execute({
      user: ada,
      productId: "offer-club",
      input,
    });
    await new ModerateReview(reviews).execute("staff", first.id, {
      status: "HIDDEN",
      reason: "Personal details",
      expectedVersion: 1,
    });
    const edited = await write.execute({
      user: ada,
      productId: "offer-club",
      input,
      expectedVersion: 2,
    });
    expect(edited.status).toBe("HIDDEN");
    expect((await reviews.summary("offer-club")).count).toBe(0);
  });

  it("removes the traveller's own review and its rating", async () => {
    const { write, reviews } = setup([booking("COMPLETED")]);
    await write.execute({ user: ada, productId: "offer-club", input });
    await new DeleteReview(reviews).execute(ada.id, "offer-club");
    expect(reviews.rows.size).toBe(0);
    expect((await reviews.summary("offer-club")).count).toBe(0);
    expect(
      await refusal(new DeleteReview(reviews).execute(ada.id, "offer-club")),
    ).toBe("NOT_FOUND");
  });
});

describe("summaries and listing", () => {
  it("counts only published reviews and shows stars from 3 reviews", () => {
    let s = emptySummary();
    s = applyToSummary(s, null, { rating: 5, status: "PUBLISHED" });
    s = applyToSummary(s, null, { rating: 4, status: "PUBLISHED" });
    expect(ratingDisplay(s)).toBe(null);
    s = applyToSummary(s, null, { rating: 4, status: "PUBLISHED" });
    expect(ratingDisplay(s)).toEqual({ average: 4.3, count: 3 });
    s = applyToSummary(
      s,
      { rating: 5, status: "PUBLISHED" },
      { rating: 5, status: "HIDDEN" },
    );
    expect(s).toEqual({ count: 2, sum: 8, histogram: [0, 0, 0, 2, 0] });
  });

  it("shortens names to first name and last initial", () => {
    expect(authorName("Ada Okafor")).toBe("Ada O.");
    expect(authorName("  Tunde  bakare ")).toBe("Tunde B.");
    expect(authorName("Kemi")).toBe("Kemi");
    expect(authorName("   ")).toBe("Traveller");
  });

  it("pages published reviews with a cursor and no private ids", async () => {
    const reviews = new MemoryReviews();
    for (let i = 0; i < 5; i++) {
      const write = new WriteReview(
        reviews,
        { forListing: async () => [booking("COMPLETED")] },
        () => now() + i * 60000,
      );
      await write.execute({
        user: {
          id: `user-${i}`,
          name: ["Ada", "Bola", "Chidi", "Dayo", "Efe"][i],
        },
        productId: "offer-club",
        input: { ...input, rating: (i % 5) + 1 },
      });
    }
    const list = new ListReviews(reviews);
    const first = await list.execute("offer-club", { limit: "2" });
    expect(first.items.map((r) => r.author)).toEqual(["Efe", "Dayo"]);
    expect(first.items[0]).not.toHaveProperty("userId");
    expect(first.items[0]).not.toHaveProperty("bookingId");
    expect(first.items[0].activityMonth).toBe("2026-11");
    const second = await list.execute("offer-club", {
      limit: "2",
      cursor: first.nextCursor!,
    });
    expect(second.items.map((r) => r.author)).toEqual(["Chidi", "Bola"]);
    const last = await list.execute("offer-club", {
      limit: "2",
      cursor: second.nextCursor!,
    });
    expect(last.items).toHaveLength(1);
    expect(last.nextCursor).toBe(null);
    const highest = await list.execute("offer-club", { sort: "highest" });
    expect(highest.items.map((r) => r.rating)).toEqual([5, 4, 3, 2, 1]);
    expect(
      await new GetRatingSummary(reviews).execute("offer-club"),
    ).toMatchObject({ rating: { average: 3, count: 5 } });
  });

  it("rejects over-limit pages and forged cursors", async () => {
    const list = new ListReviews(new MemoryReviews());
    for (const query of [
      { limit: "51" },
      { limit: "0" },
      { sort: "random" },
      { cursor: "not-a-cursor" },
    ])
      expect(await refusal(list.execute("offer-club", query))).toBe(
        "INVALID_QUERY",
      );
    expect(decodeCursor("e30")).toBe(null);
  });

  it("needs a reason to hide a review", async () => {
    const reviews = new MemoryReviews();
    const { write } = {
      write: new WriteReview(
        reviews,
        { forListing: async () => [booking("COMPLETED")] },
        now,
      ),
    };
    const review = await write.execute({
      user: ada,
      productId: "offer-club",
      input,
    });
    const moderate = new ModerateReview(reviews);
    expect(
      await refusal(
        moderate.execute("staff", review.id, {
          status: "HIDDEN",
          expectedVersion: 1,
        }),
      ),
    ).toBe("INVALID_MODERATION");
    expect(
      await refusal(
        moderate.execute("staff", review.id, {
          status: "HIDDEN",
          reason: "Spam",
          expectedVersion: 9,
        }),
      ),
    ).toBe("VERSION_CONFLICT");
  });
});
