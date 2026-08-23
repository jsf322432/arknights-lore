// 一键推送脚本（安全认证版 v2）
// token 来源优先级：
//   1. 环境变量 GH_TOKEN（推荐：由调用方从 gh keyring 注入，不落盘）
//   2. 文件 F:/deepseekharness/.ghconfig/.git-credentials（gh auth login 后生成）
// 用法：
//   node tools/push.mjs                # 推送已提交内容
//   node tools/push.mjs --commit "msg" # 先提交所有改动再推送
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';

const root = process.cwd();
const GIT = 'F:/deepseekharness/.toolchain/bin/mingit/cmd/git.exe';
const REPO = 'jsf322432/arknights-lore';
const BRANCH = 'main';
const CRED_FILE = 'F:/deepseekharness/.ghconfig/.git-credentials';

const args = process.argv.slice(2);
const doCommit = args.includes('--commit');
const ci = args.indexOf('--commit');
const commitMsg = ci >= 0 && args[ci + 1] ? args[ci + 1] : 'update';

function git(...a) {
  execFileSync(GIT, a, { cwd: root, stdio: 'inherit' });
}

// 获取 token
let token = process.env.GH_TOKEN || '';
if (!token && existsSync(CRED_FILE)) {
  const m = readFileSync(CRED_FILE, 'utf8').match(/x-access-token:([^@]+)@/);
  if (m) token = m[1];
}
if (!token) {
  console.error('✗ 未找到 GitHub 凭据。二选一：');
  console.error('  1) 设置环境变量 GH_TOKEN（可用：gh auth token 获取）');
  console.error('  2) 先运行 gh auth login 生成凭据文件');
  process.exit(1);
}

try {
  if (doCommit) {
    git('add', '-A');
    git('commit', '-m', commitMsg);
  }
  git('push', `https://x-access-token:${token}@github.com/${REPO}.git`, BRANCH);
  console.log(`\n✓ 推送完成：https://github.com/${REPO}`);
} catch (e) {
  console.error('\n✗ 推送失败');
  process.exit(1);
}
