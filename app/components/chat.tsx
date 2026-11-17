"use client";

import { useEveAgent } from "eve/react";
import type { EveMessage, EveMessagePart } from "eve/react";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { A2uiRuntime, type ActionPayloadLike } from "@/lib/a2ui/runtime";
import { ProtocolPanel, SurfaceCard, UpdateChip } from "./a2ui-view";

const EXAMPLES = [
  {
    title: "咖啡下单",
    prompt: "画一个手冲咖啡下单界面：杯型、加奶、备注，底部取消和下单按钮。",
  },
  {
    title: "项目看板",
    prompt: "做一个本周项目进度看板：三个指标、任务列表、一个「生成周报」按钮。",
  },
  {
    title: "航班值机",
    prompt: "生成一个航班值机确认页：乘客信息、座位选择、行李额，可以确认值机。",
  },
  {
    title: "SaaS 定价",
    prompt: "给我一个 SaaS 定价页，三档套餐并排，能切换年付/月付并选中一档。",
  },
] as const;

interface ToolOutput {
  readonly operation?: "create" | "update";
  readonly surfaceId?: string;
  readonly messages?: readonly unknown[];
  readonly warnings?: readonly string[];
}

const ACTION_PATTERN = /^<a2ui_action>([\s\S]*)<\/a2ui_action>$/;

function formatActionMessage(action: ActionPayloadLike): string {
  return `<a2ui_action>${JSON.stringify({
    name: action.name,
    surfaceId: action.surfaceId,
    sourceComponentId: action.sourceComponentId,
    timestamp: action.timestamp ?? new Date().toISOString(),
    context: action.context ?? {},
  })}</a2ui_action>`;
}

function parseActionMessage(text: string): ActionPayloadLike | null {
  const match = ACTION_PATTERN.exec(text.trim());
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]) as ActionPayloadLike;
    return typeof parsed?.name === "string" ? parsed : null;
  } catch {
    return null;
  }
}

function textOf(message: EveMessage): string {
  return message.parts
    .filter((part): part is Extract<EveMessagePart, { type: "text" }> => part.type === "text")
    .map((part) => part.text)
    .join("")
    .trim();
}

export function Chat() {
  const agent = useEveAgent();
  const [draft, setDraft] = useState("");
  const sendRef = useRef<(text: string) => void>(() => {});
  const [runtime] = useState(
    () => new A2uiRuntime((action) => sendRef.current(formatActionMessage(action))),
  );
  const revision = useSyncExternalStore(
    runtime.subscribe,
    () => runtime.version,
    () => 0,
  );
  const applied = useRef(new Set<string>());
  const threadRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    sendRef.current = (text: string) => {
      void agent.send(text);
    };
  }, [agent]);

  useEffect(() => {
    for (const message of agent.messages) {
      for (const part of message.parts) {
        if (part.type !== "tool") continue;
        if (part.name !== "render_ui" && part.name !== "update_ui") continue;
        if (part.state !== "completed") continue;
        if (applied.current.has(part.callId)) continue;
        const output = part.output as ToolOutput | undefined;
        if (!output?.surfaceId || !Array.isArray(output.messages)) continue;
        applied.current.add(part.callId);
        runtime.apply(output.messages);
      }
    }
  }, [agent.messages, runtime]);

  useEffect(() => {
    const thread = threadRef.current;
    if (!thread) return;
    thread.scrollTop = thread.scrollHeight;
  }, [agent.messages, agent.status, revision]);

  // Which message first created which surface. Computed in one pass so a
  // re-render can't hand the same surface to two messages.
  const surfacesByMessage = useMemo(() => {
    const owners = new Map<string, string[]>();
    const seen = new Set<string>();
    for (const message of agent.messages) {
      const surfaceIds: string[] = [];
      if (message.role === "assistant") {
        for (const part of message.parts) {
          if (part.type !== "tool" || part.name !== "render_ui" || part.state !== "completed") {
            continue;
          }
          const output = part.output as ToolOutput | undefined;
          if (!output?.surfaceId || seen.has(output.surfaceId)) continue;
          seen.add(output.surfaceId);
          surfaceIds.push(output.surfaceId);
        }
      }
      owners.set(message.id, surfaceIds);
    }
    return owners;
  }, [agent.messages]);

  const busy = agent.status === "busy";
  const resuming = agent.status === "resuming";
  const lastMessage = agent.messages.at(-1);
  const waitingForFirstPart =
    busy &&
    (lastMessage === undefined || lastMessage.role === "user" || lastMessage.parts.length === 0);

  const submit = (value: string) => {
    const text = value.trim();
    if (text.length === 0 || resuming) return;
    setDraft("");
    void agent.send(text);
  };

  const resetConversation = () => {
    agent.newSession();
    runtime.reset();
    applied.current.clear();
  };

  return (
    <div className="shell">
      <header className="topbar" data-testid="app-header">
        <div className="brand">
          <div className="brand-mark">A2</div>
          <div className="brand-title">
            eve × A2UI
            <span>Vercel eve agent · A2UI v0.9 · deepseek-v4-flash</span>
          </div>
        </div>
        <div className="topbar-actions">
          <span className="status-pill" data-busy={busy} data-testid="agent-status">
            <i className="status-dot" />
            <span className="status-text">
              {resuming ? "恢复会话" : busy ? "生成中" : "就绪"}
            </span>
          </span>
          <button className="ghost-button" onClick={resetConversation} type="button">
            新对话
          </button>
        </div>
      </header>

      <main className="main">
        <div className="chat">
          <div className="thread" ref={threadRef} data-testid="thread">
            {agent.messages.length === 0 ? (
              <section className="hero">
                <span className="hero-eyebrow">Agent 直接产出界面</span>
                <h1>让 Agent 画界面，而不是写字</h1>
                <p>
                  模型通过工具调用产出 A2UI 消息，浏览器用官方 React 渲染器画成原生组件。
                  界面里的按钮会把动作传回 Agent，界面随数据模型原地更新。
                </p>
                <div className="examples">
                  {EXAMPLES.map((example) => (
                    <button
                      className="example"
                      data-testid="example-prompt"
                      key={example.title}
                      onClick={() => submit(example.prompt)}
                      type="button"
                    >
                      <strong>{example.title}</strong>
                      <span>{example.prompt}</span>
                    </button>
                  ))}
                </div>
              </section>
            ) : (
              agent.messages.map((message) => (
                <MessageRow
                  key={message.id}
                  message={message}
                  runtime={runtime}
                  revision={revision}
                  surfaceIds={surfacesByMessage.get(message.id) ?? []}
                />
              ))
            )}

            {waitingForFirstPart ? (
              <div className="message message-agent" data-testid="agent-activity">
                <div className="avatar">eve</div>
                <div className="message-body">
                  <div className="agent-name">agent</div>
                  <div className="activity">
                    <span className="dots">
                      <i />
                      <i />
                      <i />
                    </span>
                    正在理解需求…
                  </div>
                </div>
              </div>
            ) : null}

            {agent.error ? (
              <div className="error-box" data-testid="agent-error">
                {agent.error.message}
              </div>
            ) : null}
          </div>

          <div className="composer-wrap">
            <form
              className="composer"
              onSubmit={(event) => {
                event.preventDefault();
                submit(draft);
              }}
            >
              <textarea
                data-testid="composer-input"
                disabled={resuming}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    submit(draft);
                  }
                }}
                placeholder="描述你想要的界面，例如：画一个外卖订单确认页"
                rows={1}
                value={draft}
              />
              <button
                className="send-button"
                data-testid="composer-send"
                disabled={draft.trim().length === 0 || resuming}
                type="submit"
                aria-label="发送"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                  <path
                    d="M8 13V3M8 3L3.5 7.5M8 3l4.5 4.5"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </form>
            <p className="composer-hint">Enter 发送 · Shift + Enter 换行</p>
          </div>
        </div>

        <ProtocolPanel entries={runtime.log} onClear={() => runtime.clearLog()} />
      </main>
    </div>
  );
}

