#!/usr/bin/env node
// Enforces CLAUDE.md size rules on src/: files < 200 lines, functions < 40 lines.
// Uses the TypeScript compiler API so arrow functions and methods are measured too.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";

const ROOT = new URL("..", import.meta.url).pathname;
const MAX_FILE = 200;
const MAX_FN = 40;

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* walk(path);
    else if (/\.(ts|tsx)$/.test(name)) yield path;
  }
}

const isFn = (n) =>
  ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n) || ts.isMethodDeclaration(n);

function fnName(node) {
  if (node.name) return node.name.getText();
  const parent = node.parent;
  if (parent && ts.isVariableDeclaration(parent)) return parent.name.getText();
  if (parent && ts.isPropertyAssignment(parent)) return parent.name.getText();
  return "(anonymous)";
}

const problems = [];
for (const file of walk(join(ROOT, "src"))) {
  const text = readFileSync(file, "utf8");
  const rel = relative(ROOT, file);
  const lines = text.split("\n").length;
  if (lines > MAX_FILE) problems.push(`${rel}: ${lines} lines (max ${MAX_FILE})`);
  const kind = file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind);
  const visit = (node) => {
    if (isFn(node) && node.body) {
      const start = source.getLineAndCharacterOfPosition(node.getStart()).line;
      const end = source.getLineAndCharacterOfPosition(node.getEnd()).line;
      const length = end - start + 1;
      if (length > MAX_FN) problems.push(`${rel}:${start + 1} ${fnName(node)}: ${length} lines (max ${MAX_FN})`);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}

if (problems.length) {
  console.error(`Size rules violated (${problems.length}):\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
console.log("Size rules OK: every file < 200 lines, every function < 40 lines.");
