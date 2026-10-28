import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const recommendationCount = JSON.parse(
  await fs.readFile(
    new URL("../public/local/recommended-decks.json", import.meta.url),
    "utf8",
  ),
).decks.length;
const origin = "http://127.0.0.1:" + (process.env.FUXUAN_PORT || 4174);
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.stack));
  for (const viewport of [
    { width: 1366, height: 768 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto(origin + "/fuxuan/");
    const entry = page.getByTestId("open-personal-decks");
    await entry.waitFor();
    await page.waitForTimeout(400);
    const box = await entry.boundingBox();
    assert(
      box.x >= 0 &&
        box.y >= 0 &&
        box.x + box.width <= viewport.width &&
        box.y + box.height <= viewport.height,
    );
    assert(
      box.y > viewport.height / 2,
      "Entry belongs in bottom navigation, not header overlay",
    );
    assert.equal(await page.locator(".pd-shelf").count(), 0);
    const hit = await page
      .getByText("Sandbox", { exact: true })
      .evaluate((el) => {
        const r = el.getBoundingClientRect(),
          hit = document.elementFromPoint(
            r.x + r.width / 2,
            r.y + r.height / 2,
          );
        return el === hit || el.contains(hit);
      });
    assert(hit, "Original header control must remain unobstructed");
    await entry.click();
    const main = page.getByRole("main", { name: "个人卡组列表" });
    await main.waitFor();
    const expectedCurrent = await page.evaluate(() => {
      const store = __r(841).deckStore;
      return store.getDeck(
        store.getSelectedDeckId() ?? store.listDecks()[0]?.id,
      )?.name;
    });
    assert.equal(
      await page.locator(".pd-current-name").innerText(),
      expectedCurrent,
    );
    assert(page.url().endsWith("#my-decks"));
    assert.equal(
      await page.getByText("人机对战 // VS AI", { exact: true }).count(),
      0,
      "Main menu is unmounted, not covered by a modal",
    );
    assert.equal(
      await page
        .locator(".pd-page")
        .evaluate((el) => el.scrollWidth <= el.clientWidth),
      true,
    );
    await page.screenshot({
      path: `community/test-results/my-decks-${viewport.width}.png`,
    });
    await page.goBack();
    await entry.waitFor();
    await page.goForward();
    await main.waitFor();
    await page.reload();
    await main.waitFor();
    await page.waitForFunction(() => !!FuxuanLocal.personalDecks);
    assert.equal(await page.locator(".pd-deck").count(), recommendationCount);
    await page.getByTestId("personal-deck-search").fill("没有这套卡组");
    assert.equal(await page.locator(".pd-deck").count(), 0);
    assert(await page.locator(".pd-empty").isVisible());
    await page.getByTestId("personal-deck-search").fill("");
    await page.keyboard.press("Escape");
    await entry.waitFor();
    assert.equal(await entry.count(), 1);
    assert.equal(
      await entry.evaluate((el) => document.activeElement === el),
      true,
    );
  }
  // The independent page also reflows without a horizontal scrollbar on narrow windows.
  await page.setViewportSize({ width: 700, height: 900 });
  await page.goto(origin + "/fuxuan/#my-decks");
  await page.waitForFunction(() => !!FuxuanLocal.personalDecks);
  assert.equal(
    await page
      .locator(".pd-page")
      .evaluate((el) => el.scrollWidth <= el.clientWidth),
    true,
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: three desktop sizes, header hit target, real page navigation, back/forward/reload, search, Escape and narrow layout.",
  );
} finally {
  await browser.close();
}
