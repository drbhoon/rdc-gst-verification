/**
 * Company Master Registry for RDC Concrete and its subsidiaries.
 * Provides state-wise GSTIN lookups, PAN identification, and plant/location auto-resolution.
 */

export interface StateGstinRecord {
  stateCode: string;
  stateName: string;
  gstin: string;
  tradeName?: string;
  isRegistered?: boolean;
}

export interface CompanyEntity {
  id: string;
  name: string;
  shortName: string;
  pan: string;
  aliases: string[];
  stateGstins: Record<string, StateGstinRecord>;
}

export const INDIAN_STATES: Record<string, string> = {
  "01": "Jammu & Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal Pradesh",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  "26": "Dadra & Nagar Haveli and Daman & Diu",
  "27": "Maharashtra",
  "29": "Karnataka",
  "30": "Goa",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "36": "Telangana",
  "37": "Andhra Pradesh",
};

/**
 * Known plant, site, and office location keywords mapped to Indian state codes.
 */
export const LOCATION_STATE_KEYWORDS: Record<string, string[]> = {
  "06": [
    "kharkhoda",
    "sonipat",
    "sonepat",
    "gurgaon",
    "gurugram",
    "faridabad",
    "panipat",
    "rohtak",
    "haryana",
    "manesar",
    "bhiwadi",
    "131402",
    "122001",
    "122002",
    "121001",
    "121002",
    "121003",
  ],
  "07": [
    "ghevra",
    "ghevara",
    "rohtak road",
    "delhi",
    "new delhi",
    "jahangirpuri",
    "shalimar bagh",
    "okhla",
    "narela",
    "mayapuri",
    "110041",
    "110081",
    "110033",
    "110020",
    "110064",
  ],
  "27": [
    "turbhe",
    "navi mumbai",
    "mumbai",
    "pune",
    "nagpur",
    "thane",
    "chakan",
    "talegaon",
    "bhiwandi",
    "panvel",
    "maharashtra",
    "400001",
    "400705",
    "411001",
    "440001",
  ],
  "29": [
    "bengaluru",
    "bangalore",
    "whitefield",
    "electronic city",
    "peenya",
    "bommasandra",
    "karnataka",
    "560001",
    "560066",
    "560100",
  ],
  "36": [
    "hyderabad",
    "secunderabad",
    "kondapur",
    "gachibowli",
    "patancheru",
    "medchal",
    "telangana",
    "500001",
    "500032",
    "500081",
  ],
  "37": [
    "visakhapatnam",
    "vijayawada",
    "guntur",
    "tirupati",
    "andhra",
    "andhra pradesh",
    "520001",
    "530001",
  ],
  "24": [
    "ahmedabad",
    "surat",
    "vadodara",
    "baroda",
    "sanand",
    "morbi",
    "gujarat",
    "380001",
    "395001",
    "390001",
  ],
  "08": [
    "jaipur",
    "neemrana",
    "alwar",
    "jodhpur",
    "udaipur",
    "rajasthan",
    "302001",
    "301001",
  ],
  "19": [
    "kolkata",
    "calcutta",
    "howrah",
    "durgapur",
    "siliguri",
    "bengal",
    "west bengal",
    "700001",
    "711101",
  ],
  "09": [
    "noida",
    "greater noida",
    "ghaziabad",
    "lucknow",
    "kanpur",
    "uttar pradesh",
    "201301",
    "201001",
  ],
  "33": [
    "chennai",
    "sriperumbudur",
    "oragadam",
    "coimbatore",
    "tamil nadu",
    "600001",
    "602105",
  ],
};

/**
 * Company Master Entities Directory.
 */
