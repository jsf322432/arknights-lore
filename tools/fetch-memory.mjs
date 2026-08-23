// 批量下载干员密录（obt/memory）——用法：node tools/fetch-memory.mjs <角色前缀...>
// 从 raw/zh_CN_storyinfo.json 找出 obt/memory/story_<前缀>_* 的键，逐个下载到 raw/story/
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';

const BASE = 'https://r2.m31ns.top/';
const server = 'zh_CN';
const prefixes = process.argv.slice(2);
if (prefixes.length === 0) { console.log('用法：node tools/fetch-memory.mjs <角色前缀...>'); process.exit(1); }

const info = JSON.parse(readFileSync('./raw/zh_CN_storyinfo.json', 'utf8'));

function parseStory(json) {
  const lines = [];
  let curSpeaker = null;
  for (const s of json.storyList || []) {
    const a = s.attributes || {};
    const prop = s.prop;
    if (prop === 'name') {
      if (a.name) curSpeaker = a.name;
      lines.push(`${curSpeaker || '？？？'}：${(a.content || '').replace(/\s+/g, ' ').trim()}`);
    } else if (prop === 'multiline') {
      if (a.name) curSpeaker = a.name;
      lines.push(`\n【${curSpeaker || '？？？'}·独白】\n${(a.content || '').trim()}\n`);
    } else if (prop === 'subtitle') {
      lines.push(`【旁白】${(a.text || '').trim()}`);
    } else if (prop === 'sticker') {
      lines.push(`【贴图】${(a.text || '').trim()}`);
    } else if (prop === 'comment') {
      lines.push(`（注释）${(a.value || '').trim()}`);
    } else if (prop === 'decision' || prop === 'Decision') {
      lines.push(`【选项】${(a.options || '').split(';').filter(Boolean).join(' | ')}`);
    } else if (prop === 'predicate' || prop === 'Predicate') {
      lines.push('（分支切换）');
    } else if (prop === 'dialog' || prop === 'Dialog') {
      lines.push('');
    }
  }
  return lines.join('\n');
}

mkdirSync('raw/story', { recursive: true });
let ok = 0, fail = 0;
for (const pre of prefixes) {
  const keys = Object.keys(info).filter(k => k.startsWith(`obt/memory/story_${pre}_`));
  if (keys.length === 0) { console.log(`[NONE] ${pre}`); continue; }
  for (const k of keys) {
    const base = k.split('/').pop();
    try {
      const res = await fetch(`${BASE}${server}/gamedata/story/${k}.json`, { signal: AbortSignal.timeout(60000) });
      if (!res.ok) { console.log(`[FAIL ${res.status}] ${k}`); fail++; continue; }
      const json = JSON.parse(await res.text());
      writeFileSync(`raw/story/${base}.json`, JSON.stringify(json, null, 1), 'utf8');
      writeFileSync(`raw/story/${base}.txt`, parseStory(json), 'utf8');
      console.log(`[OK] ${k} -> raw/story/${base}.txt`); ok++;
    } catch (e) { console.log(`[ERR] ${k} : ${e.message}`); fail++; }
  }
}
console.log(`done: ok=${ok} fail=${fail}`);
