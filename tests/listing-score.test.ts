import { describe, expect, it } from "vitest";
import { gradeForScore, scoreLimitExplanation, scoreListing } from "../app/api/_lib/listing-score";

describe("Listing score honesty", () => {
  it("does not call 62 Ready to convert", () => {
    expect(gradeForScore(61)).toBe("needs_work");
    expect(gradeForScore(62)).toBe("needs_work");
    expect(gradeForScore(69)).toBe("needs_work");
    expect(gradeForScore(70)).toBe("good");
    expect(gradeForScore(80)).toBe("strong");
    expect(gradeForScore(90)).toBe("excellent");
  });

  it("explains which missing facts limit a sparse score", () => {
    const notes = scoreLimitExplanation([
      "Materials are not listed.",
      "Movement or power details are not listed.",
    ]);
    expect(notes[0]).toMatch(/limited by missing product facts/i);
    expect(notes.join(" ")).toMatch(/Materials are not listed/);
  });

  it("does not award conversion points for generic merchant notes", () => {
    const scored = scoreListing({
      sourceTitle: "Sample Watch",
      title: "Sample Watch",
      description: "Sample Watch is a watch. No further specifications are provided on this listing.",
      benefitBullets: ["Listed as a watch"],
      seoTitle: "Sample Watch",
      metaDescription: "Sample Watch appears as a watch on this product page, with no further specifications.",
      tags: ["Watch", "Sample"],
      callToAction: "Review the listed details for Sample Watch.",
      conversionCopy:
        "This score is limited because only the product name and type are listed. Add material, movement, dimensions, water resistance, coverage period, or intended use.",
      conversionOpportunities: ["Lead with verified product facts only.", "Name missing specifications in merchant notes."],
      objections: 1,
      targetCustomer: "Shoppers considering watch from the facts on this listing.",
      missingInformation: 6,
    });
    expect(scored.grade).toBe("needs_work");
    expect(scored.conversion).toBeLessThan(70);
  });
});
