import { readFileSync } from 'node:fs';
import vm from 'node:vm';
// Fail early with an exact filename/line/column if the RPG layer cannot parse.
new vm.Script(readFileSync('rpg.js', 'utf8'), { filename: 'rpg.js' });

import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', error => errors.push({message:error.message,stack:error.stack}));
page.on('console', msg => { if(msg.type()==='error') errors.push({message:msg.text(),stack:'console'}); });

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
await page.waitForFunction(() => document.querySelector('#nav')?.getAttribute('aria-hidden') === 'true');

console.log('PAGE ERRORS:', errors);
assert.equal(await page.locator('#nav').isVisible(), false, 'top navigation should be hidden');
assert.match(await page.locator('#view').innerText(), /Dungeon/i, 'dashboard should include Dungeon tile');
assert.match(await page.locator('#view').innerText(), /THE SYSTEM/i, 'dashboard should include the System announcer');
assert.match(await page.locator('#view').innerText(), /ACTIVE QUESTS/i, 'dashboard should include the active quest panel');

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
// Structured quests: recurring quest is created once, completed by period, and shown on dashboard.
await page.locator('#structuredQuestForm input[name="name"]').fill('Wash dishes');
assert.equal(await page.locator('#structuredQuestForm input[name="type"]').inputValue(), 'Daily', 'all new quests must be daily');
assert.equal(await page.locator('#structuredQuestForm select[name="type"]').count(), 0, 'quest type selector must be removed');
await page.locator('#structuredQuestForm button[type="submit"]').click();
assert.match(await page.locator('#view').innerText(), /Wash dishes/, 'daily quest should be created');
await page.evaluate(() => go('home'));
assert.match(await page.locator('#view').innerText(), /Wash dishes/, 'active quests should appear on dashboard');
await page.evaluate(() => go('daily'));
await page.getByRole('button', { name: 'Complete quest' }).click();
assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('crawler-command-center')).rpg.quests[0].donePeriods.length), 1);
await page.locator('#dailyDate').fill('2026-11-05');
await page.locator('textarea[name="notes"]').fill('Saved on selected date');
await page.getByRole('button', { name: 'Save Daily Record' }).click();
assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('crawler-command-center')).daily['2026-11-05'].notes), 'Saved on selected date');
await page.evaluate(() => go('daily'));
const restButton = page.getByRole('button', { name: '7h' });
await restButton.click();
assert.ok((await restButton.getAttribute('class')).includes('primary'), 'selected rest button should remain highlighted');
assert.equal(await page.locator('input[name="sleep"]').count(), 0, 'sleep should be selected only with the hour buttons');
assert.equal(await page.locator('input[name="otherDrinks"]').count(), 0, 'Other drinks field should be removed');
assert.equal(await page.locator('input[name="moneyIn"]').getAttribute('type'), 'number', 'Gold gained should be numeric');
assert.equal(await page.locator('input[name="moneyOut"]').getAttribute('type'), 'number', 'Gold spent should be numeric');
assert.equal(await page.locator('text=Gold gained ($)').count(), 1, 'Gold gained label should appear once');
assert.equal(await page.locator('text=Gold spent ($)').count(), 1, 'Gold spent label should appear once');

// Add Book works and finished books no longer show page-tracking fields.
await page.evaluate(() => go('reading'));
await page.getByRole('button', { name: '+ Add a book' }).click();
await page.locator('#bookForm input[name="name"]').fill('New Test Book');
await page.locator('#bookForm button[type="submit"]').click();
await page.getByText('New Test Book', { exact: true }).waitFor();
const newBookIndex = await page.evaluate(() => JSON.parse(localStorage.getItem('crawler-command-center')).books.findIndex(b => b.name === 'New Test Book'));
await page.locator('.bookcard').nth(newBookIndex).locator('select').selectOption('Finished');
assert.equal(await page.locator('.bookcard').nth(newBookIndex).locator('input[type="number"]').count(), 0, 'finished book should hide page fields');
// Pet detail should show one pet only, retain and edit symptom history
await page.evaluate(() => go('dogs'));
await page.evaluate(() => petDetail(0));
await page.getByRole('button', { name: 'Edit profile' }).click();
assert.equal(await page.locator('#petEdit input[name="name"]').inputValue(), 'Test Dog One');
assert.equal(await page.locator('#view').locator('input[name="name"]').count(), 1, 'only the selected pet profile should be rendered');
assert.doesNotMatch(await page.locator('#view').innerText(), /Test Dog Two/, 'other pet profiles must not appear in detail view');
await page.getByRole('button', { name: 'Edit entry' }).click();
assert.equal(await page.locator('#petSym0 textarea[name="notes"]').inputValue(), 'Original entry', 'existing symptom history must remain');
await page.locator('#petEdit input[name="name"]').fill('Edited Test Dog');
await page.getByRole('button', { name: 'Save profile' }).click();
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
