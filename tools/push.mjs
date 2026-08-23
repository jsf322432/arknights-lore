// 一键推送脚本：配置 HOME 指向凭据目录后执行 git push
// 用法：node tools/push.mjs ["提交信息"]
// 说明：提交信息缺省时仅 push 已提交内容；如需先提交，可用 --commit 参数
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const root = process.cwd();
const git = 'F:/deepseekharness/.toolchain/bin/mingit/cmd/git.exe';
const credDir = 'F:/deepseekharness/.ghconfig';

if (!existsSync(credDir + '/.git-credentials')) {
  console.error('凭据文件不存在，请先运行：gh auth login');
  process.exit(1);
}

const env = { ...process.env, HOME: credDir };
const args = process.argv.slice(2);
const commitMsg = args.find(a => !a.startsWith('--'));
const doCommit = args.includes('--commit');

try {
  if (doCommit) {
    const msg = commitMsg || 'update';
    execSync(`"${git}" add -A`, { cwd: root, env, stdio: 'inherit' });
    execSync(`"${git}" commit -m "${msg}"`, { cwd: root, env, stdio: 'inherit' });
  }
  execSync(`"${git}" push origin main`, { cwd: root, env, stdio: 'inherit' });
  console.log('\n✓ 推送完成：https://github.com/jsf322432/arknights-lore');
} catch (e) {
  console.error('\n推送失败：', e.message);
  process.exit(1);
}
