/**
 * End-to-end test in a real Chrome/Edge browser (playwright-core, no browser download).
 * Expected numbers were computed by hand from the Typical cost catalog (see tests/finance.test.ts).
 * Usage: npm run build && npm run preview   then   node tests/e2e.mjs
 *        BASE_URL=https://academiccat16.github.io/pricing-cost-dashboard/ node tests/e2e.mjs
 */
import { chromium } from "playwright-core";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const BASE = process.env.BASE_URL ?? "http://localhost:4174/pricing-cost-dashboard/";
const CHROME = process.env.CHROME_PATH ?? ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome"].find((p) => existsSync(p));
const PY = process.env.PYTHON ?? (existsSync("C:/Users/kapty/anaconda3/python.exe") ? "C:/Users/kapty/anaconda3/python.exe" : "python3");
const dir = (d) => { const u = new URL(d, import.meta.url); mkdirSync(u, { recursive: true }); return u; };
const SHOTS = dir("./screenshots/"), DL = dir("./downloads/");
const shot = (n) => fileURLToPath(new URL(n, SHOTS));
const dlPath = (n) => fileURLToPath(new URL(n, DL));

const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`); };

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text()}`); });
page.on("dialog", (d) => d.accept());

const nav = async (label) => { await page.locator("aside nav button", { hasText: label }).click(); await page.waitForTimeout(300); };
const headerKpis = async () => (await page.getByTestId("header-kpis").innerText()).replace(/\s+/g, " ");
const kpi = async (label) => (await page.locator(".panel").filter({ hasText: label }).first().innerText()).replace(/\s+/g, " ");
const fill = async (testid, value) => { const el = page.getByTestId(testid); await el.fill(String(value)); await el.blur(); await page.waitForTimeout(120); };

// ---------- 1. load & research import ----------
await page.goto(BASE, { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });
check("App loads", (await page.title()).includes("Pricing & Cost Lab"));
check("Venture facts imported from research", (await page.getByText("Jewelry / Journey (working concept name)").count()) > 0 && (await page.getByText("Sarah Bielski", { exact: true }).count()) > 0);
check("Website URLs prefilled", (await page.getByTestId("website-live").inputValue()) === "https://sarahbielski.github.io/Creative-Website/");
check("Default price $34.00 (preliminary midpoint)", (await headerKpis()).includes("Price $34.00"), await headerKpis());
check("Typical model: variable cost $20.25 / unit", (await kpi("Variable cost / unit")).includes("$20.25"));
check("Typical model: contribution $13.75 / unit", (await kpi("Contribution / unit")).includes("$13.75"));
check("Typical model: break-even 994 units", (await headerKpis()).includes("994 units"), await headerKpis());
check("Typical model: profit −$5,418 at 600 units", (await kpi("Operating profit")).includes("-$5,418"), await kpi("Operating profit"));
check("Typical model: startup cash $8,180", (await kpi("Startup cash")).includes("$8,180"), await kpi("Startup cash"));
await page.screenshot({ path: shot("01-overview.png"), fullPage: true });

