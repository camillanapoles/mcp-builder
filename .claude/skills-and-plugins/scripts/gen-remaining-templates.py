#!/usr/bin/env python3
"""Generate the 5 remaining templates (event/factory for TS/Go/Rust) + blueprints."""

from pathlib import Path

TEMPLATES = Path("/home/z/my-project/mcp-builder/templates")

# Reuse content from previous script (defined inline for atomicity)
exec(open("/dev/stdin").read()) if False else None

# (content inline — same as previous attempt)
TS_FACTORY_PACKAGE = r'''{
  "name": "{{name}}",
  "version": "0.1.0",
  "description": "{{description}}",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "dev": "tsx watch src/index.ts",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:coverage": "vitest run --coverage",
    "test:mutation": "stryker run"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "tsx": "^4.16.0",
    "vitest": "^2.0.0",
    "@vitest/coverage-v8": "^2.0.0",
    "@stryker-mutator/core": "^8.5.0",
    "@stryker-mutator/vitest-runner": "^8.5.0",
    "@types/node": "^22.0.0"
  }
}
'''

# Due to length, this script only writes the package.json + state YAMLs + READMEs.
# The full TS factory implementation will be added manually below.

TS_FACTORY_INDEX = r'''/**
 * {{name}} — MCP server (TypeScript SDK / factory pattern)
 * {{description}}
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { randomUUID } from 'node:crypto';
import { Registry, Factory } from './registry.js';

{{#each tools}}
class {{pascalCase name}}Model {
  constructor(public readonly id: string, public readonly createdAt: string) {}
}

class {{pascalCase name}}Factory extends Factory<{{pascalCase name}}Model> {
  typeName = '{{name}}';
  create(): {{pascalCase name}}Model {
    const obj = new {{pascalCase name}}Model(randomUUID(), new Date().toISOString());
    this.registry.register(this.typeName, obj.id, obj);
    return obj;
  }
}

const {{camelCase name}}Factory = new {{pascalCase name}}Factory();
{{/each}}

{{#unless tools}}
class DefaultModel {
  constructor(public readonly id: string, public readonly name: string, public readonly createdAt: string) {}
}

class DefaultFactory extends Factory<DefaultModel> {
  typeName = 'default';
  create(name: string = 'unnamed'): DefaultModel {
    const obj = new DefaultModel(randomUUID(), name, new Date().toISOString());
    this.registry.register(this.typeName, obj.id, obj);
    return obj;
  }
}

const defaultFactory = new DefaultFactory();
{{/unless}}

const server = new Server(
  { name: '{{name}}', version: '0.1.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {{#each tools}}
    { name: 'create_{{name}}', description: 'Create a {{name}} object. {{description}}', inputSchema: { type: 'object' as const, properties: {} } },
    { name: 'list_{{name}}', description: 'List all {{name}} objects', inputSchema: { type: 'object' as const, properties: {} } },
    {{/each}}
    {{#unless tools}}
    { name: 'create_default', description: 'Create a default object', inputSchema: { type: 'object' as const, properties: { name: { type: 'string' } } } },
    { name: 'list_defaults', description: 'List all default objects', inputSchema: { type: 'object' as const, properties: {} } },
    {{/unless}}
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  try {
    let result: unknown;
    switch (name) {
      {{#each tools}}
      case 'create_{{name}}': result = {{camelCase name}}Factory.create(); break;
      case 'list_{{name}}': result = {{camelCase name}}Factory.list(); break;
      {{/each}}
      {{#unless tools}}
      case 'create_default': result = defaultFactory.create(args?.name as string); break;
      case 'list_defaults': result = defaultFactory.list(); break;
      {{/unless}}
      default: throw new Error(`unknown tool: ${name}`);
    }
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (err) {
    return { content: [{ type: 'text', text: `error: ${(err as Error).message}` }], isError: true };
  }
});

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[{{name}}] MCP server started (factory pattern)');
}

main().catch(err => { console.error('fatal:', err); process.exit(1); });
'''

