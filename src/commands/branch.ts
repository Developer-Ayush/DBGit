import chalk from 'chalk';
import { listBranches, getHead, saveBranch, loadBranch } from '../core/store.js';

export function branchCommand(name?: string, options?: { list?: boolean }) {
  if (!name || options?.list) {
    const branches = listBranches();
    const head = getHead();
    branches.forEach(b => {
      if (b === head.branch) {
        console.log(chalk.green(`* ${b}`));
      } else {
        console.log(chalk.gray(`  ${b}`));
      }
    });
    return;
  }

  try {
    loadBranch(name);
    console.error(chalk.red(`Error: Branch '${name}' already exists.`));
    process.exit(1);
  } catch (e) {
    // Branch does not exist, good
  }

  const head = getHead();
  const timestamp = new Date().toISOString();
  saveBranch({
    name,
    headCommit: head.commit || '',
    createdAt: timestamp,
    basedOn: head.branch
  });

  console.log(chalk.green(`Branch '${name}' created. Based on ${head.branch || 'detached'}@${head.commit || 'initial'}`));
}
