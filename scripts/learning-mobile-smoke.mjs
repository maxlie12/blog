import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

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
    await textBox.fill(synthetic);
    await page.getByRole('button',{name:'Lưu nháp · học sau'}).click();
    await page.getByText('Đã lưu nháp trên thiết bị, chưa ghi Done.',{exact:false}).waitFor({timeout:10000});

    await page.goto(base + '/learning',{waitUntil:'domcontentloaded'});
    await page.goto(route,{waitUntil:'domcontentloaded'});
    await textBox.waitFor({state:'visible',timeout:20000});
    assert.equal(await textBox.inputValue(),synthetic,'Draft must persist after navigating and reloading');
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
    await page.getByText('Đã lưu kết quả tự kiểm tra trên thiết bị.').waitFor({timeout:10000});

    await page.reload({waitUntil:'domcontentloaded'});
    await textBox.waitFor({state:'visible',timeout:20000});
    assert.equal(await textBox.inputValue(),synthetic,'Completed answer must remain on this device');
    await page.getByText('ĐÃ GHI DONE · CHƯA TỰ CHẤM NĂNG LỰC').waitFor();
    await page.getByText(/Lần tự kiểm tra/).waitFor();
    assert.deepEqual(errors,[],'No client JS errors');
    console.log(`PASS ${lessonId} at ${width}px: save/resume/Done/recall/reload; no overflow`);
  } finally {
    await context.close();
  }
}
try {
  await waitForServer();
  browser = await chromium.launch({headless:true});
  await study(browser,390,'level-en-a2-writing');
  await study(browser,320,'level-zh-beginner-writing');
  console.log('Mobile viewport smoke: 2 bilingual synthetic flows PASS; real iOS Safari/audio NOT TESTED');
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
