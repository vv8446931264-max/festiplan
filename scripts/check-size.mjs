#!/usr/bin/env node
// Enforces the CLAUDE.md size rules: every TypeScript file < 200 lines (src, tests, e2e,
// scripts) and every function in src/ < 40 lines. Uses the TypeScript compiler API so
// arrow functions and methods are measured too.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const MAX_FILE_LINES = 200;
const MAX_FUNCTION_LINES = 40;
const FILE_RULE_DIRS = ["src", "tests", "e2e", "scripts"];
const FUNCTION_RULE_DIRS = ["src"];

/** Yields every .ts/.tsx file below `dir`. */
function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* walk(path);
    else if (/\.(ts|tsx)$/.test(name)) yield path;
  }
}

const isFunction = (node) =>
  ts.isFunctionDeclaration(node) ||
  ts.isFunctionExpression(node) ||
  ts.isArrowFunction(node) ||
  ts.isMethodDeclaration(node);

/** A readable name for a function node: its own name or the variable/property it is bound to. */
function functionName(node) {
  if (node.name) return node.name.getText();
  const { parent } = node;
  if (parent && (ts.isVariableDeclaration(parent) || ts.isPropertyAssignment(parent))) {
    return parent.name.getText();
  }
  return "(anonymous)";
}

/** Reports every function in `file` that spans more than MAX_FUNCTION_LINES lines. */
function functionProblems(file, text, rel) {
  const kind = file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind);
  const lineOf = (pos) => source.getLineAndCharacterOfPosition(pos).line;
  const problems = [];
  const visit = (node) => {
    if (isFunction(node) && node.body) {
      const start = lineOf(node.getStart());
      const length = lineOf(node.getEnd()) - start + 1;
      if (length > MAX_FUNCTION_LINES) {
        problems.push(
          `${rel}:${start + 1} ${functionName(node)}: ${length} lines (max ${MAX_FUNCTION_LINES})`,
        );
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return problems;
}

const problems = [];
for (const dir of FILE_RULE_DIRS) {
  const absolute = join(ROOT, dir);
  if (!existsSync(absolute)) continue;
  for (const file of walk(absolute)) {
    const text = readFileSync(file, "utf8");
    const rel = relative(ROOT, file);
    const lines = text.split("\n").length;
    if (lines > MAX_FILE_LINES) problems.push(`${rel}: ${lines} lines (max ${MAX_FILE_LINES})`);
    if (FUNCTION_RULE_DIRS.includes(dir)) problems.push(...functionProblems(file, text, rel));
  }
}

if (problems.length) {
  console.error(`Size rules violated (${problems.length}):\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
console.log(
  `Size rules OK: every file < ${MAX_FILE_LINES} lines, every src function < ${MAX_FUNCTION_LINES} lines.`,
);
