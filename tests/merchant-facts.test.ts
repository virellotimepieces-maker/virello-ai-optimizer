import { describe, expect, it } from "vitest";
import { merchantFactsMissingFromText, parseMerchantFacts } from "../app/api/_lib/merchant-facts";

const PRODUCTION_FACTS = parseMerchantFacts({
  material: "Stainless steel case with genuine leather strap",
  dimensions: "40 mm case diameter, 8 mm case thickness, 20 mm strap width",
  movement: "Japanese quartz movement",
  waterResistance: "3 ATM / 30 metres, splash resistant only",
  warranty: "1-year limited manufacturer warranty",
  intendedUse: "Everyday wear, office, casual outings, and formal occasions",
});

const SCREENSHOT_COPY =
  "The Sample Watch is a refined everyday accessory with a stainless steel case, genuine leather strap, and Japanese quartz movement, offering versatility and style";

describe("merchantFactsMissingFromText coverage", () => {
  it("does not treat material words as a substitute for dimension numbers", () => {
    expect(merchantFactsMissingFromText(PRODUCTION_FACTS, SCREENSHOT_COPY)).toEqual(
      expect.arrayContaining(["dimensions", "waterResistance", "warranty", "intendedUse"])
    );
    expect(merchantFactsMissingFromText(PRODUCTION_FACTS, SCREENSHOT_COPY)).not.toContain("material");
    expect(merchantFactsMissingFromText(PRODUCTION_FACTS, SCREENSHOT_COPY)).not.toContain("movement");
  });

  it("fails water resistance when no listed number is present, and accepts a 3 ATM paraphrase", () => {
    const waterOnly = parseMerchantFacts({
      waterResistance: "3 ATM / 30 metres, splash resistant only",
    });
    expect(merchantFactsMissingFromText(waterOnly, "splash resistant only")).toEqual([
      "waterResistance",
    ]);
    expect(merchantFactsMissingFromText(waterOnly, "water-resistant to 3 ATM")).toEqual([]);
  });

  it("still accepts kettle and tote facts that are actually present", () => {
    expect(
      merchantFactsMissingFromText(
        parseMerchantFacts({ material: "Stainless steel", intendedUse: "Boiling water" }),
        "North Kettle Electric Kettle has a stainless steel body for boiling water."
      )
    ).toEqual([]);
    expect(
      merchantFactsMissingFromText(
        parseMerchantFacts({
          material: "16 oz cotton canvas",
          dimensions: "18 x 14 x 6 in",
          warranty: "1 year limited",
          intendedUse: "Weekend travel",
        }),
        "Harbor Supply Weekender Tote is listed with 16 oz cotton canvas, 18 x 14 x 6 in. It is listed for Weekend travel, and includes 1 year limited."
      )
    ).toEqual([]);
  });
});
