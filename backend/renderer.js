import fs from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { parser } from 'posthtml-parser';
import { render as renderToString } from 'posthtml-render';
import validator from 'validator';
import { DYNAMIC_REGISTRY, PAGE_REGISTRY } from './registries.js';

/**
 * ENUMS & MODES
 */
const RENDER_MODE = Object.freeze({
  DEVELOPMENT: 'DEVELOPMENT',
  PRODUCTION: 'PRODUCTION',
  STATIC_BUILD: 'STATIC_BUILD',
});

// DoS Protection: Limit input HTML size (e.g., 5MB)
const MAX_INPUT_SIZE = 5 * 1024 * 1024;

/**
 * RENDER CONTEXT
 * Handles performance tracking and infinite recursion protection.
 */
class RenderContext {
  constructor(key, parent = null, sharedConfig = null) {
    this.key = key;
    this.parent = parent;
    this.children = [];
    this.startTime = performance.now();
    this.duration = 0;
    this.source = null;

    if (parent) {
      this.config = parent.config;
      this.depth = parent.depth + 1;
    } else {
      this.config = sharedConfig || {
        MAX_TIME: 5000,
        WINDOW_SIZE: 5,
        MAX_RECURRENCE: 1,
        globalStart: this.startTime,
      };
      this.depth = 0;
    }
  }

  canProcess(nextKey) {
    if (performance.now() - this.config.globalStart > this.config.MAX_TIME) {
      console.error(
        `[Timeout] Global limit of ${this.config.MAX_TIME}ms reached.`
      );
      return false;
    }

    let count = 0;
    for (
      let curr = this, i = 0;
      curr && i < this.config.WINDOW_SIZE;
      curr = curr.parent, i++
    ) {
      if (curr.key === nextKey) count++;
    }

    if (count > this.config.MAX_RECURRENCE) {
      console.error(
        `[Circular] Blocked "${nextKey}" (recurrence > ${this.config.MAX_RECURRENCE})`
      );
      return false;
    }

    return true;
  }

  createChild(key) {
    const child = new RenderContext(key, this);
    this.children.push(child);
    return child;
  }

  finish() {
    this.duration = performance.now() - this.startTime;
  }

  printReport() {
    const totalTime = (performance.now() - this.config.globalStart).toFixed(2);

    console.log(`\n--- Render Report: ${this.key} ---`);

    const printNode = (node, depth) => {
      const indent = '  '.repeat(depth);
      const sourceInfo = node.source ? ` [${node.source}]` : '';
      console.log(
        `${indent}└─ ${node.key}${sourceInfo} (${node.duration.toFixed(2)}ms)`
      );

      node.children.forEach((child) => {
        printNode(child, depth + 1);
      });
    };

    printNode(this, 0);
    console.log(`Total Execution Time: ${totalTime}ms\n`);
  }
}

/**
 * STRATEGY MODES
 * Note: PROD now uses prodLoader which is strictly limited to the dist folder.
 */
const MODES = {
  [RENDER_MODE.DEVELOPMENT]: { loader: loadRaw, walker: walkFull },
  [RENDER_MODE.PRODUCTION]: { loader: prodLoader, walker: walkDynamicOnly },
  [RENDER_MODE.STATIC_BUILD]: { loader: loadRaw, walker: walkStaticOnly },
};

/**
 * CORE LOGIC
 */

async function transform(html, params, context, walkerFn) {
  if (!html) {
    console.error(`[Transform Error] Empty HTML for key: ${context.key}`);
    return '';
  }

  if (html.length > MAX_INPUT_SIZE) {
    console.error(
      `[Security] Input too large for key: ${context.key} (${html.length} bytes)`
    );
    throw new Error('Content too large');
  }

  const ast = parser(html);
  const transformedAst = await walkerFn(ast, params, context);
  return renderToString(transformedAst);
}

async function resultRender({ key, params, context, loader, walker }) {
  const childCtx = context.createChild(key);

  try {
    const content = await loader(key, childCtx);
    return await transform(content, params, childCtx, walker);
  } finally {
    childCtx.finish();
  }
}

async function resolveInclude({ key, params, context, walker }) {
  if (!context.canProcess(key)) {
    return '';
  }

  const childCtx = context.createChild(key);

  try {
    const raw = await loadRaw(key, childCtx);
    return await transform(raw, params, childCtx, walker);
  } finally {
    childCtx.finish();
  }
}

async function resolveDynamic({ key, params, context, dynamicProvider, mode }) {
  if (!context.canProcess(key)) {
    return '';
  }

  if (!dynamicProvider) {
    console.error(`[Render Error] dynamicProvider is missing for key: ${key}`);
    return '';
  }

  const childCtx = context.createChild(key);

  try {
    const render = (subKey, localParams = {}) => {
      return resultRender({
        key: subKey,
        params: { ...params, ...localParams },
        context: childCtx,
        ...MODES[mode],
      });
    };

    return await dynamicProvider({ ...params, render });
  } finally {
    childCtx.finish();
  }
}

/**
 * WALKER DEFINITIONS
 */

