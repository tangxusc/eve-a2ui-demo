/**
 * A2UI v0.9 wire format helpers shared by the eve tools and the browser runtime.
 *
 * The model authors an A2UI component list (the same adjacency list the protocol
 * uses). These helpers check it against the Basic Catalog before it reaches the
 * renderer: known component types, required properties, resolvable child ids and
 * a single `root`. Anything the model gets wrong comes back as an error the model
 * can fix on its next step, instead of a blank surface in the browser.
 */

export const A2UI_VERSION = "v0.9" as const;

export const CATALOG_ID = "https://eve-a2ui.demo/catalog/app.json";

export const SURFACE_THEME = {
  primaryColor: "#4f46e5",
  agentDisplayName: "eve × A2UI",
} as const;

type A2uiMessage = Record<string, unknown>;

export interface ComponentSpec {
  required: readonly string[];
  optional: readonly string[];
  /** Properties that reference other component ids. */
  children?: readonly string[];
  /** Properties holding a list of child component ids. */
  childLists?: readonly string[];
  /** Properties holding `{ title, child }` entries. */
  tabLists?: boolean;
}

export const COMPONENT_SPECS: Record<string, ComponentSpec> = {
  Text: { required: ["text"], optional: ["variant"] },
  Image: { required: ["url"], optional: ["description", "fit", "variant"] },
  Icon: { required: ["name"], optional: [] },
  Video: { required: ["url"], optional: [] },
  AudioPlayer: { required: ["url"], optional: ["description"] },
  Row: {
    required: ["children"],
    optional: ["justify", "align"],
    childLists: ["children"],
  },
  Column: {
    required: ["children"],
    optional: ["justify", "align"],
    childLists: ["children"],
  },
  List: {
    required: ["children"],
    optional: ["direction", "align"],
    childLists: ["children"],
  },
  Card: { required: ["child"], optional: [], children: ["child"] },
  Tabs: { required: ["tabs"], optional: [], tabLists: true },
  Modal: {
    required: ["trigger", "content"],
    optional: [],
    children: ["trigger", "content"],
  },
  Divider: { required: [], optional: ["axis"] },
  Button: {
    required: ["child", "action"],
    optional: ["variant"],
    children: ["child"],
  },
  TextField: {
    required: ["label"],
    optional: ["value", "variant", "validationRegexp", "checks"],
  },
  CheckBox: { required: ["label", "value"], optional: ["checks"] },
  ChoicePicker: {
    required: ["options", "value"],
    optional: ["label", "variant", "displayStyle", "filterable", "checks"],
  },
  Slider: { required: ["value", "max"], optional: ["min", "label"] },
  DateTimeInput: {
    required: ["value"],
    optional: ["enableDate", "enableTime", "min", "max", "label"],
  },
};

export const COMPONENT_NAMES = Object.keys(COMPONENT_SPECS);

export interface RawComponent {
  readonly id?: unknown;
  readonly component?: unknown;
  readonly [key: string]: unknown;
}

export interface SurfaceDraft {
  readonly surfaceId: string;
  readonly components: readonly RawComponent[];
  readonly data?: Record<string, unknown>;
}

export type BuildResult =
  | { readonly ok: true; readonly messages: A2uiMessage[]; readonly warnings: string[] }
  | { readonly ok: false; readonly errors: string[] };

interface NormalizedComponent {
  id: string;
  component: string;
  props: Record<string, unknown>;
}

const ID_PATTERN = /^[A-Za-z][A-Za-z0-9_-]*$/;
const MAX_COMPONENTS = 80;

export function sanitizeSurfaceId(raw: string): string {
  const cleaned = raw
    .trim()
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
  return cleaned.length > 0 ? cleaned.slice(0, 60) : "surface";
}

export function buildCreateMessages(draft: SurfaceDraft): BuildResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const surfaceId = sanitizeSurfaceId(String(draft.surfaceId ?? ""));
  const components = normalizeComponents(draft.components, errors, warnings);

  if (components.length === 0) {
    errors.push("components 不能为空：至少需要一个组件，且包含一个 id 为 root 的组件。");
    return { ok: false, errors };
  }
  if (components.length > MAX_COMPONENTS) {
    errors.push(`组件数量 ${components.length} 超过上限 ${MAX_COMPONENTS}，请拆分成更小的界面。`);
  }

  const byId = new Map(components.map((component) => [component.id, component]));
  ensureRoot(components, byId, errors, warnings);
  pruneUnreachable(components, byId, errors, warnings);

  if (errors.length > 0) return { ok: false, errors };

  const finalComponents = components.filter((component) => byId.has(component.id));
  const messages: A2uiMessage[] = [
    {
      version: A2UI_VERSION,
      createSurface: { surfaceId, catalogId: CATALOG_ID, theme: SURFACE_THEME },
    },
    {
      version: A2UI_VERSION,
      updateComponents: { surfaceId, components: finalComponents.map(toWire) },
    },
  ];
  if (draft.data && Object.keys(draft.data).length > 0) {
    messages.push({
      version: A2UI_VERSION,
      updateDataModel: { surfaceId, path: "/", value: draft.data },
    });
  }
  return { ok: true, messages, warnings };
}