type Block =
  | { kind: "update"; surfaceId: string; key: string }
  | { kind: "failed"; message: string; key: string };

function MessageRow({
  message,
  runtime,
  revision,
  surfaceIds,
}: {
  readonly message: EveMessage;
  readonly runtime: A2uiRuntime;
  readonly revision: number;
  readonly surfaceIds: readonly string[];
}) {
  if (message.role === "user") {
    const text = textOf(message);
    if (text.length === 0) return null;
    const action = parseActionMessage(text);
    if (action) {
      return (
        <div className="message message-user" data-testid="action-chip">
          <div className="action-chip">
            <span>点击了界面按钮</span>
            <code>{action.name}</code>
          </div>
        </div>
      );
    }
    return (
      <div className="message message-user">
        <div className="bubble-user" data-testid="user-message">
          {text}
        </div>
      </div>
    );
  }

  const text = textOf(message);
  const updates: Block[] = [];
  for (const part of message.parts) {
    if (part.type !== "tool") continue;
    if (part.name !== "render_ui" && part.name !== "update_ui") continue;
    if (part.state === "failed") {
      updates.push({
        kind: "failed",
        message: part.error?.message ?? "界面生成失败",
        key: part.callId,
      });
      continue;
    }
    if (part.state !== "completed") continue;
    const output = part.output as ToolOutput | undefined;
    if (output?.operation === "update" && output.surfaceId) {
      updates.push({ kind: "update", surfaceId: output.surfaceId, key: part.callId });
    }
  }

  if (text.length === 0 && updates.length === 0 && surfaceIds.length === 0) return null;

  return (
    <div className="message message-agent" data-testid="assistant-message">
      <div className="avatar">eve</div>
      <div className="message-body">
        <div className="agent-name">agent</div>
        {text.length > 0 ? (
          <p className="agent-text" data-testid="assistant-text">
            {text}
          </p>
        ) : null}
        {surfaceIds.map((surfaceId) => (
          <SurfaceCard
            key={surfaceId}
            revision={revision}
            runtime={runtime}
            surfaceId={surfaceId}
          />
        ))}
        {updates.map((block) =>
          block.kind === "update" ? (
            <UpdateChip key={block.key} surfaceId={block.surfaceId} />
          ) : (
            <div className="error-box" key={block.key}>
              {block.message}
            </div>
          ),
        )}
      </div>
    </div>
  );
}
