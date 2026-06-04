import chalk from 'chalk';
import { getHead, listCommits } from '../core/store.js';

export function logCommand() {
  const head = getHead();
  const commits = listCommits(head.branch, head.commit);

  if (commits.length === 0) {
    console.log("No commits found.");
    return;
  }

  commits.forEach(commit => {
    console.log(chalk.yellow(`commit ${commit.commitHash}`));
    if (commit.branch) {
      console.log(`Branch: ${commit.branch}`);
    }
    console.log(`Date:   ${new Date(commit.timestamp).toLocaleString()}`);
    console.log(`\n    ${commit.message}\n`);
  });
}
