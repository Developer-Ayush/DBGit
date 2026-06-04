import chalk from 'chalk';
import { getHead, listCommits } from '../core/store.js';

export function logCommand() {
  const head = getHead();
  const commits = listCommits(head.branch, head.commit);

  if (commits.length === 0) {
    console.log(chalk.gray("ℹ No commits found."));
    return;
  }

  commits.forEach(commit => {
    console.log(chalk.yellow(`commit ${commit.commitHash}`));
    if (commit.branch) {
      console.log(chalk.blue(`Branch: ${commit.branch}`));
    }
    console.log(chalk.gray(`Date:   ${new Date(commit.timestamp).toLocaleString()}`));
    console.log(`\n    ${commit.message}\n`);
  });
}
