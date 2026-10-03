const text = `TAX INVOICE NO:- ITC-198/26-27	
24-06-2026	
To,	FROM,	
M/s. RDC Concrete India Pvt Ltd	INFO TECH COMPUTERS	
7th floor, Thane One, 701	NEAR PODDAR COLLEGE STATION ROAD	
Ghodbunder Road, Dil Complex,	NAWALGARH DIS.-JHUNJHUNU	
Kapurbawdi Thane -400610	RAJASTHAN -333042	
GSTN No - 27AAACU0108Q2Z7	GSTN NO 08BAGPS7968Q2ZD	
The Total Invoice details for 01-APR-2026 TO 30-JUN- 2026	
period	Net Amount	LIGST	[Total Amount	
1 APR 2026 TO 30 APR 2026	8100	1458	9558	
1 MAY 2026 TO 31 MAY 2026	8100	1458	9558	
1 JUN 2026 TO 30 JUN 2026	8100	1458	9558	
TOTAL	24300	4374	28674	
INFO TECH COMPUTERS	
Pusnpendal-	PROPRIETOR	
Scanned with OKEN Scanner`;

const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

// 1. Invoice Number
let invoiceNumber = "";
const expMatch = text.match(/(?:Invoice|Inv|Tax\s*Invoice|Bill)\s*(?:No|#|Number)?\s*[:.\s|=-]+\s*([A-Za-z0-9/_-]+)/i);
if (expMatch) {
  const cand = expMatch[1].trim().replace(/^[-/_.]+/, "").replace(/[-/_.]+$/, "");
  if (cand.length > 1 && !["dated", "date", "sac", "hsn", "terms", "mode"].includes(cand.toLowerCase())) {
    invoiceNumber = cand.replace(/^([A-Za-z]{2,})[Il|](\d)/, "$1/$2");
  }
}
console.log("Extracted invoiceNumber:", invoiceNumber);

// 2. Invoice Date
let invoiceDate = "";
// Check lines before the table for standalone date
for (let i = 0; i < Math.min(10, lines.length); i++) {
  const line = lines[i];
  if (/TOTAL|PERIOD|AMOUNT|GSTIN|GSTN/i.test(line)) continue;
  const m = line.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})\b/);
  if (m) {
    invoiceDate = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    break;
  }
}
console.log("Extracted invoiceDate:", invoiceDate);

// 3. Table TOTAL Row
let invoiceValue;
let taxableValue;

for (const line of lines) {
  if (/^TOTAL\b/i.test(line)) {
    const nums = [...line.matchAll(/\b(?:\d{1,3}(?:,\d{2,3})+|\d+)(?:\.\d{1,2})?\b/g)]
      .map(m => Number(m[0].replace(/,/g, "")))
      .filter(n => !Number.isNaN(n) && n > 0);
    console.log("TOTAL line numbers:", nums);
    if (nums.length >= 3) {
      // Typically: [taxable, tax, total] or [taxable, cgst, sgst, total]
      const [n1, n2, n3] = nums;
      if (Math.abs((n1 + n2) - n3) < 2.5) {
        taxableValue = n1;
        invoiceValue = n3;
      }
    } else if (nums.length === 2) {
      taxableValue = Math.min(...nums);
      invoiceValue = Math.max(...nums);
    } else if (nums.length === 1) {
      invoiceValue = nums[0];
    }
  }
}
console.log("Extracted taxableValue:", taxableValue, "invoiceValue:", invoiceValue);