export function buildUpdateMessages(draft: SurfaceDraft): BuildResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const surfaceId = sanitizeSurfaceId(String(draft.surfaceId ?? ""));
  // A patch may point at components the surface already holds, so references are
  // checked for shape only, not for presence in this batch.
  const components = normalizeComponents(draft.components ?? [], errors, warnings, false);

  if (components.length === 0 && !draft.data) {
    errors.push("update_ui 至少要给 components 或 data 之一。");
  }
  if (components.length > 0 && !components.some((component) => component.id === "root")) {
    // A patch may leave the root untouched, so only check that it does not
    // introduce a second tree.
    warnings.push("本次更新没有包含 root 组件，按局部更新处理。");
  }
  if (errors.length > 0) return { ok: false, errors };

  const messages: A2uiMessage[] = [];
  if (components.length > 0) {
    messages.push({
      version: A2UI_VERSION,
      updateComponents: { surfaceId, components: components.map(toWire) },
    });
  }
  if (draft.data) {
    messages.push({
      version: A2UI_VERSION,
      updateDataModel: { surfaceId, path: "/", value: draft.data },
    });
  }
  return { ok: true, messages, warnings };
}

function normalizeComponents(
  raw: readonly RawComponent[],
  errors: string[],
  warnings: string[],
  validateReferences = true,
): NormalizedComponent[] {
  const seen = new Set<string>();
  const result: NormalizedComponent[] = [];

  for (const [index, entry] of raw.entries()) {
    if (entry === null || typeof entry !== "object") {
      errors.push(`components[${index}] 不是对象。`);
      continue;
    }
    const id = typeof entry.id === "string" ? entry.id.trim() : "";
    if (!id || !ID_PATTERN.test(id)) {
      errors.push(
        `components[${index}].id 必须是字母开头的标识符（字母/数字/下划线/连字符），收到 ${JSON.stringify(entry.id)}。`,
      );
      continue;
    }
    if (seen.has(id)) {
      errors.push(`组件 id "${id}" 重复，每个 id 只能出现一次。`);
      continue;
    }
    seen.add(id);

    const componentName = typeof entry.component === "string" ? entry.component : "";
    const spec = COMPONENT_SPECS[componentName];
    if (!spec) {
      errors.push(
        `"${id}" 的 component "${componentName}" 不在 Basic Catalog 中。可用组件：${COMPONENT_NAMES.join("、")}。`,
      );
      continue;
    }

    const props: Record<string, unknown> = {};
    const dropped: string[] = [];
    for (const [key, value] of Object.entries(entry)) {
      if (key === "id" || key === "component") continue;
      if (spec.required.includes(key) || spec.optional.includes(key) || key === "accessibility") {
        props[key] = value;
      } else {
        dropped.push(key);
      }
    }
    if (dropped.length > 0) {
      warnings.push(`"${id}" 上的 ${dropped.join("、")} 不是 ${componentName} 的属性，已忽略。`);
    }
    for (const required of spec.required) {
      if (props[required] === undefined || props[required] === null) {
        errors.push(`"${id}"（${componentName}）缺少必填属性 ${required}。`);
      }
    }
    result.push({ id, component: componentName, props });
  }

  validateChildReferences(result, errors, validateReferences);
  return result;
}

function validateChildReferences(
  components: NormalizedComponent[],
  errors: string[],
  checkPresence: boolean,
): void {
  const ids = new Set(components.map((component) => component.id));
  for (const component of components) {
    const spec = COMPONENT_SPECS[component.component];
    for (const key of spec.children ?? []) {
      const value = component.props[key];
      if (value === undefined) continue;
      if (typeof value !== "string" || (checkPresence && !ids.has(value))) {
        errors.push(
          `"${component.id}".${key} 必须引用同一批组件里的 id，收到 ${JSON.stringify(value)}。`,
        );
      }
    }
    for (const key of spec.childLists ?? []) {
      const value = component.props[key];
      if (value === undefined) continue;
      if (Array.isArray(value)) {
        for (const childId of value) {
          if (typeof childId !== "string" || (checkPresence && !ids.has(childId))) {
            errors.push(
              `"${component.id}".${key} 里的 ${JSON.stringify(childId)} 不是这批组件里的 id。`,
            );
          }
        }
      } else if (
        typeof value !== "object" ||
        value === null ||
        typeof (value as { componentId?: unknown }).componentId !== "string"
      ) {
        errors.push(
          `"${component.id}".${key} 必须是 id 数组，或 {componentId, path} 模板对象。`,
        );
      }
    }
    if (spec.tabLists) {
      const tabs = component.props.tabs;
      if (!Array.isArray(tabs)) {
        errors.push(`"${component.id}".tabs 必须是数组。`);
      } else {
        for (const tab of tabs) {
          const child = (tab as { child?: unknown })?.child;
          if (typeof child !== "string" || (checkPresence && !ids.has(child))) {
            errors.push(`"${component.id}".tabs 中的 child 必须引用这批组件里的 id。`);
          }
        }
      }
    }
  }
}