export const COMPANY_MASTER: CompanyEntity[] = [
  {
    id: "rdc-concrete",
    name: "RDC Concrete (India) Limited",
    shortName: "RDC Concrete",
    pan: "AAACU0108Q",
    aliases: [
      "RDC CONCRETE",
      "RDC CONCACKE",
      "RDC CONCRETE (INDIA) LIMITED",
      "RDC CONCRETE (INDIA) LTD",
      "RDC CONCRETE INDIA",
      "RDC",
    ],
    stateGstins: {
      "06": { stateCode: "06", stateName: "Haryana", gstin: "06AAACU0108Q1ZC", tradeName: "Kharkhoda / Sonipat Plant" },
      "07": { stateCode: "07", stateName: "Delhi", gstin: "07AAACU0108Q2Z9", tradeName: "Ghevra / Delhi Office" },
      "27": { stateCode: "27", stateName: "Maharashtra", gstin: "27AAACU0108Q1Z8", tradeName: "Mumbai / Head Office" },
      "29": { stateCode: "29", stateName: "Karnataka", gstin: "29AAACU0108Q1Z4", tradeName: "Bengaluru Plants" },
      "36": { stateCode: "36", stateName: "Telangana", gstin: "36AAACU0108Q2Z8", tradeName: "Hyderabad Plants" },
      "24": { stateCode: "24", stateName: "Gujarat", gstin: "24AAACU0108Q1ZE", tradeName: "Ahmedabad / Surat Plants" },
      "33": { stateCode: "33", stateName: "Tamil Nadu", gstin: "33AAACU0108Q1ZF", tradeName: "Chennai Plants" },
      "08": { stateCode: "08", stateName: "Rajasthan", gstin: "08AAACU0108Q1Z8", tradeName: "Rajasthan Operations" },
      "19": { stateCode: "19", stateName: "West Bengal", gstin: "19AAACU0108Q1Z5", tradeName: "Kolkata Operations" },
      "09": { stateCode: "09", stateName: "Uttar Pradesh", gstin: "09AAACU0108Q1Z6", tradeName: "Noida / NCR Plants" },
    },
  },
  {
    id: "robo-silicon",
    name: "Robo Silicon Private Limited",
    shortName: "Robo Silicon",
    pan: "AABCR6567R",
    aliases: [
      "ROBO SILICON",
      "ROBO SILICON PRIVATE LIMITED",
      "ROBO SILICON PVT LTD",
      "ROBOSAND",
      "ROBO SILICON LTD",
    ],
    stateGstins: {
      "06": { stateCode: "06", stateName: "Haryana", gstin: "06AABCR6567R1ZL", tradeName: "Haryana Plants" },
      "36": { stateCode: "36", stateName: "Telangana", gstin: "36AABCR6567R1ZI", tradeName: "Hyderabad HQ / Plants" },
      "29": { stateCode: "29", stateName: "Karnataka", gstin: "29AABCR6567R1ZD", tradeName: "Bengaluru Plants" },
      "37": { stateCode: "37", stateName: "Andhra Pradesh", gstin: "37AABCR6567R2ZF", tradeName: "AP Operations" },
      "19": { stateCode: "19", stateName: "West Bengal", gstin: "19AABCR6567R1ZE", tradeName: "West Bengal Plants" },
      "27": { stateCode: "27", stateName: "Maharashtra", gstin: "27AABCR6567R1ZH", tradeName: "Maharashtra Operations" },
      "07": { stateCode: "07", stateName: "Delhi", gstin: "07AABCR6567R1ZJ", tradeName: "Delhi Operations" },
    },
  },
  {
    id: "ultrafine-minerals",
    name: "Ultrafine Minerals & Admixtures Private Limited",
    shortName: "Ultrafine Minerals",
    pan: "AACCU5797P",
    aliases: [
      "ULTRAFINE MINERALS",
      "ULTRAFINE MINERAL",
      "ULTRAFINE MINERAL & ADMIXTURES",
      "ULTRAFINE MINERALS & ADMIXTURES PRIVATE LIMITED",
      "ULTRAFINE MINERALS & ADMIXTURES PVT LTD",
    ],
    stateGstins: {
      "27": { stateCode: "27", stateName: "Maharashtra", gstin: "27AACCU5797P1ZB", tradeName: "Nagpur / Maharashtra HQ" },
      "06": { stateCode: "06", stateName: "Haryana", gstin: "06AACCU5797P1ZF", tradeName: "Haryana Operations" },
      "07": { stateCode: "07", stateName: "Delhi", gstin: "07AACCU5797P1ZD", tradeName: "Delhi Operations" },
      "24": { stateCode: "24", stateName: "Gujarat", gstin: "24AACCU5797P1ZH", tradeName: "Gujarat Operations" },
      "29": { stateCode: "29", stateName: "Karnataka", gstin: "29AACCU5797P1Z7", tradeName: "Karnataka Operations" },
      "36": { stateCode: "36", stateName: "Telangana", gstin: "36AACCU5797P1ZC", tradeName: "Telangana Operations" },
    },
  },
];

