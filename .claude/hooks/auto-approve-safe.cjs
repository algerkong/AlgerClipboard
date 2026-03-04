#!/usr/bin/env node

let input = '';
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const command = data.tool_input?.command || '';

    // 全局安全的只读命令 — 自动放行
    const globalSafePatterns = [
      /^(ls|dir|cat|type|echo|pwd)\b/,
      /^git\s+(status|diff|log|branch|show|remote|tag)\b/,
      /^(node|python|python3)\s+--version$/,
      /^(npm|npx|pnpm|yarn)\s+(list|ls|--version)/,
      /^(which|where|whoami|hostname|uname|date)\b/,
      /^cargo\s+(--version|check)\b/,
      /^rustc\s+--version$/,
    ];

    for (const pattern of globalSafePatterns) {
      if (pattern.test(command)) {
        allow();
        return;
      }
    }

    // 项目内开发命令 — 自动放行
    const projectSafePatterns = [
      /^(npm|npx|pnpm|yarn)\s+(test|run|install|build|dev|start|create)\b/,
      /^node\s+/,
      /^cargo\s+(build|run|test|clippy|fmt)\b/,
      /^mkdir\s+/,
      /^git\s+(add|commit|checkout|switch|merge|rebase|stash|pull|fetch)\b/,
      /^(tsc|vue-tsc|vite|tauri)\b/,
    ];

    for (const pattern of projectSafePatterns) {
      if (pattern.test(command)) {
        allow();
        return;
      }
    }

    // 不匹配的走默认审批流程
    process.exit(0);
  } catch (e) {
    process.exit(0);
  }
});

function allow() {
  const result = {
    hookSpecificOutput: {
      hookEventName: "PermissionRequest",
      decision: { behavior: "allow" }
    }
  };
  console.log(JSON.stringify(result));
  process.exit(0);
}