function ensureRoot(
  components: NormalizedComponent[],
  byId: Map<string, NormalizedComponent>,
  errors: string[],
  warnings: string[],
): void {
  if (byId.has("root")) return;

  const referenced = new Set<string>();
  for (const component of components) {
    const spec = COMPONENT_SPECS[component.component];
    for (const key of spec.children ?? []) {
      const value = component.props[key];
      if (typeof value === "string") referenced.add(value);
    }
    for (const key of spec.childLists ?? []) {
      const value = component.props[key];
      if (Array.isArray(value)) {
        for (const childId of value) if (typeof childId === "string") referenced.add(childId);
      }
    }
    if (spec.tabLists && Array.isArray(component.props.tabs)) {
      for (const tab of component.props.tabs) {
        const child = (tab as { child?: unknown })?.child;
        if (typeof child === "string") referenced.add(child);
      }
    }
  }

  const candidates = components.filter((component) => !referenced.has(component.id));
  if (candidates.length !== 1) {
    errors.push(
      candidates.length === 0
        ? "没有根组件：组件之间形成了环。请给出一个 id 为 root 的顶层容器。"
        : `存在 ${candidates.length} 个顶层组件（${candidates.map((c) => c.id).join("、")}），请用一个 id 为 root 的容器包住它们。`,
    );
    return;
  }

  const root = candidates[0];
  const previous = root.id;
  root.id = "root";
  byId.delete(previous);
  byId.set("root", root);
  for (const component of components) {
    const spec = COMPONENT_SPECS[component.component];
    for (const key of spec.children ?? []) {
      if (component.props[key] === previous) component.props[key] = "root";
    }
    for (const key of spec.childLists ?? []) {
      const value = component.props[key];
      if (Array.isArray(value)) {
        component.props[key] = value.map((childId) => (childId === previous ? "root" : childId));
      }
    }
    if (spec.tabLists && Array.isArray(component.props.tabs)) {
      component.props.tabs = component.props.tabs.map((tab) => {
        const entry = tab as { child?: unknown };
        return entry.child === previous ? { ...entry, child: "root" } : tab;
      });
    }
  }
  warnings.push(`没有 root 组件，已把顶层组件 "${previous}" 重命名为 root。`);
}

function pruneUnreachable(
  components: NormalizedComponent[],
  byId: Map<string, NormalizedComponent>,
  errors: string[],
  warnings: string[],
): void {
  const reachable = new Set<string>();
  const queue = ["root"];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (reachable.has(current)) continue;
    reachable.add(current);
    const component = byId.get(current);
    if (!component) {
      errors.push(`组件树引用了不存在的 "${current}"。`);
      continue;
    }
    const spec = COMPONENT_SPECS[component.component];
    for (const key of spec.children ?? []) {
      const value = component.props[key];
      if (typeof value === "string") queue.push(value);
    }
    for (const key of spec.childLists ?? []) {
      const value = component.props[key];
      if (Array.isArray(value)) {
        for (const childId of value) if (typeof childId === "string") queue.push(childId);
      } else if (value && typeof value === "object") {
        const templateId = (value as { componentId?: unknown }).componentId;
        if (typeof templateId === "string") queue.push(templateId);
      }
    }
    if (spec.tabLists && Array.isArray(component.props.tabs)) {
      for (const tab of component.props.tabs) {
        const child = (tab as { child?: unknown })?.child;
        if (typeof child === "string") queue.push(child);
      }
    }
  }

  const orphans = components.filter((component) => !reachable.has(component.id));
  if (orphans.length > 0) {
    for (const orphan of orphans) byId.delete(orphan.id);
    warnings.push(
      `以下组件从 root 不可达，已丢弃：${orphans.map((orphan) => orphan.id).join("、")}。`,
    );
  }
}

function toWire(component: NormalizedComponent): Record<string, unknown> {
  return { id: component.id, component: component.component, ...component.props };
}
