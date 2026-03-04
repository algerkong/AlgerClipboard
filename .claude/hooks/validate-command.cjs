#!/usr/bin/env node
const path = require('path');

const PROJECT_DIR = path.resolve(__dirname, '..', '..').replace(/\\/g, '/').toLowerCase();

let input = '';
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const toolName = data.tool_name || '';
    const command = data.tool_input?.command || '';
    const filePath = data.tool_input?.file_path || '';
    const notebookPath = data.tool_input?.notebook_path || '';

    // === 1. 危险命令黑名单（全局禁止） ===
    const dangerous = [
      /rm\s+(-rf|-fr)\s+[\/~]/i,
      /del\s+\/[sfq]\s+/i,
      /rmdir\s+\/s/i,
      /format\s+[a-z]:/i,
      /chmod\s+777/,
      /curl.*\|\s*(ba)?sh/,
      /powershell.*-enc/i,
      /git\s+push\s+.*--force/,
      />\s*\/dev\/sd/,
      /reg\s+delete/i,
      /net\s+user\s+.*\/delete/i,
      /mkfs\./i,
      /dd\s+if=.*of=\/dev/i,
    ];

    for (const pattern of dangerous) {
      if (pattern.test(command)) {
        deny(`Blocked dangerous command: ${command}`);
        return;
      }
    }

    // === 2. 文件写入/编辑工具 — 限制只能操作项目目录 ===
    const writeTools = ['Write', 'Edit', 'NotebookEdit'];
    if (writeTools.includes(toolName)) {
      const targetPath = filePath || notebookPath;
      if (targetPath && isOutsideProject(targetPath)) {
        deny(`Blocked: cannot modify file outside project directory: ${targetPath}`);
        return;
      }
    }

    // === 3. Bash 命令 — 检查是否对项目外目录做删除/修改 ===
    if (toolName === 'Bash' && command) {
      // 删除操作
      const deletePatterns = [
        /\brm\s+(?:-[a-z]*\s+)*(.+)/i,
        /\brmdir\s+(.+)/i,
        /\bdel\s+(?:\/[a-z]\s+)*(.+)/i,
        /\brd\s+(?:\/[a-z]\s+)*(.+)/i,
      ];
      for (const pattern of deletePatterns) {
        const match = command.match(pattern);
        if (match) {
          const targets = match[1].trim().replace(/["']/g, '').split(/\s+/);
          for (const target of targets) {
            if (target && !target.startsWith('-') && isOutsideProject(target)) {
              deny(`Blocked: cannot delete outside project directory: ${target}`);
              return;
            }
          }
        }
      }

      // 输出重定向到项目外
      const redirectMatch = command.match(/>\s*(.+?)(?:\s|$)/);
      if (redirectMatch) {
        const target = redirectMatch[1].trim().replace(/["']/g, '');
        if (target && isOutsideProject(target)) {
          deny(`Blocked: cannot write to file outside project directory: ${target}`);
          return;
        }
      }

      // mv/move 目标在项目外
      const movePatterns = [
        /\bmv\s+(?:-[a-z]*\s+)*\S+\s+(.+)/i,
        /\bmove\s+(?:\/[a-z]\s+)*\S+\s+(.+)/i,
        /\bcp\s+(?:-[a-z]*\s+)*\S+\s+(.+)/i,
        /\bcopy\s+(?:\/[a-z]\s+)*\S+\s+(.+)/i,
      ];
      for (const pattern of movePatterns) {
        const match = command.match(pattern);
        if (match) {
          const target = match[1].trim().replace(/["']/g, '');
          if (target && isOutsideProject(target)) {
            deny(`Blocked: cannot move/copy files to outside project directory: ${target}`);
            return;
          }
        }
      }

      // sed -i / tee 写入到项目外文件
      const sedMatch = command.match(/\bsed\s+-i\s+.*\s+(\S+)\s*$/i);
      if (sedMatch) {
        const target = sedMatch[1].replace(/["']/g, '');
        if (isOutsideProject(target)) {
          deny(`Blocked: cannot edit file outside project directory: ${target}`);
          return;
        }
      }

      const teeMatch = command.match(/\btee\s+(?:-a\s+)?(\S+)/i);
      if (teeMatch) {
        const target = teeMatch[1].replace(/["']/g, '');
        if (isOutsideProject(target)) {
          deny(`Blocked: cannot write to file outside project directory: ${target}`);
          return;
        }
      }
    }

    // 安全，放行
    process.exit(0);
  } catch (e) {
    process.exit(0);
  }
});

function isOutsideProject(target) {
  try {
    const resolved = path.resolve(target).replace(/\\/g, '/').toLowerCase();
    return !resolved.startsWith(PROJECT_DIR);
  } catch {
    return false;
  }
}

function deny(reason) {
  const result = {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: reason
    }
  };
  console.log(JSON.stringify(result));
  process.exit(0);
}
