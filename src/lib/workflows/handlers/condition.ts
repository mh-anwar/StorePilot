// Condition step: evaluate an expression against the run context.
// We use a *very* small, safe expression evaluator — no eval() — that
// supports the operators merchants actually need: ==, !=, <, <=, >, >=,
// &&, ||, !, and dotted path lookups from the run context.
//
// If the condition is false, the step short-circuits with "skipped".
// When skipped, downstream steps that reference this step's output will
// resolve to undefined — same behavior as Shopify Flow's branch-skip.
import { registerStep } from "../registry";

// Hand-rolled tokenizer + Pratt parser. ~120 lines. No external deps.
type Tok =
  | { t: "num"; v: number }
  | { t: "str"; v: string }
  | { t: "ident"; v: string }
  | { t: "op"; v: string }
  | { t: "lp" }
  | { t: "rp" }
  | { t: "end" };

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9]/.test(c)) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      out.push({ t: "num", v: Number(src.slice(i, j)) });
      i = j; continue;
    }
    if (c === "'" || c === '"') {
      let j = i + 1;
      while (j < src.length && src[j] !== c) j++;
      out.push({ t: "str", v: src.slice(i + 1, j) });
      i = j + 1; continue;
    }
    if (/[a-zA-Z_]/.test(c)) {
      let j = i;
      while (j < src.length && /[a-zA-Z0-9_.\[\]]/.test(src[j])) j++;
      out.push({ t: "ident", v: src.slice(i, j) });
      i = j; continue;
    }
    if (c === "(") { out.push({ t: "lp" }); i++; continue; }
    if (c === ")") { out.push({ t: "rp" }); i++; continue; }
    const two = src.slice(i, i + 2);
    if (["==", "!=", "<=", ">=", "&&", "||"].includes(two)) {
      out.push({ t: "op", v: two }); i += 2; continue;
    }
    if (["<", ">", "!", "+", "-", "*", "/"].includes(c)) {
      out.push({ t: "op", v: c }); i++; continue;
    }
    throw new Error(`unexpected char '${c}' at ${i}`);
  }
  out.push({ t: "end" });
  return out;
}

const PRECEDENCE: Record<string, number> = {
  "||": 1, "&&": 2,
  "==": 3, "!=": 3,
  "<": 4, "<=": 4, ">": 4, ">=": 4,
  "+": 5, "-": 5,
  "*": 6, "/": 6,
};

function evaluate(src: string, ctx: Record<string, unknown>): unknown {
  const toks = tokenize(src);
  let pos = 0;
  const peek = () => toks[pos];
  const eat = () => toks[pos++];

  function parsePrimary(): unknown {
    const t = eat();
    if (t.t === "num") return t.v;
    if (t.t === "str") return t.v;
    if (t.t === "ident") {
      if (t.v === "true") return true;
      if (t.v === "false") return false;
      if (t.v === "null") return null;
      return lookup(t.v, ctx);
    }
    if (t.t === "lp") {
      const v = parseExpr(0);
      if (eat().t !== "rp") throw new Error("expected ')'");
      return v;
    }
    if (t.t === "op" && t.v === "!") {
      return !parsePrimary();
    }
    if (t.t === "op" && t.v === "-") {
      return -(parsePrimary() as number);
    }
    throw new Error(`unexpected token ${JSON.stringify(t)}`);
  }

  function parseExpr(minPrec: number): unknown {
    let left = parsePrimary();
    while (true) {
      const t = peek();
      if (t.t !== "op") break;
      const prec = PRECEDENCE[t.v];
      if (prec == null || prec < minPrec) break;
      eat();
      const right = parseExpr(prec + 1);
      left = applyOp(t.v, left, right);
    }
    return left;
  }

  return parseExpr(0);
}

function applyOp(op: string, a: unknown, b: unknown): unknown {
  switch (op) {
    case "==": return a === b || String(a) === String(b);
    case "!=": return !(a === b || String(a) === String(b));
    case "<": return (a as number) < (b as number);
    case "<=": return (a as number) <= (b as number);
    case ">": return (a as number) > (b as number);
    case ">=": return (a as number) >= (b as number);
    case "&&": return Boolean(a) && Boolean(b);
    case "||": return Boolean(a) || Boolean(b);
    case "+": return (typeof a === "string" || typeof b === "string")
      ? String(a) + String(b)
      : (a as number) + (b as number);
    case "-": return (a as number) - (b as number);
    case "*": return (a as number) * (b as number);
    case "/": return (a as number) / (b as number);
  }
  throw new Error(`unsupported op '${op}'`);
}

function lookup(path: string, ctx: Record<string, unknown>): unknown {
  const parts = path.split(".");
  let cur: unknown = ctx;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

export function evalCondition(expr: string, ctx: Record<string, unknown>): boolean {
  return Boolean(evaluate(expr, ctx));
}

registerStep("condition", {
  category: "Logic",
  description: "If the expression is false, the rest of the workflow is skipped.",
  handler: async (step, cfg, ctx) => {
    const expression = String(cfg.expression ?? "");
    if (!expression) return { status: "error", error: "missing 'expression'" };
    // Expose the useful roots from the run context so expressions can
    // reference `trigger.x` and `steps.y.output.z` naturally.
    const scope = {
      trigger: ctx.trigger,
      steps: Object.fromEntries(
        Object.entries(ctx.steps).map(([k, v]) => [k, v.output])
      ),
    };
    const result = evalCondition(expression, scope);
    if (!result) {
      return { status: "skipped", reason: `expression '${expression}' was false` };
    }
    return { status: "ok", output: { passed: true } };
  },
});
