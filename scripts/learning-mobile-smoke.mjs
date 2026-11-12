import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium, webkit } from 'playwright';

const port = 3400 + (process.pid % 1000);
const base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
  env: process.env,
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverOutput = '';
for (const s of [server.stdout, server.stderr]) s.on('data', data => {serverOutput += data.toString();});
let browser;
async function waitForServer() {
  const start = Date.now();
  while (Date.now() - start < 90000) {
    if (server.exitCode !== null) throw Error('Next server exited: ' + serverOutput.slice(-1800));
    try {
      const response = await fetch(base + '/learning/level-en-a2-writing');
      if (response.status === 200) return;
    } catch { /* Retry until boot and migrations settle. */ }
    await new Promise(resolve => setTimeout(resolve, 800));
  }
  throw Error('Next server did not serve lesson route: ' + serverOutput.slice(-1800));
}
async function study(browser, width, lessonId) {
  // A fresh context prevents production/private profile writes and avoids cross-test contamination.
  const context = await browser.newContext({viewport: {width,height: 844},isMobile: true,hasTouch: true});
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const route = base + '/learning/' + lessonId;
  const synthetic = 'QA synthetic ' + lessonId + ': I would change the meeting to Sunday because I am busy.';
  try {
    const response = await page.goto(route, {waitUntil: 'domcontentloaded'});
    assert.equal(response?.status(),200,'Lesson page must load');
    const textBox = page.locator('#' + lessonId + '-response');
    await textBox.waitFor({state:'visible',timeout:20000});
    const saveDraft = page.getByRole('button', { name: 'Lưu nháp · học sau' });
    // WebKit can render SSR markup before hydration; do not mistake pre-hydration typing for a saved draft.
    for (let attempt = 0; attempt < 8; attempt += 1) {
      await textBox.fill('');
      await textBox.fill(synthetic);
      if (await saveDraft.isEnabled()) break;
      await page.waitForTimeout(300);
    }
    assert.ok(await saveDraft.isEnabled(), 'The draft button must become enabled after typing');
    await saveDraft.click();
    await page.getByText('Đã lưu nháp trên thiết bị, chưa ghi Done.',{exact:false}).waitFor({timeout:10000});

    await page.goto(base + '/learning',{waitUntil:'domcontentloaded'});
    await page.goto(route,{waitUntil:'domcontentloaded'});
    await textBox.waitFor({state:'visible',timeout:20000});
    await page.waitForFunction(
      ({ selector, expected }) => document.querySelector(selector)?.value === expected,
      { selector: '#' + lessonId + '-response', expected: synthetic },
      { timeout: 12000 },
    );
    assert.equal(await textBox.inputValue(), synthetic, 'Draft must persist after navigating and reloading');
    const saved = await page.locator('p[role="status"]').allTextContents();
    assert.ok(saved.some(x=>x.includes('khôi phục bài đang dở')),'Must clearly say draft is restored, not Done');

    const overflow = await page.evaluate(()=>document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(overflow<=2,`Horizontal overflow ${overflow}px at ${width}px`);
    const save = page.getByRole('button',{name:'Lưu nháp · học sau'});
    assert.ok((await save.boundingBox())?.height >= 44,'Save must have 44px touch target');

    await page.getByRole('button',{name:'Hoàn thành bài · lưu Done'}).click();
    await page.getByText('ĐÃ GHI DONE · CHƯA TỰ CHẤM NĂNG LỰC').waitFor({timeout:10000});
    await page.getByRole('button',{name:'Đã tự nhớ lại · mở phần đối chiếu'}).click();
    await page.getByRole('button',{name:'Nhớ và dùng lại được'}).click();
    await page.getByText(/Lần tự kiểm tra/).waitFor({ timeout: 10000 });

    await page.reload({waitUntil:'domcontentloaded'});
    await textBox.waitFor({state:'visible',timeout:20000});
    await page.waitForFunction(
      ({ selector, expected }) => document.querySelector(selector)?.value === expected,
      { selector: '#' + lessonId + '-response', expected: synthetic },
      { timeout: 12000 },
    );
    assert.equal(await textBox.inputValue(), synthetic, 'Completed answer must remain on this device');
    await page.getByText('ĐÃ GHI DONE · CHƯA TỰ CHẤM NĂNG LỰC').waitFor();
    await page.getByText(/Lần tự kiểm tra/).waitFor();
    assert.deepEqual(errors,[],'No client JS errors');
    console.log(`PASS ${lessonId} at ${width}px: save/resume/Done/recall/reload; no overflow`);
  } finally {
    await context.close();
  }
}
async function assessmentEvidence(browser, engine) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  try {
    const page = await context.newPage();
    const response = await page.goto(base + '/learning/listening/e1-coffee-shop', { waitUntil: 'domcontentloaded' });
    assert.equal(response?.status(), 200);
    await page.locator('.ll-steps button').last().click();
    const table = page.locator('.ll-results');
    await table.waitFor({ state: 'visible' });
    assert.equal(await table.locator('tbody tr').count(), 4);
    const rendered = await table.innerText();
    for (const source of ['Máy chấm đáp án', 'Chính tả máy chấm + tự kiểm tra', 'Người học tự chấm']) {
      assert.ok(rendered.includes(source), engine + ' missing evidence source: ' + source);
    }
    assert.ok(rendered.includes('Chưa có điểm'), 'No score must not masquerade as graded');
    await page.getByText('Điều kiện Done:', { exact: false }).waitFor();
    await page.locator('.ll-steps button').nth(3).click();
    const essay = page.locator('#ll-essay');
    await essay.waitFor({state:'visible'});
    await essay.fill('I want coffee');
    const rubricButton = page.getByRole('button', {name: 'Xem rubric & gợi ý sửa'});
    await rubricButton.waitFor({state:'visible'});
    await rubricButton.click();
    const rubric = page.getByRole('region', {name: 'Rubric bản nháp'});
    await rubric.waitFor({state:'visible'});
    await rubric.getByText(/Sửa một điểm trước:/).waitFor();
    assert.match(await rubric.innerText(), /Cần sửa — Độ dài theo đề/);
    await rubric.getByRole('button',{name:'Sửa bài và thử lại'}).click();
    await essay.fill("Can I have a medium coffee, please? I'd also like a muffin to go.");
    await rubric.getByText(/Đạt mục tiêu — Độ dài theo đề/).waitFor();
    await rubric.getByText(/Đạt mục tiêu — Từ vựng trong bài/).waitFor();
    assert.match(await rubric.innerText(), /Tự kiểm tra — Đúng đề và ngữ pháp/);
    assert.equal(await page.evaluate(() => localStorage.getItem('ll-essay')), null, 'Do not persist private essay');
    await page.locator('.ll-steps button').nth(4).click();
    const speaking = page.locator('.ll-speak').first();
    await speaking.waitFor({ state: 'visible' });
    await speaking.getByRole('button', { name: 'Xem gợi ý luyện lại' }).click();
    const guide = speaking.getByRole('region', { name: 'Gợi ý luyện nói câu 1' });
    await guide.getByText(/Cần làm tiếp:/).waitFor();
    assert.match(await guide.innerText(), /Nghe câu mẫu một lần/);
    assert.match(await guide.innerText(), /không tự thay đổi điểm đã lưu/);
    await guide.getByRole('button', { name: 'Luyện lại câu này' }).click();
    await speaking.getByText('Lần luyện 2.', { exact: false }).waitFor();
    await speaking.getByRole('button', { name: 'Ẩn gợi ý luyện lại' }).click();
    console.log('PASS ' + engine + ' 390px: honest speaking guidance, local-only retry and no auto-grade');
    console.log('PASS ' + engine + ' 390px: observable writing rubric, actionable retry and no invented grammar grade');
  } finally {
    await context.close();
  }
}
try {
  await waitForServer();
  for (const [engine, launcher] of [['Chromium', chromium], ['WebKit', webkit]]) {
    browser = await launcher.launch({ headless: true });
    try {
      await study(browser,390,'level-en-a2-writing');
      await study(browser,320,'level-zh-beginner-writing');
      await assessmentEvidence(browser, engine);
    } finally {
      await browser.close();
      browser = undefined;
    }
  }
  console.log('Mobile viewport smoke: Chromium + WebKit synthetic bilingual flows PASS; real iOS Safari/audio NOT TESTED');
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
