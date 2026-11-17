"use client";

/**
 * Browser-side A2UI state: one MessageProcessor owns every surface the agent has
 * produced in this conversation. The React tree only reads from it, and the
 * processor's own signals push updates into the rendered surfaces.
 */

import type { SurfaceModel } from "@a2ui/web_core/v0_9";
import { MessageProcessor } from "@a2ui/web_core/v0_9";
import { appCatalog } from "./catalog";

export interface ActionPayloadLike {
  name: string;
  surfaceId: string;
  sourceComponentId: string;
  timestamp?: string;
  context?: Record<string, unknown>;
}

export interface A2uiLogEntry {
  readonly id: number;
  readonly at: number;
  readonly type: string;
  readonly surfaceId: string;
  readonly raw: unknown;
}

export class A2uiRuntime {
  processor!: MessageProcessor;
  private entries: A2uiLogEntry[] = [];
  private readonly listeners = new Set<() => void>();
  private nextLogId = 1;
  private revision = 0;

  constructor(private readonly onAction: (action: ActionPayloadLike) => void) {
    this.createProcessor();
    this.bump();
  }

  private createProcessor(): void {
    this.processor?.dispose();
    this.processor = new MessageProcessor([appCatalog], (action) => {
      this.onAction({
        name: action.name,
        surfaceId: action.surfaceId,
        sourceComponentId: action.sourceComponentId,
        timestamp: action.timestamp,
        context: action.context,
      });
    });
  }

  reset(): void {
    this.createProcessor();
    this.entries = [];
    this.bump();
  }

  clearLog(): void {
    this.entries = [];
    this.bump();
  }

  get log(): readonly A2uiLogEntry[] {
    return this.entries;
  }

  get version(): number {
    return this.revision;
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSurface(surfaceId: string): SurfaceModel | undefined {
    return this.processor.getSurface(surfaceId);
  }

  apply(messages: readonly unknown[]): void {
    for (const message of messages) {
      if (!message || typeof message !== "object") continue;
      const type = Object.keys(message as Record<string, unknown>).find((key) => key !== "version");
      const payload =
        type === undefined
          ? undefined
          : ((message as Record<string, Record<string, unknown>>)[type] ?? undefined);
      const surfaceId = String(payload?.surfaceId ?? "");

      // A second createSurface for a live surface would be rejected by the
      // processor. The model meant "draw it again", so treat it as an update.
      if (type === "createSurface" && surfaceId && this.processor.getSurface(surfaceId)) {
        continue;
      }

      this.entries.push({
        id: this.nextLogId++,
        at: Date.now(),
        type: type ?? "unknown",
        surfaceId,
        raw: message,
      });
      try {
        this.processor.processMessages([message] as never);
      } catch (error) {
        // One bad message must not take down the surfaces that already render.
        console.error("[a2ui] message processing failed", error);
      }
    }
    this.bump();
  }

  private bump(): void {
    this.revision += 1;
    for (const listener of this.listeners) listener();
  }
}
