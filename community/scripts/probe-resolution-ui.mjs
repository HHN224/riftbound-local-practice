import { chromium } from "playwright";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
const origin = "http://127.0.0.1:" + (process.env.FUXUAN_PORT || 4174);
const browser = await chromium.launch({ channel: "msedge", headless: true });
const errors = [],
  report = [];
await fs.mkdir("community/test-results", { recursive: true });
try {
  const page = await browser.newPage();
  page.on("pageerror", (e) => errors.push(e.stack));
  await page.goto(origin + "/fuxuan/");
  await page.getByTestId("open-personal-decks").waitFor();
  const draft = JSON.parse(
    await fs.readFile(
      "community/sandbox-reference/riftbound-sandbox/assets/before-combat.json",
      "utf8",
    ),
  );
  draft.battlefields[0].templateId = "OGN·296/298";
  await page.evaluate((d) => __r(841).sandboxStore.save(d), draft);
  await page.getByText("构筑", { exact: true }).click();
  await page.getByText("Sandbox", { exact: true }).click();
  await page.getByText("开始", { exact: true }).click();
  await page.getByTestId("card-flight:sandbox_card_p1-base-1").waitFor();
  await page.waitForTimeout(700);
  // Replay presentation cues through the captured keyframe queue, not straight
  // into the formatting adapter. Assert real delta, signs, zero and damage.
  await page.evaluate(() => {
    window.floatLog = [];
    __r(994).subscribeFloats((items) =>
      items.forEach((item) => {
        if (!floatLog.some((x) => x.id === item.id)) floatLog.push(item);
      }),
    );
    const s = __r(841).useGameStore.getState();
    __r(841).useGameStore.setState({
      pendingKeyframes: [
        {
          id: "power-regression",
          eventKind: "presentation-test",
          cues: [
            ...[1, 2, 15, -2, 0].map((amount) => ({
              type: "power-modified",
              cardId: "sandbox_card_p1-base-1",
              amount,
            })),
            {
              type: "unit-damaged",
              cardId: "sandbox_card_p1-base-1",
              damage: 3,
            },
          ],
          display: {
            player: s.player,
            opponent: s.opponent,
            battlefields: s.battlefields,
            resolutionArea: [],
          },
        },
      ],
    });
  });
  await page.waitForFunction(() => floatLog.length === 5);
  assert.deepEqual(await page.evaluate(() => floatLog.map((f) => f.text)), [
    "+1 战力",
    "+2 战力",
    "+15 战力",
    "-2 战力",
    "-3",
  ]);
  await page.waitForTimeout(800);
  // Use the same original ResolutionStack as the screenshot. The three entries
  // cover a landscape battlefield, an upright card, and a tapped echo group.
  for (const viewport of [
    { width: 1366, height: 768 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
  ]) {
    await page.setViewportSize(viewport);
    await page.evaluate(() => {
      const s = __r(841).useGameStore.getState();
      __r(841).useGameStore.setState({
        resolutionArea: [
          {
            chainId: "field",
            card: { ...s.battlefields[0].card, id: "field-effect" },
            source: "player",
            status: "resolving",
          },
          {
            chainId: "upright",
            card: { ...s.player.hand[0], id: "upright-effect" },
            source: "opponent",
            status: "resolving",
          },
          {
            chainId: "tapped-echo",
            card: {
              ...s.player.unitArea[0],
              id: "tapped-effect",
              isTapped: true,
            },
            source: "player",
            status: "resolving",
            echoCount: 1,
          },
        ],
      });
    });
    await page.getByTestId("local-resolution-card-frame:field").waitFor();
    await page.waitForTimeout(850);
    for (const id of ["field", "upright", "tapped-echo"]) {
      const result = await page
        .getByTestId("resolution-stack-entry-" + id)
        .evaluate((entry) => {
          const frame = entry.querySelector(
            '[data-testid^="local-resolution-card-frame:"]',
          );
          const faces = [
            ...entry.querySelectorAll('[data-testid^="card-motion:"] > div'),
          ].map((el) => el.getBoundingClientRect());
          const left = Math.min(...faces.map((r) => r.left)),
            top = Math.min(...faces.map((r) => r.top));
          const right = Math.max(...faces.map((r) => r.right)),
            bottom = Math.max(...faces.map((r) => r.bottom));
          return {
            frame: frame.getBoundingClientRect().toJSON(),
            art: { left, top, right, bottom },
            color: getComputedStyle(frame).borderTopColor,
            pointer: getComputedStyle(frame).pointerEvents,
          };
        });
      for (const edge of ["left", "top", "right", "bottom"])
        assert(
          Math.abs(result.frame[edge] - result.art[edge]) < 1,
          `${viewport.width} ${id}: ${edge} must follow actual card/echo art`,
        );
      assert.equal(result.pointer, "none");
      assert.equal(
        result.color,
        id === "upright" ? "rgb(232, 0, 28)" : "rgb(96, 165, 250)",
      );
      report.push({ viewport, id, ...result });
    }
    await page.screenshot({
      path: `community/test-results/resolution-fixed-${viewport.width}.png`,
    });
  }
  // Turning the same instance upright must remove the landscape adjustment.
  await page.evaluate(() => {
    const s = __r(841).useGameStore.getState();
    __r(841).useGameStore.setState({
      resolutionArea: [
        {
          ...s.resolutionArea[2],
          echoCount: 0,
          card: { ...s.resolutionArea[2].card, isTapped: false },
        },
      ],
    });
  });
  await page.waitForTimeout(500);
  const upright = await page
    .getByTestId("local-resolution-card-frame:tapped-echo")
    .boundingBox();
  assert(upright.height > upright.width);
  await page.evaluate(() =>
    __r(841).useGameStore.setState({ resolutionArea: [] }),
  );
  await page
    .getByTestId("local-resolution-card-frame:tapped-echo")
    .waitFor({ state: "detached" });
  assert.deepEqual(errors, []);
  await fs.writeFile(
    "community/test-results/resolution-ui-results.json",
    JSON.stringify({ report, errors }, null, 2),
  );
  console.log(
    "PASS: native keyframe floats preserve 1/2/15/-2 and damage; resolution frames match landscape, portrait and tapped echo art at three sizes.",
  );
} finally {
  await browser.close();
}
