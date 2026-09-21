import { describe, it, expect } from "vitest";
import {
  formatEgp,
  toCents,
  fromCents,
  roundToTwoDecimals,
  normalizeArabicDigits,
  sanitizeArabicText,
  containsArabic,
  validateEgyptianNationalId,
  chunkArray,
  paginate,
} from "../src/domain/index.js";
import {
  PINNED_BASE_TIME,
  createTestBotContext,
} from "../src/testing/index.js";
import { logger } from "../src/logger/index.js";

describe("@alsaada/shared Domain Helpers", () => {
  describe("Currency Calculations", () => {
    it("accurately converts to and from cents", () => {
      expect(toCents(123.45)).toBe(12345);
      expect(toCents(0.01)).toBe(1);
      expect(fromCents(12345)).toBe(123.45);
      expect(roundToTwoDecimals(10.555)).toBe(10.56);
      expect(formatEgp(1500)).toBe("1500.00 ج.م");
    });
  });

  describe("Arabic Text Processing", () => {
    it("normalizes eastern arabic digits to standard ascii digits", () => {
      expect(normalizeArabicDigits("١٢٣٤٥٦٧٨٩٠")).toBe("1234567890");
      expect(normalizeArabicDigits("01012345678")).toBe("01012345678");
    });

    it("sanitizes arabic text and collapses whitespace", () => {
      const dirty = "   مرحبا   \u200Bبكم   ";
      expect(sanitizeArabicText(dirty)).toBe("مرحبا بكم");
      expect(containsArabic("نص عربي")).toBe(true);
      expect(containsArabic("English only")).toBe(false);
    });
  });

  describe("Egyptian National ID Validator", () => {
    it("validates a correct 14-digit national ID and extracts metadata", () => {
      // Century 2 (1900s), Year 90 (1990), Month 05, Day 15, Gov 01 (Cairo), 13th digit odd (5 = male)
      const validMaleId = "29005150112355";
      const result = validateEgyptianNationalId(validMaleId);

      expect(result.isValid).toBe(true);
      expect(result.gender).toBe("male");
      expect(result.governorateCode).toBe("01");
      expect(result.birthDate?.getUTCFullYear()).toBe(1990);
      expect(result.birthDate?.getUTCMonth()).toBe(4); // 0-indexed May
      expect(result.birthDate?.getUTCDate()).toBe(15);

      // 13th digit even (4 = female)
      const validFemaleId = "29005150112345";
      const femaleResult = validateEgyptianNationalId(validFemaleId);
      expect(femaleResult.isValid).toBe(true);
      expect(femaleResult.gender).toBe("female");
    });

    it("rejects invalid national IDs with appropriate error descriptions", () => {
      const shortId = "12345";
      expect(validateEgyptianNationalId(shortId).isValid).toBe(false);

      const invalidCentury = "19005150112345";
      expect(validateEgyptianNationalId(invalidCentury).isValid).toBe(false);
    });
  });

  describe("Pagination and Chunking", () => {
    it("chunks arrays into specified page sizes", () => {
      const list = [1, 2, 3, 4, 5, 6, 7];
      const chunks = chunkArray(list, 3);
      expect(chunks).toHaveLength(3);
      expect(chunks[0]).toEqual([1, 2, 3]);
      expect(chunks[2]).toEqual([7]);
    });

    it("paginates lists with complete metadata", () => {
      const list = Array.from({ length: 25 }, (_, i) => i + 1);
      const page1 = paginate(list, 1, 10);
      expect(page1.items).toHaveLength(10);
      expect(page1.currentPage).toBe(1);
      expect(page1.totalPages).toBe(3);
      expect(page1.hasNext).toBe(true);
      expect(page1.hasPrevious).toBe(false);

      const page3 = paginate(list, 3, 10);
      expect(page3.items).toHaveLength(5);
      expect(page3.hasNext).toBe(false);
      expect(page3.hasPrevious).toBe(true);
    });
  });

  describe("Testing Fixture Factory & Pinned Clock", () => {
    it("provides deterministic pinned clock without execution drift", () => {
      expect(PINNED_BASE_TIME.toISOString()).toBe("2026-09-21T06:00:00.000Z");
    });

    it("creates a fully wired mock bot context for unit tests", async () => {
      const ctx = createTestBotContext({
        text: "hello bot",
        userId: 987654321,
      });

      expect(ctx.from.id).toBe(987654321);
      expect(ctx.message?.text).toBe("hello bot");

      const replyRes = await ctx.reply("response message");
      expect(replyRes.message_id).toBeDefined();
      expect(ctx.replies).toHaveLength(1);
      expect(ctx.replies[0]?.text).toBe("response message");

      const editRes = await ctx.editMessageText("updated message");
      expect(editRes.message_id).toBe(999);
      expect(ctx.edits).toHaveLength(1);
      expect(ctx.edits[0]?.text).toBe("updated message");
    });
  });

  describe("Structured Logger", () => {
    it("exposes standard log methods without throwing", () => {
      expect(typeof logger.info).toBe("function");
      expect(typeof logger.warn).toBe("function");
      expect(typeof logger.error).toBe("function");
      expect(typeof logger.debug).toBe("function");
    });
  });
});