// ---------- 2. cost structure ----------
await nav("Cost Structure");
const status = await page.getByText(/costs shown ·/).innerText();
check("37 venture-specific costs generated, 30 switched on (Typical)", status.includes("37 of 37") && status.includes("30 switched on"), status);
check("Benchmark markers shown (researched and illustrative)", (await page.locator('[aria-label^="Benchmark"]').count()) >= 10 && (await page.locator('[aria-label^="Illustrative reference"]').count()) >= 5);
check("Startup costs shown separately", await page.getByText("Startup costs", { exact: false }).first().isVisible());
await fill("amount-V06", 5);
check("Editing shipping to $5 updates break-even to 816 units", (await headerKpis()).includes("816 units"), await headerKpis());
check("Edited cost relabelled Student-Entered", (await page.locator(".panel", { has: page.getByTestId("amount-V06") }).innerText()).includes("Student-Entered"));
await page.locator(".panel", { has: page.getByTestId("amount-V06") }).getByRole("button", { name: "Restore" }).click();
check("Restore returns shipping to $8 and break-even to 994", (await headerKpis()).includes("994 units") && (await page.getByTestId("amount-V06").inputValue()) === "8");
const before = await page.getByTestId("amount-V05").inputValue();
await page.getByTestId("slider-V05").focus(); await page.keyboard.press("ArrowRight"); await page.waitForTimeout(100);
check("Slider moves amount (keyboard)", (await page.getByTestId("amount-V05").inputValue()) !== before, `${before} → ${await page.getByTestId("amount-V05").inputValue()}`);
await page.locator(".panel", { has: page.getByTestId("amount-V05") }).getByRole("button", { name: "Restore" }).click();
await page.getByRole("switch", { name: "Include Founder compensation" }).click();
check("Disabling founder pay ($6,000/yr) → break-even 558 units", (await headerKpis()).includes("558 units"), await headerKpis());
await page.getByRole("switch", { name: "Include Founder compensation" }).click();
check("Re-enabling restores 994 units", (await headerKpis()).includes("994 units"));
await page.getByTestId("add-expense").click();
await page.getByTestId("new-expense-name").fill("Packaging inserts subscription");
await fill("new-expense-amount", 100);
await page.getByTestId("save-expense").click();
const fixedTxt = await page.locator(".panel", { hasText: "Fixed costs / year" }).first().innerText();
check("Adding a $100/month custom fixed cost raises fixed costs by $1,200 (→ $14,871)", fixedTxt.includes("$14,871"), fixedTxt.split("\n").slice(0, 3).join(" "));
await page.locator('[data-testid^="delete-X"]').first().click();
check("Deleting the custom expense restores 994 units", (await headerKpis()).includes("994 units"));
await page.screenshot({ path: shot("02-costs.png"), fullPage: true });

// ---------- 3. products ----------
await nav("Products & Pricing");
await fill("price-input-0", 18);
check("Price $18 (below variable cost) → negative-margin warning", await page.getByTestId("negative-cm-warning").isVisible());
check("…and break-even shown as not achievable", (await headerKpis()).includes("not achievable"), await headerKpis());
await nav("Break-Even Analysis");
check("Break-even page explains no break-even", await page.getByTestId("no-breakeven").isVisible());
await nav("Products & Pricing");
await fill("price-input-0", 34);
await page.getByTestId("add-product").click();
check("Add product → 2 product cards with student-scenario label", (await page.locator('[data-testid^="product-name-"]').count()) === 2 && (await page.getByText("Student scenario").count()) >= 2);
check("Multi-product sales-mix note shown", await page.getByText(/Multi-product break-even uses your expected sales mix/).isVisible());
check("Product comparison table has 2 rows", (await page.locator("table").last().locator("tbody tr").count()) === 2);
await page.getByTestId("remove-product-1").click();
check("Remove product → back to 1 product, 994 units", (await page.locator('[data-testid^="product-name-"]').count()) === 1 && (await headerKpis()).includes("994 units"));
await page.screenshot({ path: shot("03-products.png"), fullPage: true });

// ---------- 4. break-even & charts ----------
await nav("Break-Even Analysis");
check("Break-even chart and price-sensitivity chart render", (await page.locator(".recharts-line").count()) >= 3);
check("Break-even price at current volume shown", /\$\d/.test(await page.getByTestId("be-price").innerText()), await page.getByTestId("be-price").innerText());
await page.screenshot({ path: shot("04-breakeven.png"), fullPage: true });

// ---------- 5. scenarios ----------
await nav("Cost Structure");
await page.getByTestId("preset-lean").click(); await page.waitForTimeout(200);
check("Lean preset → break-even 215 units", (await headerKpis()).includes("215 units"), await headerKpis());
await nav("Financial Scenarios");
check("Scenario table: current + 3 presets", (await page.getByTestId("scenario-table").locator("tbody tr").count()) === 4);
await page.getByTestId("scenario-name").fill("My lean test");
await page.getByTestId("save-scenario").click();
check("Saving a custom scenario adds a row", (await page.getByTestId("scenario-table").locator("tbody tr").count()) === 5);
await fill("vol-conservative", 40);
check("Volume scenario input accepted", (await page.getByTestId("vol-conservative").inputValue()) === "40");
await page.screenshot({ path: shot("05-scenarios.png"), fullPage: true });
await nav("Cost Structure");
await page.getByTestId("preset-typical").click(); await page.waitForTimeout(200);
check("Typical preset restores 994 units", (await headerKpis()).includes("994 units"), await headerKpis());

