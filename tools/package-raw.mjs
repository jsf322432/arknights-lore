// 将 raw/story 全量剧情原文打包为 zip（用于 GitHub Releases 附件分发）
// 用法：node tools/package-raw.mjs [输出路径]
// 默认输出：dist/arknights-lore-raw-<日期>.zip
// 说明：仅打包 raw/story/*.txt（可读文本），不包含原始 JSON，控制体积。
import { createWriteStream, existsSync, mkdirSync, readdirSync, statSync, readFileSync } from 'node:fs';
import { join, basename } from 'node:path';

const root = process.cwd();
const rawDir = join(root, 'raw/story');
const outArg = process.argv[2];
const outFile = outArg || join(root, 'dist', `arknights-lore-raw-${new Date().toISOString().slice(0, 10)}.zip`);

if (!existsSync(rawDir)) { console.error('raw/story 不存在，请先运行 node tools/fetch-story.mjs 下载原文。'); process.exit(1); }

mkdirSync(join(root, 'dist'), { recursive: true });

// 极简 zip 写入（stored，无压缩——文本可再压，但保持简单可靠）
// 结构：[local file header]* [central directory]* [EOCD]
function crc32(buf) {
  let c, table = [];
  for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; table[n] = c >>> 0; }
  let crc = 0xFFFFFFFF;
  for (const b of buf) crc = table[(crc ^ b) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

const files = readdirSync(rawDir).filter(f => f.endsWith('.txt')).sort();
console.log(`打包 ${files.length} 个 txt 文件 → ${outFile}`);

const chunks = [];       // 所有输出字节
const central = [];      // 中央目录记录
let offset = 0;

for (const f of files) {
  const full = join(rawDir, f);
  const data = readFileSync(full);
  const name = Buffer.from(f, 'utf8');
  const crc = crc32(data);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);        // signature
  local.writeUInt16LE(20, 4);                // version needed
  local.writeUInt16LE(0, 6);                 // flags
  local.writeUInt16LE(0, 8);                 // method: stored
  local.writeUInt16LE(0, 10);                // mod time
  local.writeUInt16LE(0x2100, 12);           // mod date
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(name.length, 26);
  local.writeUInt16LE(0, 28);                // extra len
  chunks.push(local, name, data);

  const cd = Buffer.alloc(46);
  cd.writeUInt32LE(0x02014b50, 0);           // signature
  cd.writeUInt16LE(20, 4);                   // version made by
  cd.writeUInt16LE(20, 6);                   // version needed
  cd.writeUInt16LE(0, 8);                    // flags
  cd.writeUInt16LE(0, 10);                   // method
  cd.writeUInt16LE(0, 12);                   // mod time
  cd.writeUInt16LE(0x2100, 14);              // mod date
  cd.writeUInt32LE(crc, 16);
  cd.writeUInt32LE(data.length, 20);
  cd.writeUInt32LE(data.length, 24);
  cd.writeUInt16LE(name.length, 28);
  cd.writeUInt16LE(0, 30);                   // extra len
  cd.writeUInt16LE(0, 32);                   // comment len
  cd.writeUInt16LE(0, 34);                   // disk start
  cd.writeUInt16LE(0, 36);                   // internal attrs
  cd.writeUInt32LE(0, 38);                   // external attrs
  cd.writeUInt32LE(offset, 42);              // local header offset
  central.push(cd, name);

  offset += 30 + name.length + data.length;
}

const cdSize = central.reduce((s, b) => s + b.length, 0);
const cdOffset = offset;
const eocd = Buffer.alloc(22);
eocd.writeUInt32LE(0x06054b50, 0);
eocd.writeUInt16LE(0, 4);                    // disk
eocd.writeUInt16LE(0, 6);                    // cd start disk
eocd.writeUInt16LE(files.length, 8);
eocd.writeUInt16LE(files.length, 10);
eocd.writeUInt32LE(cdSize, 12);
eocd.writeUInt32LE(cdOffset, 16);
eocd.writeUInt16LE(0, 20);

const ws = createWriteStream(outFile);
for (const c of chunks) ws.write(c);
for (const c of central) ws.write(c);
ws.write(eocd);
ws.end();
ws.on('finish', () => {
  const sizeMB = (statSync(outFile).size / 1024 / 1024).toFixed(1);
  console.log(`完成：${outFile}（${sizeMB} MB，${files.length} 个文件）`);
});
ws.on('error', e => { console.error('写入失败：', e.message); process.exit(1); });