export interface AutoResolutionResult {
  company: CompanyEntity;
  stateCode: string;
  stateName: string;
  gstin: string;
  matchedLocation: string;
  detectionType: "plant_location" | "billing_address" | "repaired_gstin" | "default";
  confidence: number;
  explanation: string;
  alternativeOptions?: Array<{
    label: string;
    gstin: string;
    stateName: string;
    stateCode: string;
  }>;
}

/**
 * Attempts to repair noisy/OCR-corrupted candidate GSTIN tokens.
 * E.g. "OTAAACU00084229" -> cleans digits/letters, recognizes PAN AAACU0108Q, State 07 -> "07AAACU0108Q2Z9"
 */
export function repairOcrGstin(token: string): string | null {
  const clean = token.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (clean.length < 13 || clean.length > 17) return null;

  for (const company of COMPANY_MASTER) {
    const pan = company.pan;
    // Check if token contains or closely resembles the company PAN
    const panIdx = clean.indexOf(pan);
    if (panIdx !== -1) {
      // Look at the 2 chars preceding PAN for state code
      let statePrefix = clean.slice(Math.max(0, panIdx - 2), panIdx);
      statePrefix = statePrefix.replace(/O/g, "0").replace(/I|L/g, "1").replace(/Z/g, "2").replace(/S/g, "5").replace(/B/g, "8").replace(/T/g, "7");
      if (statePrefix.length === 2 && /^\d{2}$/.test(statePrefix)) {
        const stateRecord = company.stateGstins[statePrefix];
        if (stateRecord) {
          return stateRecord.gstin;
        }
      }
    }

    // Fuzzy check for PAN variations (e.g. 0008 instead of 0108 or 4 instead of Q)
    const panPrefix = pan.slice(0, 5); // e.g. "AAACU"
    const panPrefixIdx = clean.indexOf(panPrefix);
    if (panPrefixIdx !== -1) {
      let statePrefix = clean.slice(Math.max(0, panPrefixIdx - 2), panPrefixIdx);
      statePrefix = statePrefix.replace(/O/g, "0").replace(/I|L/g, "1").replace(/Z/g, "2").replace(/S/g, "5").replace(/B/g, "8").replace(/T/g, "7");
      if (statePrefix.length === 2 && /^\d{2}$/.test(statePrefix)) {
        const stateRecord = company.stateGstins[statePrefix];
        if (stateRecord) {
          return stateRecord.gstin;
        }
      }
    }
  }

  return null;
}

/**
 * Intelligent company & state resolution from full invoice and email/attachment text.
 * Prioritizes plant or delivery locations (e.g. Kharkhoda/Sonipat -> Haryana 06)
 * over generic billing addresses.
 */