async function walkFull(nodes, params, context) {
  return await baseWalker(nodes, params, context, {
    handleVar: (p, name) => {
      const val = p[name] != null ? String(p[name]) : '';
      return validator.escape(val);
    },
    handleInclude: (key, p, ctx) => {
      return resolveInclude({ key, params: p, context: ctx, walker: walkFull });
    },
    handleDynamic: (key, p, ctx, dynamicProvider) => {
      return resolveDynamic({
        key,
        params: p,
        context: ctx,
        dynamicProvider,
        mode: RENDER_MODE.DEVELOPMENT,
      });
    },
  });
}

async function walkStaticOnly(nodes, params, context) {
  return await baseWalker(nodes, params, context, {
    handleVar: (_p, _name, node) => {
      return node;
    },
    handleInclude: (key, p, ctx) => {
      return resolveInclude({
        key,
        params: p,
        context: ctx,
        walker: walkStaticOnly,
      });
    },
    handleDynamic: (_key, _p, _ctx, _dynamicProvider, node) => {
      return node;
    },
  });
}

async function walkDynamicOnly(nodes, params, context) {
  return await baseWalker(nodes, params, context, {
    handleVar: (p, name) => {
      const val = p[name] != null ? String(p[name]) : '';
      return validator.escape(val);
    },
    handleInclude: (_key, _p, _ctx, node) => {
      return node;
    },
    handleDynamic: (key, p, ctx, dynamicProvider) => {
      return resolveDynamic({
        key,
        params: p,
        context: ctx,
        dynamicProvider,
        mode: RENDER_MODE.PRODUCTION,
      });
    },
  });
}

async function baseWalker(nodes, params, context, actions) {
  const tasks = nodes.map(async (node) => {
    if (typeof node === 'string') {
      if (node.includes('{{')) {
        return node.replace(/{{(.*?)}}/g, (match, name) => {
          const result = actions.handleVar(params, name.trim(), match);
          return typeof result === 'string' ? result : match;
        });
      }
      return node;
    }

    if (!node || typeof node !== 'object') {
      return node;
    }

    if (node.attrs) {
      for (const [key, value] of Object.entries(node.attrs)) {
        if (typeof value === 'string' && value.includes('{{')) {
          node.attrs[key] = value.replace(/{{(.*?)}}/g, (match, name) => {
            const result = actions.handleVar(params, name.trim(), match);
            return typeof result === 'string' ? result : match;
          });
        }
      }
    }

    const { tag, attrs = {} } = node;

    if (tag === 'x-var') {
      return await actions.handleVar(params, attrs.name, node);
    }

    if (tag === 'x-include') {
      return await actions.handleInclude(attrs.src, params, context, node);
    }

    if (tag === 'x-dynamic') {
      const dynamicProvider = DYNAMIC_REGISTRY[attrs.src];
      if (!dynamicProvider) {
        console.error(
          `[Render Error] Dynamic provider not found: ${attrs.src}`
        );
        return '';
      }
      return await actions.handleDynamic(
        attrs.src,
        params,
        context,
        dynamicProvider,
        node
      );
    }

    if (node.content) {
      node.content = await baseWalker(node.content, params, context, actions);
    }

    return node;
  });

  return Promise.all(tasks);
}

/**
 * EXPORTS & IO
 */

export async function renderDev(key, params = {}) {
  const context = new RenderContext(`DEV:${key}`);
  try {
    return await resolveInclude({ key, params, context, walker: walkFull });
  } finally {
    context.finish();
    context.printReport();
  }
}

export async function build(distDir = './dist') {
  console.log('Starting Universal Static Build...');
  await fs.mkdir(distDir, { recursive: true });

  for (const key of Object.keys(PAGE_REGISTRY)) {
    const context = new RenderContext(`BUILD:${key}`);
    try {
      const result = await resolveInclude({
        key,
        params: {},
        context,
        walker: walkStaticOnly,
      });
      const targetPath = path.join(distDir, `${key}.html`);
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.writeFile(targetPath, result);
    } finally {
      context.finish();
      context.printReport();
    }
  }
}

export async function renderProd(key, params = {}) {
  const context = new RenderContext(`PROD:${key}`);
  try {
    const html = await loadDist(key, context);
    return await transform(html, params, context, walkDynamicOnly);
  } finally {
    context.finish();
    context.printReport();
  }
}

export async function loadRaw(key, context = null) {
  const file = PAGE_REGISTRY[key];
  if (!file) {
    console.error(`[Render Error] Page not found in registry: ${key}`);
    return '';
  }

  const fullPath = path.resolve(file);

  if (context) {
    context.source = `RAW: ${file}`;
  }

  return await fs.readFile(fullPath, 'utf-8');
}

/**
 * loadDist (Production Loader)
 * Strictly limited to the /dist folder to prevent path traversal or source leakage.
 */
async function loadDist(key, context = null) {
  // Resolve the path and ensure it's relative to current working directory /dist
  const safePath = path.join(process.cwd(), 'dist', `${key}.html`);

  // Security Guard: Prevent directory traversal (e.g. key = "../../etc/passwd")
  if (!safePath.startsWith(path.join(process.cwd(), 'dist'))) {
    console.error(
      `[Security Warning] Attempted path traversal blocked for key: ${key}`
    );
    return '';
  }

  try {
    if (context) {
      context.source = `DIST: ${key}.html`;
    }
    return await fs.readFile(safePath, 'utf-8');
  } catch (err) {
    console.error(`[Render Error] Pre-built file not found in dist: ${key}`);
    return '';
  }
}

async function prodLoader(key, context) {
  return await loadDist(key, context);
}
