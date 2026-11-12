import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
const roles=['pm','ba','architect-dev','test','qa','devops','orchestrator'];
const read=(path)=>readFileSync(path,'utf8');
for(const role of roles){
 const path='.claude/skills/learning-'+role+'/SKILL.md';
 assert.ok(existsSync(path),'Missing '+path);
 const content=read(path);
 assert.ok(content.startsWith('---\nname: learning-'+role+'\ndescription: '),'Bad skill frontmatter: '+path);
 assert.ok(content.length>380,'Instructions too short: '+path);
}
const delivery=read('docs/LEARNING-DELIVERY.md');
for(const role of roles)assert.ok(delivery.includes('`learning-'+role+'`'),'Missing role reference: '+role);
for(const marker of ['320/390px','reload','production','PASS','BLOCKED','85%'])assert.ok(delivery.includes(marker),'Missing policy marker: '+marker);
assert.match(read('AGENTS.md'),/docs\/LEARNING-DELIVERY\.md/);
assert.match(read('CLAUDE.md'),/learning-orchestrator/);
assert.ok(existsSync('.claude/skills/ponytail/SKILL.md'),'Existing Ponytail skill missing');
assert.ok(existsSync('.claude/skills/ui-ux-pro-max/SKILL.md'),'Existing UI skill missing');
console.log('Max Learning delivery kit: 7 role manifests and release gates PASS');