export function resolveCompanyAndState(rawText: string, defaultCompanyId = "rdc-concrete"): AutoResolutionResult {
  const lowerText = rawText.toLowerCase();

  // 1. Identify which entity this invoice belongs to
  let matchedCompany = COMPANY_MASTER.find((c) => c.id === defaultCompanyId) || COMPANY_MASTER[0];
  let entityScore = 0;

  for (const company of COMPANY_MASTER) {
    let score = 0;
    if (lowerText.includes(company.pan.toLowerCase())) score += 10;
    for (const alias of company.aliases) {
      if (lowerText.includes(alias.toLowerCase())) {
        score += 5;
      }
    }
    if (score > entityScore) {
      entityScore = score;
      matchedCompany = company;
    }
  }

  // 2. Scan for Plant / Delivery location keywords (highest priority per user requirement: "Always auto-fill based on detected plant or delivery location")
  const plantMatches: Array<{ stateCode: string; keyword: string; isExplicitPlant: boolean }> = [];
  const billingMatches: Array<{ stateCode: string; keyword: string }> = [];

  for (const [stateCode, keywords] of Object.entries(LOCATION_STATE_KEYWORDS)) {
    for (const kw of keywords) {
      const idx = lowerText.indexOf(kw.toLowerCase());
      if (idx !== -1) {
        // Check context around keyword for "plant", "site", "kharkhoda", "kila", "work", "expenses for"
        const window = lowerText.slice(Math.max(0, idx - 100), Math.min(lowerText.length, idx + 100));
        const isPlantContext =
          window.includes("plant") ||
          window.includes("site") ||
          window.includes("kila") ||
          window.includes("kharkhoda") ||
          window.includes("delivery") ||
          window.includes("expenses for") ||
          window.includes("approval");

        if (isPlantContext) {
          plantMatches.push({ stateCode, keyword: kw, isExplicitPlant: true });
        } else {
          billingMatches.push({ stateCode, keyword: kw });
        }
      }
    }
  }

  // Also check if an OCR-repaired GSTIN token is present on the invoice for alternative option
  let repairedGstin: string | null = null;
  const tokens = rawText.split(/[\s,;|:]+/);
  for (const token of tokens) {
    const rep = repairOcrGstin(token);
    if (rep) {
      repairedGstin = rep;
      break;
    }
  }

  // If explicit plant match found, use it! (e.g. Kharkhoda / Sonipat -> Haryana)
  if (plantMatches.length > 0) {
    const bestPlant = plantMatches[0];
    const stateRecord = matchedCompany.stateGstins[bestPlant.stateCode];
    if (stateRecord) {
      const altOptions: AutoResolutionResult["alternativeOptions"] = [];
      // If repaired GSTIN is from a different state (e.g. Delhi Billing), add as alternative
      if (repairedGstin && repairedGstin !== stateRecord.gstin) {
        const repStateCode = repairedGstin.slice(0, 2);
        altOptions.push({
          label: `${INDIAN_STATES[repStateCode] || repStateCode} (Billing Address)`,
          gstin: repairedGstin,
          stateName: INDIAN_STATES[repStateCode] || repStateCode,
          stateCode: repStateCode,
        });
      }
      for (const b of billingMatches) {
        if (b.stateCode !== bestPlant.stateCode && matchedCompany.stateGstins[b.stateCode]) {
          if (!altOptions.some((o) => o.stateCode === b.stateCode)) {
            altOptions.push({
              label: `${INDIAN_STATES[b.stateCode] || b.stateCode} (Billing: ${b.keyword})`,
              gstin: matchedCompany.stateGstins[b.stateCode].gstin,
              stateName: INDIAN_STATES[b.stateCode] || b.stateCode,
              stateCode: b.stateCode,
            });
          }
        }
      }

      return {
        company: matchedCompany,
        stateCode: bestPlant.stateCode,
        stateName: stateRecord.stateName,
        gstin: stateRecord.gstin,
        matchedLocation: `${bestPlant.keyword.toUpperCase()} (Plant / Delivery Site)`,
        detectionType: "plant_location",
        confidence: 0.98,
        explanation: `Auto-resolved from detected delivery/plant site: ${bestPlant.keyword} (${stateRecord.stateName})`,
        alternativeOptions: altOptions.slice(0, 2),
      };
    }
  }

  // 3. If no plant match, use OCR-repaired GSTIN on the invoice if present
  if (repairedGstin) {
    const stateCode = repairedGstin.slice(0, 2);
    const stateName = INDIAN_STATES[stateCode] || "State " + stateCode;
    return {
      company: matchedCompany,
      stateCode,
      stateName,
      gstin: repairedGstin,
      matchedLocation: `Repaired from invoice token`,
      detectionType: "repaired_gstin",
      confidence: 0.96,
      explanation: `Identified ${matchedCompany.shortName} (${stateName}) from invoice text`,
    };
  }

  // 4. Otherwise, use billing address match (e.g. Ghevra / Delhi -> Delhi)
  if (billingMatches.length > 0) {
    const bestBilling = billingMatches[0];
    const stateRecord = matchedCompany.stateGstins[bestBilling.stateCode];
    if (stateRecord) {
      return {
        company: matchedCompany,
        stateCode: bestBilling.stateCode,
        stateName: stateRecord.stateName,
        gstin: stateRecord.gstin,
        matchedLocation: `${bestBilling.keyword.toUpperCase()} (Address)`,
        detectionType: "billing_address",
        confidence: 0.92,
        explanation: `Auto-resolved from address keyword: ${bestBilling.keyword} (${stateRecord.stateName})`,
      };
    }
  }

  // 5. Default fallback (HQ / Maharashtra)
  const defaultRecord = matchedCompany.stateGstins["27"] || Object.values(matchedCompany.stateGstins)[0];
  return {
    company: matchedCompany,
    stateCode: defaultRecord.stateCode,
    stateName: defaultRecord.stateName,
    gstin: defaultRecord.gstin,
    matchedLocation: "Default / Head Office",
    detectionType: "default",
    confidence: 0.5,
    explanation: `Defaulted to ${matchedCompany.shortName} (${defaultRecord.stateName})`,
  };
}