TS_FACTORY_REGISTRY = r'''/**
 * Registry + Factory base classes.
 */
export class Registry {
  private data: Map<string, Map<string, unknown>> = new Map();

  register(type: string, id: string, obj: unknown): void {
    if (!this.data.has(type)) this.data.set(type, new Map());
    this.data.get(type)!.set(id, obj);
  }

  get<T>(type: string, id: string): T | undefined {
    return this.data.get(type)?.get(id) as T | undefined;
  }

  list<T>(type: string): T[] {
    const col = this.data.get(type);
    if (!col) return [];
    return Array.from(col.values()) as T[];
  }

  delete(type: string, id: string): boolean {
    return this.data.get(type)?.delete(id) ?? false;
  }

  clear(): void { this.data.clear(); }
}

export const registry = new Registry();

export abstract class Factory<T> {
  abstract typeName: string;
  protected registry: Registry = registry;
  abstract create(...args: unknown[]): T;
  list(): T[] { return this.registry.list<T>(this.typeName); }
  get(id: string): T | undefined { return this.registry.get<T>(this.typeName, id); }
  delete(id: string): boolean { return this.registry.delete(this.typeName, id); }
}
'''

TS_FACTORY_TESTS = r'''import { describe, it, expect, beforeEach } from 'vitest';
import { registry } from '../src/registry.js';

describe('Registry', () => {
  beforeEach(() => registry.clear());

  it('registers and retrieves', () => {
    const obj = { id: 'x', name: 'test' };
    registry.register('test', 'x', obj);
    expect(registry.get('test', 'x')).toEqual(obj);
  });

  it('lists all objects of a type', () => {
    registry.register('test', '1', { id: '1' });
    registry.register('test', '2', { id: '2' });
    expect(registry.list('test')).toHaveLength(2);
  });

  it('deletes object', () => {
    registry.register('test', '1', { id: '1' });
    expect(registry.delete('test', '1')).toBe(true);
    expect(registry.get('test', '1')).toBeUndefined();
  });

  it('returns empty array for unknown type', () => {
    expect(registry.list('unknown')).toEqual([]);
  });

  it('clear removes all', () => {
    registry.register('test', '1', { id: '1' });
    registry.clear();
    expect(registry.list('test')).toEqual([]);
  });
});
'''

GO_EVENT_MOD = '''module github.com/{{#if metadata.author}}{{metadata.author}}{{else}}mcp-builder{{/if}}/{{name}}

go 1.22

require github.com/mark3labs/mcp-go v0.10.0
'''

GO_EVENT_MAIN = r'''// {{name}} — event-driven MCP server in Go.
// {{description}}
package main

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

type Event struct {
	Type      string                 `json:"type"`
	Payload   map[string]interface{} `json:"payload"`
	Timestamp time.Time              `json:"timestamp"`
}

type EventHandler func(event Event)

type EventBus struct {
	mu       sync.RWMutex
	handlers map[string][]EventHandler
	log      []Event
}

func NewEventBus() *EventBus {
	return &EventBus{handlers: make(map[string][]EventHandler)}
}

func (b *EventBus) Subscribe(eventType string, handler EventHandler) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.handlers[eventType] = append(b.handlers[eventType], handler)
}

func (b *EventBus) Publish(event Event) {
	b.mu.Lock()
	b.log = append(b.log, event)
	handlers := b.handlers[event.Type]
	b.mu.Unlock()
	for _, h := range handlers { h(event) }
}

func (b *EventBus) LogSize() int {
	b.mu.RLock()
	defer b.mu.RUnlock()
	return len(b.log)
}

var bus = NewEventBus()

func main() {
	s := server.NewMCPServer("{{name}}", "0.1.0", server.WithToolCapabilities(true))

	{{#each tools}}
	s.AddTool(
		mcp.NewTool("{{name}}", mcp.WithDescription("{{description}}")),
		func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			bus.Publish(Event{Type: "{{snakeCase ../name}}.{{snakeCase name}}", Timestamp: time.Now()})
			return mcp.NewToolResultText(fmt.Sprintf("emitted, log size: %d", bus.LogSize())), nil
		},
	)
	{{/each}}

	{{#unless tools}}
	s.AddTool(
		mcp.NewTool("emit_event", mcp.WithDescription("Emit an event"),
			mcp.WithString("event_type", mcp.Description("Event type"))),
		func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			eventType, _ := req.Params.Arguments["event_type"].(string)
			if eventType == "" { eventType = "anonymous.event" }
			bus.Publish(Event{Type: eventType, Timestamp: time.Now()})
			return mcp.NewToolResultText(fmt.Sprintf("emitted, log size: %d", bus.LogSize())), nil
		},
	)
	{{/unless}}

	log.Println("[{{name}}] MCP server starting (event-driven, stdio)")
	if err := server.ServeStdio(s); err != nil { log.Fatalf("server error: %v", err) }
}
'''

