/**
 * Blueprint parser — tests
 */

import { describe, it, expect } from 'vitest';
import { parseBlueprint, parseBlueprints, BlueprintParseError } from '../../src/blueprint/parser.js';

describe('parseBlueprint', () => {
  it('parses simple block scalar initialize', () => {
    const yaml = `
name: test
initialize: |
  curl -LsSf https://example.com/install.sh | sh
  apt-get update && apt-get install -y build-essential
`;
    const bp = parseBlueprint(yaml);
    expect(bp.name).toBe('test');
    expect(bp.initialize).toBeDefined();
    expect(bp.initialize).toHaveLength(1);
    expect(bp.initialize![0]).toEqual({
      run: 'curl -LsSf https://example.com/install.sh | sh\napt-get update && apt-get install -y build-essential\n',
    });
  });

  it('parses structured steps with name + run + env', () => {
    const yaml = `
name: test
initialize:
  - name: Install Python
    run: pip install uv
    env:
      PIP_BREAK_SYSTEM_PACKAGES: "1"
`;
    const bp = parseBlueprint(yaml);
    expect(bp.initialize).toHaveLength(1);
    expect(bp.initialize![0]).toEqual({
      name: 'Install Python',
      run: 'pip install uv',
      env: { PIP_BREAK_SYSTEM_PACKAGES: '1' },
    });
  });

  it('parses GitHub Action step with uses', () => {
    const yaml = `
name: test
initialize:
  - name: Setup Python
    uses: github.com/actions/setup-python@v5
    with:
      python-version: "3.12"
`;
    const bp = parseBlueprint(yaml);
    expect(bp.initialize![0]).toEqual({
      name: 'Setup Python',
      uses: 'github.com/actions/setup-python@v5',
      with: { 'python-version': '3.12' },
    });
  });

  it('rejects uses without github.com/ prefix', () => {
    const yaml = `
name: test
initialize:
  - uses: actions/setup-python@v5
`;
    expect(() => parseBlueprint(yaml)).toThrow(BlueprintParseError);
  });

  it('rejects uses without @ref suffix', () => {
    const yaml = `
name: test
initialize:
  - uses: github.com/actions/setup-python
`;
    expect(() => parseBlueprint(yaml)).toThrow(BlueprintParseError);
  });

  it('parses knowledge entries', () => {
    const yaml = `
name: test
knowledge:
  - name: lint
    contents: npm run lint
  - name: test
    contents: npm test
  - name: build
    contents: npm run build
`;
    const bp = parseBlueprint(yaml);
    expect(bp.knowledge).toHaveLength(3);
    expect(bp.knowledge![0].name).toBe('lint');
    expect(bp.knowledge![1].name).toBe('test');
    expect(bp.knowledge![2].name).toBe('build');
  });

  it('rejects knowledge without name', () => {
    const yaml = `
name: test
knowledge:
  - contents: foo
`;
    expect(() => parseBlueprint(yaml)).toThrow(BlueprintParseError);
  });

  it('parses clone config', () => {
    const yaml = `
name: test
clone:
  path: my-project
  ref: develop
  depth: 1
  tags: false
  submodules: recursive
  lfs: false
`;
    const bp = parseBlueprint(yaml);
    expect(bp.clone).toEqual({
      path: 'my-project',
      ref: 'develop',
      depth: 1,
      tags: false,
      submodules: 'recursive',
      lfs: false,
    });
  });

  it('parses post-build section (kebab-case)', () => {
    const yaml = `
name: test
post-build: |
  node --version
  python --version
`;
    const bp = parseBlueprint(yaml);
    expect(bp.postBuild).toBeDefined();
    expect(bp.postBuild).toHaveLength(1);
  });

  it('parses post-build section (camelCase alias)', () => {
    const yaml = `
name: test
postBuild: |
  node --version
`;
    const bp = parseBlueprint(yaml);
    expect(bp.postBuild).toBeDefined();
  });

  it('parses env and secrets', () => {
    const yaml = `
name: test
env:
  NODE_ENV: development
secrets:
  - NPM_TOKEN
  - API_KEY
`;
    const bp = parseBlueprint(yaml);
    expect(bp.env).toEqual({ NODE_ENV: 'development' });
    expect(bp.secrets).toEqual(['NPM_TOKEN', 'API_KEY']);
  });

  it('defaults name to unnamed-blueprint', () => {
    const bp = parseBlueprint('initialize: echo hi');
    expect(bp.name).toBe('unnamed-blueprint');
  });

  it('rejects root that is not object', () => {
    expect(() => parseBlueprint('- foo\n- bar')).toThrow(BlueprintParseError);
  });

  it('rejects step with neither run nor uses', () => {
    const yaml = `
name: test
initialize:
  - name: Bad step
`;
    expect(() => parseBlueprint(yaml)).toThrow(BlueprintParseError);
  });
});

describe('parseBlueprints (multi-document)', () => {
  it('parses multiple documents separated by ---', () => {
    const yaml = `
name: first
initialize: echo 1
---
name: second
initialize: echo 2
`;
    const bps = parseBlueprints(yaml);
    expect(bps).toHaveLength(2);
    expect(bps[0].name).toBe('first');
    expect(bps[1].name).toBe('second');
  });

  it('skips empty documents', () => {
    const yaml = `
name: first
---
---
name: third
`;
    const bps = parseBlueprints(yaml);
    expect(bps).toHaveLength(2);
  });

  it('adds document index to error context', () => {
    const yaml = `
name: ok
---
name: bad
initialize:
  - uses: invalid-no-prefix
`;
    expect(() => parseBlueprints(yaml)).toThrow(/document 1/);
  });
});