// ---------- 6. competition ----------
await nav("Competitive Position");
const cc = async () => [await page.getByTestId("comp-cheaper").innerText(), await page.getByTestId("comp-similar").innerText(), await page.getByTestId("comp-pricier").innerText()].join("/");
check("$34 → 2 cheaper / 0 similar / 3 pricier", (await cc()) === "2/0/3", await cc());
check("Research date shown, not live", await page.getByText("Research snapshot from 2026-10-27, not live prices.").isVisible());
await page.locator("main").getByRole("spinbutton", { name: "Exact price" }).fill("48"); await page.locator("main").getByRole("spinbutton", { name: "Exact price" }).blur();
check("$48 → BÉIS similar (2/1/2)", (await cc()) === "2/1/2", await cc());
await page.locator("main").getByRole("spinbutton", { name: "Exact price" }).fill("34"); await page.locator("main").getByRole("spinbutton", { name: "Exact price" }).blur();
await page.screenshot({ path: shot("06-competition.png"), fullPage: true });

// ---------- 7. review: evaluate, revise, confirm ----------
await nav("Pricing Decision Review");
check("Downloads not available before confirmation", (await page.getByTestId("download-docx").count()) === 0);
await page.getByTestId("evaluate").click(); await page.waitForTimeout(300);
const cls = await page.getByTestId("classification-label").innerText();
check("Default model (loss at 600 units) → High modeled risk", cls === "High modeled risk", cls);
check("Evidence confidence reported separately", (await page.getByTestId("evidence-confidence").innerText()).match(/Low|Medium|High/) != null);
check("Recommendations include reasons", (await page.getByTestId("recommendations").innerText()).includes("Why:"));
await page.getByTestId("revise").click(); await page.waitForTimeout(300);
check("Revise returns to Products with inputs intact", (await page.getByTestId("price-display-0").innerText()) === "$34.00");
await fill("qty-input-0", 1200);
await page.getByTestId("volume-evidence-0").fill("Waitlist of 400 sign-ups plus a planned pre-order campaign");
await nav("Pricing Decision Review");
check("Changing inputs marks evaluation outdated", await page.getByTestId("evaluation-outdated").isVisible());
check("Confirm disabled while evaluation is outdated", await page.getByTestId("open-confirm").isDisabled());
await page.getByTestId("evaluate").click(); await page.waitForTimeout(300);
const cls2 = await page.getByTestId("classification-label").innerText();
check("Re-evaluation at 1,200 units (profit, MOS 17%) → Moderate modeled risk", cls2 === "Moderate modeled risk", cls2);
await page.getByTestId("open-confirm").click();
const ackCount = await page.locator('[data-testid^="ack-"]').count();
const just = "I chose $34 because it sits inside the $29-$39 research range, above Lolalet and BAGSMART but well below BÉIS. My costs give a $13.75 contribution per unit, and I will reduce shipping cost next.";
await page.getByTestId("justification").fill(just);
if (ackCount > 0) check("Confirm blocked until warnings acknowledged", await page.getByTestId("confirm-decision").isDisabled());
for (let i = 0; i < ackCount; i++) await page.getByTestId(`ack-${i}`).check();
check("Confirm enabled after justification (+ acknowledgements)", await page.getByTestId("confirm-decision").isEnabled(), `${ackCount} warnings`);
await page.getByTestId("confirm-decision").click(); await page.waitForTimeout(300);
check("Decision confirmed", await page.getByTestId("confirmed").isVisible());
await page.screenshot({ path: shot("07-review.png"), fullPage: true });