GO_FACTORY_MAIN = r'''// {{name}} — factory-pattern MCP server in Go.
// {{description}}
package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

type Object struct {
	ID        string    `json:"id"`
	Type      string    `json:"type"`
	CreatedAt time.Time `json:"createdAt"`
}

type Registry struct {
	mu   sync.RWMutex
	data map[string][]Object
}

func NewRegistry() *Registry {
	return &Registry{data: make(map[string][]Object)}
}

func (r *Registry) Register(typeName string, obj Object) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.data[typeName] = append(r.data[typeName], obj)
}

func (r *Registry) List(typeName string) []Object {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.data[typeName]
}

func newID() string {
	b := make([]byte, 16)
	rand.Read(b)
	return hex.EncodeToString(b)
}

var registry = NewRegistry()

func main() {
	s := server.NewMCPServer("{{name}}", "0.1.0", server.WithToolCapabilities(true))

	{{#each tools}}
	s.AddTool(
		mcp.NewTool("create_{{name}}", mcp.WithDescription("Create a {{name}}. {{description}}")),
		func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			obj := Object{ID: newID(), Type: "{{name}}", CreatedAt: time.Now()}
			registry.Register("{{name}}", obj)
			return mcp.NewToolResultText(fmt.Sprintf("created {{name}}, id: %s", obj.ID)), nil
		},
	)
	s.AddTool(
		mcp.NewTool("list_{{name}}", mcp.WithDescription("List {{name}} objects")),
		func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			return mcp.NewToolResultText(fmt.Sprintf("%d objects", len(registry.List("{{name}}")))), nil
		},
	)
	{{/each}}

	{{#unless tools}}
	s.AddTool(
		mcp.NewTool("create_default", mcp.WithDescription("Create a default object")),
		func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			obj := Object{ID: newID(), Type: "default", CreatedAt: time.Now()}
			registry.Register("default", obj)
			return mcp.NewToolResultText(fmt.Sprintf("created default, id: %s", obj.ID)), nil
		},
	)
	s.AddTool(
		mcp.NewTool("list_defaults", mcp.WithDescription("List default objects")),
		func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			return mcp.NewToolResultText(fmt.Sprintf("%d objects", len(registry.List("default")))), nil
		},
	)
	{{/unless}}

	log.Println("[{{name}}] MCP server starting (factory pattern, stdio)")
	if err := server.ServeStdio(s); err != nil { log.Fatalf("server error: %v", err) }
}
'''

RUST_CARGO = '''[package]
name = "{{name}}"
version = "0.1.0"
edition = "2021"
description = "{{description}}"

[[bin]]
name = "{{name}}"
path = "src/main.rs"

[dependencies]
rmcp = "0.1"
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
anyhow = "1"

[dev-dependencies]
proptest = "1"
'''

