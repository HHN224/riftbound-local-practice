import { chromium } from "playwright";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const origin = "http://127.0.0.1:" + (process.env.FUXUAN_PORT || 4174);
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.stack));
  await page.goto(origin + "/fuxuan/");
  await page.getByText("人机对战 // VS AI", { exact: true }).waitFor();
  // Exercise the captured BaseZone's real candidate/selected styles without
  // changing the engine or depending on a specific spell's targeting rules.
  await page.evaluate(() => {
    const component = __r(1047).BaseZone,
      Original = component.type,
      React = __r(4);
    component.type = function (props) {
      const [selected, setSelected] = React.useState(
        new Set(["sandbox_card_p1-base-2"]),
      );
      return React.createElement(Original, {
        ...props,
        boardSelectCandidates: new Set([
          "sandbox_card_p1-base-1",
          "sandbox_card_p1-base-2",
        ]),
        boardSelectedIds: selected,
        onBoardSelect: (id) =>
          setSelected(new Set(selected.has(id) ? [] : [id])),
      });
    };
  });
  const draft = JSON.parse(
    await fs.readFile(
      "community/sandbox-reference/riftbound-sandbox/assets/before-combat.json",
      "utf8",
    ),
  );
  draft.players.p1.legend = { ref: "p1-legend", templateId: "VEN·149" };
  draft.players.p2.legend = { ref: "p2-legend", templateId: "SFD·187/221" };
  draft.players.p1.baseUnits.push({
    ref: "p1-base-2",
    templateId: "OGN·001/298",
    tapped: true,
  });
  await page.evaluate((d) => __r(841).sandboxStore.save(d), draft);
  await page.getByText("构筑", { exact: true }).click();
  await page.getByText("Sandbox", { exact: true }).click();
  await page.getByText("开始", { exact: true }).click();
  await page.getByTestId("card-flight:sandbox_card_p1-base-2").waitFor();
  await page.waitForTimeout(800);
  const hover = page.getByTestId("local-card-hover");
  for (const [x, y] of [
    [760, 670],
    [760, 160],
  ]) {
    await page.mouse.move(x, y);
    await page.waitForTimeout(400);
    assert.equal(
      await hover.isVisible(),
      false,
      "Decorative base art must not show a card preview",
    );
    await page.keyboard.press("i");
    assert.equal(await page.locator(".fx-modal").isVisible(), false);
  }
  for (const id of ["p1-legend", "p2-legend"]) {
    await page.getByTestId("card-flight:sandbox_card_" + id).hover();
    await hover.waitFor({ state: "visible" });
    assert((await hover.textContent()).trim().length > 0);
  }
  const tapped = page.getByTestId("card-motion:sandbox_card_p1-base-2");
  const frame = tapped.locator(".fx-selection-frame");
  assert.equal(
    await frame.count(),
    1,
    "Selection frame must be attached to the rotating card surface",
  );
  const face = await tapped.locator(":scope > div").boundingBox(),
    outline = await frame.boundingBox();
  assert(outline.width > outline.height, "Tapped selection must be landscape");
  assert(
    Math.abs(outline.width - face.width - 4) < 1 &&
      Math.abs(outline.height - face.height - 4) < 1,
    "Frame must hug the actual art",
  );
  assert.equal(
    await frame.evaluate((el) => getComputedStyle(el).borderTopColor),
    "rgb(232, 0, 28)",
  );
  await tapped.click();
  await page.waitForTimeout(100);
  assert.equal(
    await frame.evaluate((el) => getComputedStyle(el).borderTopColor),
    "rgb(255, 215, 0)",
  );
  await page.screenshot({ path: "community/test-results/board-feedback.png" });
  const thinking = page.getByTestId("local-ai-thinking");
  assert.equal(
    await thinking.isVisible(),
    false,
    "Manual Sandbox has no AI thinking",
  );
  const signal = async (active) =>
    page.evaluate(
      (active) =>
        FuxuanLocal.transport.deliver("serverMessage", {
          type: "aiThinking",
          payload: { aiPlayerId: "test-opponent", thinking: active },
        }),
      active,
    );
  await signal(true);
  await thinking.waitFor({ state: "visible" });
  assert.equal(
    await thinking.evaluate((el) => getComputedStyle(el).pointerEvents),
    "none",
  );
  await page.screenshot({ path: "community/test-results/ai-thinking.png" });
  await signal(false);
  assert.equal(await thinking.isVisible(), false);
  await signal(true);
  await page.evaluate(() =>
    FuxuanLocal.transport.deliver("serverMessage", {
      type: "aiDecision",
      payload: { aiPlayerId: "test-opponent" },
    }),
  );
  assert.equal(
    await thinking.isVisible(),
    false,
    "Decision clears the spinner",
  );
  await signal(true);
  await page.evaluate(() =>
    FuxuanLocal.transport.deliver("serverMessage", {
      type: "error",
      payload: { errors: ["test transport error"] },
    }),
  );
  assert.equal(await thinking.isVisible(), false, "Error clears the spinner");
  await page.evaluate(() => __r(841).useGameStore.setState({ lastErrors: [] }));
  assert.equal(
    await thinking.isVisible(),
    false,
    "Unrelated updates must not revive a failed request",
  );
  await signal(true);
  await page.evaluate(() =>
    __r(841).useGameStore.setState({ winner: "player" }),
  );
  assert.equal(
    await thinking.isVisible(),
    false,
    "Match end clears the spinner",
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: decorative art excluded, real legends readable, rotated selection colors/geometry, AI start/stop/decision/error/end feedback.",
  );
} finally {
  await browser.close();
}