// ---------- 8. downloads ----------
const [d1] = await Promise.all([page.waitForEvent("download"), page.getByTestId("download-docx").click()]);
await d1.saveAs(dlPath("Pricing_Decision_Report.docx"));
check("DOCX download filename", d1.suggestedFilename() === "Pricing_Decision_Report.docx", d1.suggestedFilename());
const [d2] = await Promise.all([page.waitForEvent("download"), page.getByTestId("download-json").click()]);
await d2.saveAs(dlPath("Pricing_Decision_Data.json"));
check("JSON download filename", d2.suggestedFilename() === "Pricing_Decision_Data.json");
let data = null;
try { data = JSON.parse(readFileSync(dlPath("Pricing_Decision_Data.json"), "utf8")); } catch { /* */ }
check("JSON is valid", !!data);
check("JSON: price, website URLs, justification", data?.finalPrices?.[0]?.price === 34 && data?.website?.liveUrl === "https://sarahbielski.github.io/Creative-Website/" && data?.studentJustification === just);
check("JSON: risk classification matches the evaluation", data?.riskFindings?.classification === "Moderate modeled risk");
check("JSON: acknowledged warnings recorded", Array.isArray(data?.confirmation?.acknowledgedWarnings) && data.confirmation.acknowledgedWarnings.length === ackCount);
const cf = data?.products?.[0]?.customerFacing ?? {};
check("JSON: customer-facing block has no cost data", !JSON.stringify(cf).match(/cost|margin|profit|break/i) && cf.displayPrice === "$34.00", Object.keys(cf).join(","));
check("JSON: operating profit at 1,200 units = 1,200×13.754 − 13,670.67 ≈ $2,834", Math.abs(data?.financialAssumptions?.results?.operatingProfit - (1200 * (34 - 20.246) - (13404 + 800 / 3))) < 0.01, String(data?.financialAssumptions?.results?.operatingProfit));
let docxReport = "";
try { docxReport = execFileSync(PY, [fileURLToPath(new URL("./validate_docx.py", import.meta.url)), dlPath("Pricing_Decision_Report.docx"), dlPath("Pricing_Decision_Data.json")], { encoding: "utf8" }); } catch (e) { docxReport = String(e.stdout ?? e.message); }
console.log(docxReport.trim().split("\n").map((l) => "      " + l).join("\n"));
check("DOCX is a valid Word document consistent with the JSON (python-docx)", docxReport.includes("DOCX_VALID") && docxReport.includes("CONSISTENT"));

// ---------- 9. dynamic re-evaluation after confirmation ----------
await nav("Products & Pricing");
await fill("price-input-0", 36);
await nav("Pricing Decision Review");
check("Changing price after confirming marks confirmation outdated", await page.getByTestId("confirmation-outdated").isVisible());
check("…and hides the downloads", (await page.getByTestId("download-docx").count()) === 0);

// ---------- 10. persistence & export ----------
await page.reload({ waitUntil: "networkidle" });
check("Work persists after reload (price $36.00, confirmation kept)", (await headerKpis()).includes("$36.00") && (await page.getByTestId("confirmation-outdated").isVisible()));
await nav("Business Overview");
const [d3] = await Promise.all([page.waitForEvent("download"), page.getByTestId("export-config").click()]);
await d3.saveAs(dlPath("config.json"));
let cfg = null; try { cfg = JSON.parse(readFileSync(dlPath("config.json"), "utf8")); } catch { /* */ }
check("Configuration export is valid and restorable", cfg?.version === 1 && cfg?.model?.products?.[0]?.price === 36);
await page.getByTestId("import-config").setInputFiles(dlPath("config.json"));
await page.waitForTimeout(300);
check("Configuration import accepted", await page.getByText(/Imported “config.json”/).isVisible());

// ---------- 11. deep link & mobile ----------
await page.goto(BASE + "#review", { waitUntil: "networkidle" });
check("Deep link #review opens the review", await page.getByTestId("evaluate").isVisible());
const mob = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
mob.on("pageerror", (e) => errors.push(`mobile: ${e.message}`));
for (const id of ["overview", "costs", "products", "breakeven", "scenarios", "competition", "review"]) {
  await mob.goto(BASE + "#" + id, { waitUntil: "networkidle" }); await mob.waitForTimeout(700);
  const over = await mob.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(`Mobile ${id}: no page-level horizontal overflow`, over <= 1, `${over}px`);
  await mob.screenshot({ path: shot(`m-${id}.png`), fullPage: true });
}
await mob.getByRole("button", { name: "Open navigation" }).click();
await mob.locator("aside nav button", { hasText: "Products & Pricing" }).click();
check("Mobile navigation works", await mob.getByTestId("price-display-0").isVisible());

check("No runtime errors in console", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
