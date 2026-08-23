// 拉取并解析明日方舟剧情原文（ASTR 数据源）
// 用法：node fetch-story.mjs [服务器] <storyTxt路径...>
// 示例：node fetch-story.mjs zh_CN obt/main/level_main_00-01_beg obt/main/level_main_01-01_beg
// 输出：raw/story/<原名>.json（原始数据）+ raw/story/<原名>.txt（可读文本）
import { writeFileSync, mkdirSync } from 'node:fs';

const BASE = 'https://r2.m31ns.top/';
const knownServers = ['zh_CN', 'en_US', 'ko_KR', 'ja_JP', 'zh_TW'];
const server = knownServers.includes(process.argv[2]) ? process.argv[2] : 'zh_CN';
const paths = knownServers.includes(process.argv[2]) ? process.argv.slice(3) : process.argv.slice(2);
if (paths.length === 0) { console.log('用法：node fetch-story.mjs [服务器] <storyTxt路径...>'); process.exit(1); }

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
for (const p of paths) {
  try {
    // 镜像路径结构：zh_CN/gamedata/story/<完整storyTxt路径>.json（如 activities/act43side/...）
    // 旧结构不带前缀（level_xxx.json），自动探测两种
    const candidates = p.startsWith('activities/') || p.startsWith('obt/')
      ? [p]
      : [p, 'activities/' + p, 'obt/main/' + p];
    let json = null, used = null;
    for (const c of candidates) {
      const res = await fetch(BASE + server + '/gamedata/story/' + c + '.json', { signal: AbortSignal.timeout(60000) });
      if (res.ok) { json = JSON.parse(await res.text()); used = c; break; }
      if (res.status !== 404) { console.log(`[WARN ${res.status}] ${c}`); }
    }
    if (!json) { console.log(`[FAIL 404] ${p}`); continue; }
    const base = p.split('/').pop();
    writeFileSync(`raw/story/${base}.json`, JSON.stringify(json, null, 1), 'utf8');
    writeFileSync(`raw/story/${base}.txt`, parseStory(json), 'utf8');
    console.log(`[OK] ${used} -> raw/story/${base}.txt`);
  } catch (e) {
    console.log(`[ERR] ${p} : ${e.message}`);
  }
}
