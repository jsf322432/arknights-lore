// 明日方舟剧情知识库全文查询工具
// 用法：
//   node tools/search.mjs <关键词> [--scope=all|摘要|档案|势力|时间线|原文]
//   node tools/search.mjs 寒檀                 # 全库检索
//   node tools/search.mjs 黑冠 --scope=摘要    # 只搜章节摘要
//   node tools/search.mjs "罗德岛" --max=20    # 限制结果条数
// 说明：原文检索仅在已下载 raw/story 时可用（未下载则自动跳过并提示）。
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const args = process.argv.slice(2);
const keyword = args.find(a => !a.startsWith('--'));
if (!keyword) {
  console.log('用法：node tools/search.mjs <关键词> [--scope=all|摘要|档案|势力|时间线|原文] [--max=N]');
  process.exit(1);
}
const scopeArg = (args.find(a => a.startsWith('--scope=')) || '--scope=all').slice(8);
const max = parseInt((args.find(a => a.startsWith('--max=')) || '--max=15').slice(6), 10) || 15;

const SCOPES = {
  摘要: '章节摘要', 档案: '人物档案', 势力: '势力档案',
  时间线: '时间线.md', 原文: 'raw/story', all: 'all',
};
if (!(scopeArg in SCOPES)) { console.log(`未知 scope：${scopeArg}（可用：${Object.keys(SCOPES).filter(k => k !== 'all').join('/')}）`); process.exit(1); }

function searchDir(dir, label) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.md')) continue;
    const full = join(dir, f);
    if (statSync(full).size > 3 * 1024 * 1024) continue; // 跳过超大文件
    const lines = readFileSync(full, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (line.includes(keyword)) out.push({ file: `${label}/${f}`, line: i + 1, text: line.trim().slice(0, 160) });
    });
  }
  return out;
}

const results = [];
const scope = SCOPES[scopeArg];

if (scope === 'all' || scope === '章节摘要') results.push(...searchDir(join(root, '章节摘要'), '章节摘要'));
if (scope === 'all' || scope === '人物档案') results.push(...searchDir(join(root, '人物档案'), '人物档案'));
if (scope === 'all' || scope === '势力档案') results.push(...searchDir(join(root, '势力档案'), '势力档案'));
if (scope === 'all' || scope === '时间线') {
  for (const f of ['时间线.md', '世界观基线.md', '阅读顺序.md', 'README.md']) {
    const full = join(root, f);
    if (!existsSync(full)) continue;
    const lines = readFileSync(full, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (line.includes(keyword)) results.push({ file: f, line: i + 1, text: line.trim().slice(0, 160) });
    });
  }
}
if (scope === 'all' || scope === '原文') {
  const rawDir = join(root, 'raw/story');
  if (existsSync(rawDir)) {
    const txts = readdirSync(rawDir).filter(f => f.endsWith('.txt'));
    let scanned = 0;
    for (const f of txts) {
      const full = join(rawDir, f);
      if (statSync(full).size > 5 * 1024 * 1024) continue; // 跳过超大原文
      const content = readFileSync(full, 'utf8');
      if (content.includes(keyword)) {
        const idx = content.indexOf(keyword);
        const lineNo = content.slice(0, idx).split('\n').length;
        const around = content.slice(Math.max(0, idx - 60), idx + 120).replace(/\s+/g, ' ').trim();
        results.push({ file: `raw/story/${f}`, line: lineNo, text: around.slice(0, 160) });
      }
      if (++scanned >= 800) break;
    }
  } else if (scope === '原文') {
    console.log('提示：raw/story 不存在，未下载原文。可先运行 node tools/fetch-story.mjs 下载。');
  }
}

// 排序：按文件分组保持稳定顺序，去重（同一文件同一行只留一次）
const seen = new Set();
const uniq = results.filter(r => { const k = `${r.file}:${r.line}:${r.text}`; if (seen.has(k)) return false; seen.add(k); return true; });

console.log(`检索 "${keyword}" → ${uniq.length} 处命中（显示前 ${Math.min(max, uniq.length)} 条）\n`);
for (const r of uniq.slice(0, max)) {
  console.log(`  ${r.file}:${r.line}`);
  console.log(`    ${r.text}`);
  console.log('');
}
if (uniq.length > max) console.log(`… 其余 ${uniq.length - max} 条略过（用 --max=N 调整）`);