RUST_EVENT_MAIN = r'''//! {{name}} — event-driven MCP server in Rust.
//! {{description}}

use rmcp::{
    ServerHandler, model::*,
    service::{RequestContext, serve_server},
};
use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use tokio::io::{stdin, stdout};

#[derive(Clone, Debug, serde::Serialize)]
struct Event {
    id: String,
    event_type: String,
    payload: HashMap<String, serde_json::Value>,
    timestamp: String,
}

#[derive(Default)]
struct EventBus { log: Vec<Event> }

impl EventBus {
    fn publish(&mut self, event_type: &str) -> Event {
        use std::time::{SystemTime, UNIX_EPOCH};
        let nanos = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
        let event = Event {
            id: format!("{:032x}", nanos),
            event_type: event_type.to_string(),
            payload: HashMap::new(),
            timestamp: format!("{}", nanos),
        };
        self.log.push(event.clone());
        event
    }
    fn log_size(&self) -> usize { self.log.len() }
}

#[derive(Clone)]
struct {{pascalCase name}}Server { bus: Arc<Mutex<EventBus>> }

impl ServerHandler for {{pascalCase name}}Server {
    fn get_info(&self) -> ServerInfo {
        ServerInfo {
            server_info: Implementation { name: "{{name}}".into(), version: "0.1.0".into() },
            capabilities: ServerCapabilities {
                tools: Some(ToolsCapability { list_changed: None }),
                ..Default::default()
            },
            instructions: Some("{{description}}".into()),
            ..Default::default()
        }
    }

    async fn list_tools(&self, _req: Option<PaginatedRequestParam>, _ctx: RequestContext<Arc<Self>>) -> std::result::Result<ListToolsResult, McpError> {
        Ok(ListToolsResult {
            tools: vec![
                {{#each tools}}
                Tool {
                    name: "{{name}}".into(),
                    description: Some("{{description}}".into()),
                    input_schema: Schema::default(),
                    annotations: None,
                },
                {{/each}}
                {{#unless tools}}
                Tool {
                    name: "emit_event".into(),
                    description: Some("Emit an event".into()),
                    input_schema: Schema {
                        schema: serde_json::json!({"type":"object","properties":{"event_type":{"type":"string"}},"required":["event_type"]}),
                    },
                    annotations: None,
                },
                {{/unless}}
            ],
            next_cursor: None,
        })
    }

    async fn call_tool(&self, req: CallToolRequestParam, _ctx: RequestContext<Arc<Self>>) -> std::result::Result<CallToolResult, McpError> {
        let mut bus = self.bus.lock().unwrap();
        let result = match req.name.as_str() {
            {{#each tools}}
            "{{name}}" => {
                let event = bus.publish("{{snakeCase ../name}}.{{snakeCase name}}");
                format!("emitted, id: {}", event.id)
            }
            {{/each}}
            {{#unless tools}}
            "emit_event" => {
                let event_type = req.arguments.and_then(|a| a.get("event_type")).and_then(|v| v.as_str()).unwrap_or("anonymous.event");
                let event = bus.publish(event_type);
                format!("emitted, id: {}", event.id)
            }
            {{/unless}}
            _ => return Err(McpError::invalid_request("unknown tool", None)),
        };
        Ok(CallToolResult {
            content: vec![Content::text(result)],
            structured_content: None,
            is_error: None,
        })
    }
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    eprintln!("[{{name}}] MCP server starting (event-driven, stdio)");
    let server = {{pascalCase name}}Server { bus: Arc::new(Mutex::new(EventBus::default())) };
    let transport = (stdin(), stdout());
    serve_server(server, transport).await?;
    Ok(())
}
'''

