// 一键推送脚本（安全认证版）
// 原理：remote URL 保持干净（无 token），推送时临时从 gh（系统 keyring）读取 token 并注入 URL，
//       token 不落盘、不写入 git 配置，推送完成后 URL 保持干净。
// 用法：
//   node tools/push.mjs                # 推送已提交内容
//   node tools/push.mjs --commit "msg" # 先提交所有改动再推送
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const root = process.cwd();
const GIT = 'F:/deepseekharness/.toolchain/bin/mingit/cmd/git.exe';
const GH = 'F:/deepseekharness/.toolchain/bin/gh/bin/gh.exe';
const GH_CONFIG_DIR = 'F:/deepseekharness/.ghconfig';
const REPO = 'jsf322432/arknights-lore';
const BRANCH = 'main';

const args = process.argv.slice(2);
const doCommit = args.includes('--commit');
const commitMsg = args.find(a => a.startsWith('--commit')) ? args[args.indexOf('--commit') + 1] : 'update';

function run(cmd, extraEnv = {}) {
  return execSync(cmd, { cwd: root, env: { ...process.env, ...extraEnv }, stdio: 'inherit', shell: true });
}

try {
  // 1. 从 gh 读取 token（存于系统 keyring，不落盘）
  let token = '';
  try {
    token = execSync(`"${GH}" auth token`, { env: { ...process.env, GH_CONFIG_DIR }, encoding: 'utf8' }).trim();
  } catch {
    console.error('✗ 无法读取 GitHub 凭据，请先运行：gh auth login');
    process.exit(1);
  }
  if (!/^gh[oasu]_/.test(token)) { console.error('✗ token 无效'); process.exit(1); }

  // 2. 可选：提交
  if (doCommit) {
    run(`"${GIT}" add -A`);
    run(`"${GIT}" commit -m "${commitMsg.replace(/"/g, '\\"')}"`);
  }

  // 3. 推送（临时注入 token，URL 用后即弃，不修改 remote）
  const authUrl = `https://x-access-token:${token}@github.com/${REPO}.git`;
  run(`"${GIT}" push ${authUrl} ${BRANCH}`);
  console.log(`\n✓ 推送完成：https://github.com/${REPO}`);
} catch (e) {
  console.error('\n✗ 推送失败：', e.message.split('\n')[0]);
  process.exit(1);
}
