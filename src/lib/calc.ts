/**
 * A tiny, sandboxed expression evaluator used by sales script CALC blocks.
 *
 * Supports:
 *   - number literals (123, 12.5)
 *   - identifiers referring to capture/calc field IDs
 *   - operators: + - * / %  ( )
 *   - comparisons:  > < >= <= == !=    (return 0 or 1)
 *   - unary minus
 *   - whitelisted functions: min, max, round, ceil, floor, abs, if, clamp
 *
 * Everything else throws. We never use eval / Function — the parser walks
 * the tokens by hand so a hostile string can't escape the sandbox.
 */

export type Numeric = number;

type Token =
  | { kind: "num"; value: number }
  | { kind: "id"; value: string }
  | { kind: "op"; value: string }
  | { kind: "lparen" }
  | { kind: "rparen" }
  | { kind: "comma" };

const SINGLE_OPS = new Set(["+", "-", "*", "/", "%"]);

function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === " " || c === "\t" || c === "\n") { i++; continue; }
    if (c === "(") { out.push({ kind: "lparen" }); i++; continue; }
    if (c === ")") { out.push({ kind: "rparen" }); i++; continue; }
    if (c === ",") { out.push({ kind: "comma" });  i++; continue; }

    // two-char operators
    if ((c === ">" || c === "<" || c === "=" || c === "!") && src[i + 1] === "=") {
      out.push({ kind: "op", value: c + "=" });
      i += 2;
      continue;
    }
    if (c === ">" || c === "<") {
      out.push({ kind: "op", value: c });
      i++;
      continue;
    }
    if (SINGLE_OPS.has(c)) {
      out.push({ kind: "op", value: c });
      i++;
      continue;
    }

    // number
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < src.length && /[0-9._]/.test(src[j])) j++;
      const raw = src.slice(i, j).replace(/_/g, "");
      const n = parseFloat(raw);
      if (Number.isNaN(n)) throw new Error(`Invalid number: ${raw}`);
      out.push({ kind: "num", value: n });
      i = j;
      continue;
    }

    // identifier
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++;
      out.push({ kind: "id", value: src.slice(i, j) });
      i = j;
      continue;
    }

    throw new Error(`Unexpected character "${c}" at position ${i}`);
  }
  return out;
}

const FUNCS: Record<string, (...args: number[]) => number> = {
  min:   Math.min,
  max:   Math.max,
  round: (x) => Math.round(x),
  ceil:  (x) => Math.ceil(x),
  floor: (x) => Math.floor(x),
  abs:   (x) => Math.abs(x),
  if:    (cond, a, b) => (cond !== 0 ? a : b),
  clamp: (x, lo, hi) => Math.min(hi, Math.max(lo, x)),
};

/**
 * Evaluate `expr` against the given numeric context. Returns NaN if any
 * referenced identifier is missing or non-numeric (so the UI can show a
 * placeholder for incomplete captures).
 */
export function evaluate(expr: string, context: Record<string, unknown>): number {
  const tokens = tokenize(expr);
  let pos = 0;

  const peek = () => tokens[pos];
  const consume = () => tokens[pos++];

  const isOp = (t: Token | undefined, v: string) =>
    t !== undefined && t.kind === "op" && t.value === v;

  function parseExpr(): number {
    return parseComp();
  }

  function parseComp(): number {
    const left = parseAdd();
    const next = peek();
    if (next && next.kind === "op" && [">", "<", ">=", "<=", "==", "!="].includes(next.value)) {
      consume();
      const right = parseAdd();
      if (Number.isNaN(left) || Number.isNaN(right)) return NaN;
      switch (next.value) {
        case ">":  return left >  right ? 1 : 0;
        case "<":  return left <  right ? 1 : 0;
        case ">=": return left >= right ? 1 : 0;
        case "<=": return left <= right ? 1 : 0;
        case "==": return left === right ? 1 : 0;
        case "!=": return left !== right ? 1 : 0;
      }
    }
    return left;
  }

  function parseAdd(): number {
    let acc = parseMul();
    while (peek() && (isOp(peek(), "+") || isOp(peek(), "-"))) {
      const op = consume() as { kind: "op"; value: string };
      const rhs = parseMul();
      if (Number.isNaN(acc) || Number.isNaN(rhs)) { acc = NaN; continue; }
      acc = op.value === "+" ? acc + rhs : acc - rhs;
    }
    return acc;
  }

  function parseMul(): number {
    let acc = parseUnary();
    while (peek() && (isOp(peek(), "*") || isOp(peek(), "/") || isOp(peek(), "%"))) {
      const op = consume() as { kind: "op"; value: string };
      const rhs = parseUnary();
      if (Number.isNaN(acc) || Number.isNaN(rhs)) { acc = NaN; continue; }
      if (op.value === "*") acc = acc * rhs;
      else if (op.value === "/") acc = rhs === 0 ? NaN : acc / rhs;
      else acc = acc % rhs;
    }
    return acc;
  }

  function parseUnary(): number {
    if (isOp(peek(), "-")) {
      consume();
      const v = parseUnary();
      return Number.isNaN(v) ? NaN : -v;
    }
    if (isOp(peek(), "+")) {
      consume();
      return parseUnary();
    }
    return parseAtom();
  }

  function parseAtom(): number {
    const t = peek();
    if (!t) throw new Error("Unexpected end of expression");

    if (t.kind === "num") {
      consume();
      return t.value;
    }
    if (t.kind === "lparen") {
      consume();
      const v = parseExpr();
      const close = consume();
      if (!close || close.kind !== "rparen") throw new Error("Missing )");
      return v;
    }
    if (t.kind === "id") {
      consume();
      // Function call?
      if (peek()?.kind === "lparen") {
        consume();
        const args: number[] = [];
        if (peek()?.kind !== "rparen") {
          args.push(parseExpr());
          while (peek()?.kind === "comma") {
            consume();
            args.push(parseExpr());
          }
        }
        const close = consume();
        if (!close || close.kind !== "rparen") throw new Error("Missing ) in function call");
        const fn = FUNCS[t.value];
        if (!fn) throw new Error(`Unknown function "${t.value}"`);
        if (args.some(Number.isNaN)) return NaN;
        return fn(...args);
      }
      // Identifier lookup
      const v = context[t.value];
      if (typeof v === "number" && Number.isFinite(v)) return v;
      if (typeof v === "boolean") return v ? 1 : 0;
      if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(parseFloat(v))) {
        return parseFloat(v);
      }
      return NaN;
    }
    throw new Error(`Unexpected token ${JSON.stringify(t)}`);
  }

  try {
    const v = parseExpr();
    if (pos !== tokens.length) throw new Error("Unexpected trailing tokens");
    return v;
  } catch {
    return NaN;
  }
}

/**
 * Try to evaluate; return undefined if the result is not a finite number.
 * Caller can then render the field as "__" / empty.
 */
export function tryEvaluate(expr: string, context: Record<string, unknown>): number | undefined {
  const v = evaluate(expr, context);
  return Number.isFinite(v) ? v : undefined;
}