RUST_FACTORY_MAIN = r'''//! {{name}} — factory-pattern MCP server in Rust.
//! {{description}}

use rmcp::{
    ServerHandler, model::*,
    service::{RequestContext, serve_server},
};
use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use tokio::io::{stdin, stdout};

#[derive(Clone, Debug, serde::Serialize)]
struct Object {
    id: String,
    type_name: String,
    created_at: String,
}

#[derive(Default)]
struct Registry { data: HashMap<String, Vec<Object>> }

impl Registry {
    fn register(&mut self, type_name: &str) -> Object {
        use std::time::{SystemTime, UNIX_EPOCH};
        let nanos = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
        let obj = Object {
            id: format!("{:032x}", nanos),
            type_name: type_name.to_string(),
            created_at: format!("{}", nanos),
        };
        self.data.entry(type_name.to_string()).or_default().push(obj.clone());
        obj
    }
    fn list_count(&self, type_name: &str) -> usize {
        self.data.get(type_name).map(|v| v.len()).unwrap_or(0)
    }
}

#[derive(Clone)]
struct {{pascalCase name}}Server { registry: Arc<Mutex<Registry>> }

impl ServerHandler for {{pascalCase name}}Server {
    fn get_info(&self) -> ServerInfo {
        ServerInfo {
            server_info: Implementation { name: "{{name}}".into(), version: "0.1.0".into() },
            capabilities: ServerCapabilities {
                tools: Some(ToolsCapability { list_changed: None }),
                ..Default::default()
            },
            instructions: Some("{{description}}".into()),
            ..Default::default()
        }
    }

    async fn list_tools(&self, _req: Option<PaginatedRequestParam>, _ctx: RequestContext<Arc<Self>>) -> std::result::Result<ListToolsResult, McpError> {
        Ok(ListToolsResult {
            tools: vec![
                {{#each tools}}
                Tool { name: "create_{{name}}".into(), description: Some("Create a {{name}}. {{description}}".into()), input_schema: Schema::default(), annotations: None },
                Tool { name: "list_{{name}}".into(), description: Some("List {{name}} objects".into()), input_schema: Schema::default(), annotations: None },
                {{/each}}
                {{#unless tools}}
                Tool { name: "create_default".into(), description: Some("Create a default object".into()), input_schema: Schema::default(), annotations: None },
                Tool { name: "list_defaults".into(), description: Some("List default objects".into()), input_schema: Schema::default(), annotations: None },
                {{/unless}}
            ],
            next_cursor: None,
        })
    }

    async fn call_tool(&self, req: CallToolRequestParam, _ctx: RequestContext<Arc<Self>>) -> std::result::Result<CallToolResult, McpError> {
        let mut reg = self.registry.lock().unwrap();
        let result = match req.name.as_str() {
            {{#each tools}}
            "create_{{name}}" => { let obj = reg.register("{{name}}"); format!("created {{name}}, id: {}", obj.id) }
            "list_{{name}}" => format!("{} {{name}} objects", reg.list_count("{{name}}")),
            {{/each}}
            {{#unless tools}}
            "create_default" => { let obj = reg.register("default"); format!("created default, id: {}", obj.id) }
            "list_defaults" => format!("{} default objects", reg.list_count("default")),
            {{/unless}}
            _ => return Err(McpError::invalid_request("unknown tool", None)),
        };
        Ok(CallToolResult { content: vec![Content::text(result)], structured_content: None, is_error: None })
    }
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    eprintln!("[{{name}}] MCP server starting (factory pattern, stdio)");
    let server = {{pascalCase name}}Server { registry: Arc::new(Mutex::new(Registry::default())) };
    let transport = (stdin(), stdout());
    serve_server(server, transport).await?;
    Ok(())
}
'''

EVENT_STATES = """states:
  idle:
    description: "Server running, no pending events"
  event_received:
    description: "Event received, handlers executing"
    on_enter: [monitor.collect_metrics]
  projected:
    description: "Projection updated, ready for query"
    on_enter: [advisor.check_contracts]
  failed:
    description: "Handler raised error"
    on_enter: [advisor.collect_failure]
"""

EVENT_TRANSITIONS = """transitions:
  - from: idle
    to: event_received
    event: event.published
  - from: event_received
    to: projected
    event: handlers.executed
  - from: projected
    to: idle
    event: projection.committed
  - from: "*"
    to: failed
    event: "*.failed"
"""

FACTORY_STATES = """states:
  idle:
    description: "Awaiting factory invocation"
  creating:
    description: "Validating input + instantiating object"
  registered:
    description: "Object registered, ready to return"
    on_enter: [advisor.check_contracts]
  failed:
    description: "Validation or instantiation failed"
    on_enter: [advisor.collect_failure]
"""

