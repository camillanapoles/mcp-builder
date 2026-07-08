/**
 * Scaffolder — gera um projeto MCP server a partir de uma MCPSpec.
 *
 * Pipeline:
 * 1. Validar spec (via validator)
 * 2. Selecionar template (sdk × pattern)
 * 3. Renderizar cada arquivo do template com Handlebars
 * 4. Escrever no destino
 * 5. Inicializar git + commit inicial
 *
 * Não executa hooks — isso é responsabilidade do caller (CLI/MCP/HTTP/Action).
 * O scaffolder é puramente determinístico: mesma spec + mesmo template → mesmo output.
 */

import { readFile, writeFile, mkdir, readdir, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import Handlebars from 'handlebars';
import type { MCPSpec, ScaffolderResult } from '../types.js';
import { validateMCPSpec } from '../validator/index.js';

const execFileAsync = promisify(execFile);

// ============================================================================
// Handlebars setup
// ============================================================================

Handlebars.registerHelper('pascalCase', (s: string) =>
  s.replace(/(^|[-_])([a-z])/g, (_, __, c) => c.toUpperCase()),
);

Handlebars.registerHelper('camelCase', (s: string) => {
  const p = s.replace(/(^|[-_])([a-z])/g, (_, __, c) => c.toUpperCase());
  return p.charAt(0).toLowerCase() + p.slice(1);
});

Handlebars.registerHelper('snakeCase', (s: string) =>
  s.replace(/([A-Z])/g, '_$1').replace(/^_/, '').toLowerCase().replace(/[-\s]+/g, '_'),
);

Handlebars.registerHelper('kebabCase', (s: string) =>
  s.replace(/([A-Z])/g, '-$1').replace(/^-/, '').toLowerCase(),
);

Handlebars.registerHelper('eq', (a, b) => a === b);
Handlebars.registerHelper('includes', (arr: unknown[], v: unknown) => Array.isArray(arr) && arr.includes(v));
Handlebars.registerHelper('join', (arr: unknown[], sep: string) => Array.isArray(arr) ? arr.join(sep) : '');
Handlebars.registerHelper('json', (obj: unknown) => JSON.stringify(obj ?? null, null, 2));

// ============================================================================
// Scaffolder
// ============================================================================

export interface ScaffolderOptions {
  templatesRoot: string;       // root dos templates (ex: /path/to/templates)
  outputRoot: string;          // onde criar o projeto
  skipGit?: boolean;           // pular git init
  overwrite?: boolean;         // sobrescrever se existir
}

export class Scaffolder {
  constructor(private opts: ScaffolderOptions) {}

  /**
   * Gera projeto a partir de spec.
   */
  async generate(spec: MCPSpec): Promise<ScaffolderResult> {
    // 1. Validar spec
    const validation = validateMCPSpec(spec);
    if (!validation.ok) {
      return {
        ok: false,
        projectPath: '',
        files: [],
        error: validation.block?.reason ?? 'invalid spec',
      };
    }

    // 2. Selecionar template
    const templateDir = join(this.opts.templatesRoot, `${spec.sdk}-sdk`, spec.pattern);
    if (!existsSync(templateDir)) {
      return {
        ok: false,
        projectPath: '',
        files: [],
        error: `template not found: ${templateDir}`,
      };
    }

    // 3. Destino
    const projectPath = join(this.opts.outputRoot, spec.name);
    if (existsSync(projectPath) && !this.opts.overwrite) {
      return {
        ok: false,
        projectPath,
        files: [],
        error: `destination already exists: ${projectPath} (use overwrite: true)`,
      };
    }

    // 4. Renderizar template
    const files: string[] = [];
    await this.renderDir(templateDir, projectPath, spec, files);

    // 5. Inicializar git
    if (!this.opts.skipGit) {
      await this.initGit(projectPath, spec);
    }

    return {
      ok: true,
      projectPath,
      files,
    };
  }

  /**
   * Renderiza um diretório recursivamente.
   * Arquivos *.hbs são templates Handlebars; outros são copiados literalmente.
   * Nomes de arquivos também passam por renderização (permitem {{name}}.py).
   */
  private async renderDir(
    srcDir: string,
    destDir: string,
    spec: MCPSpec,
    files: string[],
  ): Promise<void> {
    await mkdir(destDir, { recursive: true });
    const entries = await readdir(srcDir, { withFileTypes: true });

    for (const entry of entries) {
      // ignorar diretórios de template engine
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '__pycache__') {
        continue;
      }

      const srcPath = join(srcDir, entry.name);
      // renderizar nome do arquivo/diretório
      const renderedName = this.renderString(entry.name, spec);
      const destPath = join(destDir, renderedName);

      if (entry.isDirectory()) {
        await this.renderDir(srcPath, destPath, spec, files);
      } else if (entry.isFile()) {
        // arquivos .hbs são templates; removemos extensão .hbs no destino
        if (entry.name.endsWith('.hbs')) {
          const content = await readFile(srcPath, 'utf8');
          const rendered = this.renderString(content, spec);
          const finalPath = destPath.replace(/\.hbs$/, '');
          await mkdir(dirname(finalPath), { recursive: true });
          await writeFile(finalPath, rendered, 'utf8');
          files.push(relative(this.opts.outputRoot, finalPath));
        } else {
          // arquivo binário/texto simples — copiar literalmente
          await mkdir(dirname(destPath), { recursive: true });
          await copyFile(srcPath, destPath);
          files.push(relative(this.opts.outputRoot, destPath));
        }
      }
    }
  }

  private renderString(tpl: string, spec: MCPSpec): string {
    const template = Handlebars.compile(tpl, { noEscape: true });
    return template({ spec, ...spec, tools: spec.tools, date: new Date().toISOString() });
  }

  private async initGit(projectPath: string, spec: MCPSpec): Promise<void> {
    try {
      await execFileAsync('git', ['init', '-b', 'main'], { cwd: projectPath });
      await execFileAsync('git', ['add', '.'], { cwd: projectPath });
      await execFileAsync(
        'git',
        ['commit', '-m', `feat: scaffold ${spec.name} (${spec.sdk}/${spec.pattern})`],
        {
          cwd: projectPath,
          env: { ...process.env, GIT_AUTHOR_NAME: 'mcp-builder', GIT_AUTHOR_EMAIL: 'bot@mcp-builder.dev', GIT_COMMITTER_NAME: 'mcp-builder', GIT_COMMITTER_EMAIL: 'bot@mcp-builder.dev' },
        },
      );
    } catch (err) {
      // git não é crítico — logar e continuar
      console.warn(`git init failed (non-critical): ${(err as Error).message}`);
    }
  }
}
