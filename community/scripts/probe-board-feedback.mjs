import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser = await chromium.launch({channel:'msedge',headless:true});
const origin = 'http://127.0.0.1:'+(process.env.FUXUAN_PORT||4174);
try {
 const page = await browser.newPage({viewport:{width:1440,height:900}});
 const errors = [];
 page.on('pageerror', e => errors.push(e.stack));
 await page.goto(origin+'/fuxuan/');
 await page.getByText('人机对战 // VS AI',{exact:true}).waitFor();
 const draft = JSON.parse(await fs.readFile('community/sandbox-reference/riftbound-sandbox/assets/before-combat.json','utf8'));
 draft.players.p1.legend={ref:'p1-legend',templateId:'VEN·149'};
 draft.players.p2.legend={ref:'p2-legend',templateId:'SFD·187/221'};
 draft.players.p1.baseUnits.push({ref:'p1-base-2',templateId:'OGN·001/298',tapped:true});
 await page.evaluate(d=>__r(841).sandboxStore.save(d),draft);
 await page.getByText('构筑',{exact:true}).click();
 await page.getByText('Sandbox',{exact:true}).click();
 await page.getByText('开始',{exact:true}).click();
 await page.getByTestId('card-flight:sandbox_card_p1-base-2').waitFor();
 await page.waitForTimeout(800);
 const hover = page.getByTestId('local-card-hover');
 for (const [x,y] of [[760,670],[760,160]]) {
  await page.mouse.move(x,y);
  await page.waitForTimeout(400);
  assert.equal(await hover.isVisible(),false,'Decorative base art must not show a card preview');
  await page.keyboard.press('i');
  assert.equal(await page.locator('.fx-modal').isVisible(),false);
 }
 for (const id of ['p1-legend','p2-legend']) {
  await page.getByTestId('card-flight:sandbox_card_'+id).hover();
  await hover.waitFor({state:'visible'});
  assert((await hover.textContent()).trim().length>0);
 }
 assert.deepEqual(errors,[]);
 console.log('PASS: both playmats ignore hover/I; actual legend cards remain readable.');
} finally {await browser.close();}