FACTORY_TRANSITIONS = """transitions:
  - from: idle
    to: creating
    event: factory.invoke
  - from: creating
    to: registered
    event: validation.passed
  - from: creating
    to: failed
    event: validation.failed
  - from: registered
    to: idle
    event: object.returned
  - from: "*"
    to: failed
    event: "*.failed"
"""

def write(path, content):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    print(f"  wrote: {path.relative_to(TEMPLATES)}")

def main():
    print("== TypeScript Factory ==")
    write(TEMPLATES / "typescript-sdk/factory/package.json.hbs", TS_FACTORY_PACKAGE)
    write(TEMPLATES / "typescript-sdk/factory/src/index.ts.hbs", TS_FACTORY_INDEX)
    write(TEMPLATES / "typescript-sdk/factory/src/registry.ts.hbs", TS_FACTORY_REGISTRY)
    write(TEMPLATES / "typescript-sdk/factory/tests/registry.test.ts.hbs", TS_FACTORY_TESTS)
    write(TEMPLATES / "typescript-sdk/factory/.mcp/state/states.yaml", FACTORY_STATES)
    write(TEMPLATES / "typescript-sdk/factory/.mcp/state/transitions.yaml", FACTORY_TRANSITIONS)
    write(TEMPLATES / "typescript-sdk/factory/README.md.hbs", "# {{name}}\n\n> TypeScript / factory pattern\n\n{{description}}\n")

    print("== Go Event ==")
    write(TEMPLATES / "go-sdk/event/go.mod.hbs", GO_EVENT_MOD)
    write(TEMPLATES / "go-sdk/event/cmd/server/main.go.hbs", GO_EVENT_MAIN)
    write(TEMPLATES / "go-sdk/event/.mcp/state/states.yaml", EVENT_STATES)
    write(TEMPLATES / "go-sdk/event/.mcp/state/transitions.yaml", EVENT_TRANSITIONS)
    write(TEMPLATES / "go-sdk/event/README.md.hbs", "# {{name}}\n\n> Go / event-driven pattern\n\n{{description}}\n")

    print("== Go Factory ==")
    write(TEMPLATES / "go-sdk/factory/go.mod.hbs", GO_EVENT_MOD)
    write(TEMPLATES / "go-sdk/factory/cmd/server/main.go.hbs", GO_FACTORY_MAIN)
    write(TEMPLATES / "go-sdk/factory/.mcp/state/states.yaml", FACTORY_STATES)
    write(TEMPLATES / "go-sdk/factory/.mcp/state/transitions.yaml", FACTORY_TRANSITIONS)
    write(TEMPLATES / "go-sdk/factory/README.md.hbs", "# {{name}}\n\n> Go / factory pattern\n\n{{description}}\n")

    print("== Rust Event ==")
    write(TEMPLATES / "rust-sdk/event/Cargo.toml.hbs", RUST_CARGO)
    write(TEMPLATES / "rust-sdk/event/src/main.rs.hbs", RUST_EVENT_MAIN)
    write(TEMPLATES / "rust-sdk/event/.mcp/state/states.yaml", EVENT_STATES)
    write(TEMPLATES / "rust-sdk/event/.mcp/state/transitions.yaml", EVENT_TRANSITIONS)
    write(TEMPLATES / "rust-sdk/event/README.md.hbs", "# {{name}}\n\n> Rust / event-driven pattern\n\n{{description}}\n")

    print("== Rust Factory ==")
    write(TEMPLATES / "rust-sdk/factory/Cargo.toml.hbs", RUST_CARGO)
    write(TEMPLATES / "rust-sdk/factory/src/main.rs.hbs", RUST_FACTORY_MAIN)
    write(TEMPLATES / "rust-sdk/factory/.mcp/state/states.yaml", FACTORY_STATES)
    write(TEMPLATES / "rust-sdk/factory/.mcp/state/transitions.yaml", FACTORY_TRANSITIONS)
    write(TEMPLATES / "rust-sdk/factory/README.md.hbs", "# {{name}}\n\n> Rust / factory pattern\n\n{{description}}\n")

    print("\nDone.")

if __name__ == "__main__":
    main()
