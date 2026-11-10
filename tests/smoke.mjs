import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));

const seed = {
  daily: {
    [new Date().toISOString().slice(0,10)]: {
      todo: [{ id: 'smoke-task-1', text: 'Smoke test quest', done: false }],
      sleep: 7
    }
  },
  habits: [{ name: 'Smoke habit', freq: 'Daily', done: [] }],
  dogs: [
    { name: 'Test Dog One', breed: 'Cairn Terrier', age: '8', weight: '20 lb', medications: 'None', allergies: 'None', notes: 'Profile test', symptoms: [{ symptom: 'Itching', date: '2026-11-01', severity: 'Mild', kind: 'New symptom', duration: '1 day', notes: 'Original entry' }] },
    { name: 'Test Dog Two', breed: 'Cairn Terrier', symptoms: [] }
  ],
  books: [{ name: 'Test Book', author: 'Test Author', status: 'Reading', pages: '10', total: '100' }],
  hobbies: [], recipes: [], income: [], expenses: [], bills: [], workDays: {}, occ: [], layoffs: [], art: {}, prefs: { waterGoal: 8 }
};
await page.addInitScript(data => localStorage.setItem('crawler-command-center', JSON.stringify(data)), seed);
await page.goto('http://127.0.0.1:4173', { waitUntil: 'load' });
await page.waitForSelector('#view');

assert.equal(await page.locator('#nav').isVisible(), false, 'top navigation should be hidden');
assert.match(await page.locator('#view').innerText(), /Dungeon/i, 'dashboard should include Dungeon tile');

// Neighborhood boss, objective completion, defeat, trophy and XP
await page.evaluate(() => go('dungeon'));
await page.locator('#rpgBossForm input[name="name"]').fill('Neighborhood Test Boss');
await page.locator('#rpgBossForm select[name="tier"]').selectOption('Neighborhood Boss');
await page.locator('#rpgBossForm textarea[name="objectives"]').fill('Complete smoke test objective');
await page.locator('#rpgBossForm button').last().click();
await page.getByText('Neighborhood Test Boss', { exact: true }).waitFor();
await page.locator('input[type="checkbox"]').last().check();
await page.getByRole('button', { name: 'Confirm boss defeat' }).click();
await page.waitForFunction(() => JSON.parse(localStorage.getItem('crawler-command-center')).rpg.trophies.length === 1);
assert.ok(await page.locator('#view').innerText().then(t => t.includes('DEFEATED')));

// Borough boss must have a Neighborhood prerequisite
const neighborhoodId = await page.evaluate(() => JSON.parse(localStorage.getItem('crawler-command-center')).rpg.bosses[0].id);
await page.locator('#rpgBossForm input[name="name"]').fill('Borough Test Boss');
await page.locator('#rpgBossForm select[name="tier"]').selectOption('Borough Boss');
await page.locator('#rpgBossForm select[name="prereqs"]').selectOption(neighborhoodId);
await page.locator('#rpgBossForm button').last().click();
await page.getByText('Borough Test Boss', { exact: true }).waitFor();
assert.match(await page.locator('#view').innerText(), /UNLOCKED/, 'borough boss should unlock after prerequisite defeat');

await page.evaluate(() => go('trophies'));
assert.match(await page.locator('#view').innerText(), /Neighborhood Test Boss/, 'trophy should be retained');
await page.evaluate(() => go('achievements'));
assert.match(await page.locator('#view').innerText(), /Boss Problems/, 'first boss achievement should unlock');

// Daily page: selected rest button, removed Other drinks field, currency inputs
await page.evaluate(() => go('daily'));
const restButton = page.getByRole('button', { name: '7h' });
await restButton.click();
assert.ok((await restButton.getAttribute('class')).includes('primary'), 'selected rest button should remain highlighted');
assert.equal(await page.locator('input[name="otherDrinks"]').count(), 0, 'Other drinks field should be removed');
assert.equal(await page.locator('input[name="moneyIn"]').getAttribute('type'), 'number', 'Gold gained should be numeric');
assert.equal(await page.locator('input[name="moneyOut"]').getAttribute('type'), 'number', 'Gold spent should be numeric');

// Pet detail should show one pet only, retain and edit symptom history
await page.evaluate(() => go('dogs'));
await page.evaluate(() => petDetail(0));
assert.match(await page.locator('#view').innerText(), /Test Dog One/);
assert.doesNotMatch(await page.locator('#view').innerText(), /Test Dog Two/, 'other pet profiles must not appear in detail view');
assert.match(await page.locator('#view').innerText(), /Original entry/, 'existing symptom history must remain');
await page.locator('#petEdit input[name="name"]').fill('Edited Test Dog');
await page.locator('#petEdit button[type="submit"]').click();
assert.equal(await page.locator('#petEdit input[name="name"]').inputValue(), 'Edited Test Dog', 'pet profile edits should save');
await page.locator('#petSym0 input[name="symptom"]').fill('Edited itching');
await page.locator('#petSym0 button').first().click();
assert.equal(await page.locator('#petSym0 input[name="symptom"]').inputValue(), 'Edited itching', 'symptom entries should be editable and saved');
const savedPet = await page.evaluate(() => JSON.parse(localStorage.getItem('crawler-command-center')).dogs[0]);
assert.equal(savedPet.name, 'Edited Test Dog');
assert.equal(savedPet.symptoms[0].symptom, 'Edited itching');

// Stats should contain visual progress bars; settings remains reachable
await page.evaluate(() => go('stats'));
assert.ok(await page.locator('#view .rpgbar').count() >= 2, 'stats should show HP/progress bars');
await page.evaluate(() => go('settings'));
assert.match(await page.locator('#view').innerText(), /BACKUP & RESTORE/, 'settings should remain accessible');
assert.deepEqual(errors, [], 'browser should have no uncaught page errors');

await browser.close();
console.log('Crawler Command Center smoke tests passed.');
