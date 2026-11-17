"use client";

import { A2uiSurface } from "@a2ui/react/v0_9";
import type { ComponentProps } from "react";
import type { A2uiLogEntry, A2uiRuntime } from "@/lib/a2ui/runtime";

type SurfaceHandle = ComponentProps<typeof A2uiSurface>["surface"];

export function SurfaceCard({
  runtime,
  surfaceId,
  revision,
}: {
  readonly runtime: A2uiRuntime;
  readonly surfaceId: string;
  readonly revision: number;
}) {
  // `revision` is read so a surface created or deleted elsewhere in the tree
  // re-renders this card; component and data updates flow through the
  // renderer's own signals.
  void revision;
  const surface = runtime.getSurface(surfaceId) as unknown as SurfaceHandle | undefined;

  return (
    <section className="surface-card" data-testid="a2ui-surface" data-surface-id={surfaceId}>
      <header className="surface-head">
        <div className="surface-head-left">
          <span className="badge-a2ui">A2UI</span>
          <span className="surface-id">{surfaceId}</span>
        </div>
        <span>v0.9 · App Catalog</span>
      </header>
      <div className="surface-body">
        {surface ? (
          <div className="a2ui-surface">
            <A2uiSurface surface={surface} />
          </div>
        ) : (
          <div className="surface-pending">界面正在同步…</div>
        )}
      </div>
    </section>
  );
}

export function UpdateChip({ surfaceId }: { readonly surfaceId: string }) {
  return (
    <div className="update-chip" data-testid="surface-updated">
      <span>界面已更新</span>
      <span>· {surfaceId}</span>
    </div>
  );
}

export function ProtocolPanel({
  entries,
  onClear,
}: {
  readonly entries: readonly A2uiLogEntry[];
  readonly onClear: () => void;
}) {
  return (
    <aside className="protocol" data-testid="protocol-panel">
      <header className="protocol-head">
        <div className="protocol-title">
          A2UI 协议流
          <span className="protocol-count" data-testid="protocol-count">
            {entries.length}
          </span>
        </div>
        <button className="ghost-button" onClick={onClear} type="button">
          清空
        </button>
      </header>
      <div className="protocol-body">
        {entries.length === 0 ? (
          <p className="protocol-empty">
            模型还没有发出界面消息。
            <br />
            发一条「画一个下单界面」试试。
          </p>
        ) : (
          entries.map((entry) => (
            <details className="protocol-entry" data-testid="protocol-entry" key={entry.id}>
              <summary>
                <span className="msg-badge" data-type={entry.type}>
                  {entry.type}
                </span>
                <span className="protocol-surface">{entry.surfaceId || "—"}</span>
              </summary>
              <pre className="protocol-json">{JSON.stringify(entry.raw, null, 2)}</pre>
            </details>
          ))
        )}
      </div>
      <footer className="protocol-foot">
        这些 JSON 就是模型经 eve 工具调用产出的原始消息，浏览器用 @a2ui/react 渲染成上面的组件。
      </footer>
    </aside>
  );
}
