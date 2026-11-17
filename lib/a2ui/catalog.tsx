"use client";

/**
 * The demo's component catalog.
 *
 * Component names, prop schemas and child references come from the A2UI v0.9
 * Basic Catalog. Only the rendering is ours, so surfaces use the app's design
 * system and the agent keeps speaking standard A2UI.
 */

import {
  createComponentImplementation,
  type ReactA2uiComponentProps,
} from "@a2ui/react/v0_9";
import { Catalog } from "@a2ui/web_core/v0_9";
import type { ComponentApi } from "@a2ui/web_core/v0_9";
import {
  AudioPlayerApi,
  ButtonApi,
  CardApi,
  CheckBoxApi,
  ChoicePickerApi,
  ColumnApi,
  DateTimeInputApi,
  DividerApi,
  IconApi,
  ImageApi,
  ListApi,
  ModalApi,
  RowApi,
  SliderApi,
  TabsApi,
  TextApi,
  TextFieldApi,
  VideoApi,
} from "@a2ui/web_core/v0_9/basic_catalog";
import { CATALOG_ID } from "./protocol";
import { Fragment, useId, useState, type CSSProperties, type ReactNode } from "react";

type Props = Record<string, unknown>;
type ViewProps = ReactA2uiComponentProps<Props>;

function impl(api: ComponentApi, view: (props: ViewProps) => ReactNode) {
  return createComponentImplementation(api, view as never);
}

function text(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function renderChild(value: unknown, buildChild: ViewProps["buildChild"], key?: string): ReactNode {
  if (typeof value === "string") return <Fragment key={key}>{buildChild(value)}</Fragment>;
  if (value && typeof value === "object") {
    const candidate = value as { id?: unknown };
    if (typeof candidate.id === "string") {
      return <Fragment key={key}>{buildChild(candidate as never)}</Fragment>;
    }
  }
  return null;
}

function renderChildren(value: unknown, buildChild: ViewProps["buildChild"]): ReactNode[] {
  if (Array.isArray(value)) {
    return value.map((child, index) => renderChild(child, buildChild, String(index)));
  }
  if (value && typeof value === "object" && typeof (value as { id?: unknown }).id === "string") {
    return [renderChild(value, buildChild, "0")];
  }
  return [];
}

function childrenKey(children: ReactNode[]): ReactNode[] {
  return children.map((child, index) => <Fragment key={index}>{child}</Fragment>);
}

/** The raw property, still holding its `{ path }` binding when one was declared. */
function rawProp(context: ViewProps["context"], key: string): unknown {
  return (context.componentModel.properties as Record<string, unknown> | undefined)?.[key];
}

function boundPath(context: ViewProps["context"], key: string): string | undefined {
  const raw = rawProp(context, key);
  if (raw && typeof raw === "object" && typeof (raw as { path?: unknown }).path === "string") {
    return (raw as { path: string }).path;
  }
  return undefined;
}

function writeBound(context: ViewProps["context"], key: string, value: unknown): void {
  const path = boundPath(context, key);
  if (path) context.dataContext.set(path, value);
}

const justifyClass: Record<string, string> = {
  start: "a2-justify-start",
  center: "a2-justify-center",
  end: "a2-justify-end",
  spaceBetween: "a2-justify-between",
  spaceAround: "a2-justify-around",
  spaceEvenly: "a2-justify-evenly",
  stretch: "a2-justify-stretch",
};

const alignClass: Record<string, string> = {
  start: "a2-align-start",
  center: "a2-align-center",
  end: "a2-align-end",
  stretch: "a2-align-stretch",
};

const TextComponent = impl(
  TextApi,
  ({ props }: ViewProps) => {
    const variant = text(props.variant) || "body";
    const content = text(props.text);
    const Tag = (["h1", "h2", "h3", "h4", "h5"].includes(variant) ? variant : "p") as
      | "h1"
      | "h2"
      | "h3"
      | "h4"
      | "h5"
      | "p";
    if (variant === "caption") return <p className="a2-text a2-caption">{content}</p>;
    return <Tag className={`a2-text a2-${variant}`}>{content}</Tag>;
  },
);

const CardComponent = impl(
  CardApi,
  ({ props, buildChild }: ViewProps) => (
    <section className="a2-card">{renderChild(props.child, buildChild, "child")}</section>
  ),
);

const ColumnComponent = impl(
  ColumnApi,
  ({ props, buildChild }: ViewProps) => (
    <div
      className={`a2-col ${justifyClass[text(props.justify)] ?? "a2-justify-start"} ${
        alignClass[text(props.align)] ?? "a2-align-stretch"
      }`}
    >
      {childrenKey(renderChildren(props.children, buildChild))}
    </div>
  ),
);

const RowComponent = impl(
  RowApi,
  ({ props, buildChild }: ViewProps) => (
    <div
      className={`a2-row ${justifyClass[text(props.justify)] ?? "a2-justify-start"} ${
        alignClass[text(props.align)] ?? "a2-align-center"
      }`}
    >
      {childrenKey(renderChildren(props.children, buildChild))}
    </div>
  ),
);

const ListComponent = impl(
  ListApi,
  ({ props, buildChild }: ViewProps) => (
    <ul className={`a2-list ${text(props.direction) === "horizontal" ? "a2-list-horizontal" : ""}`}>
      {childrenKey(renderChildren(props.children, buildChild))}
    </ul>
  ),
);

const DividerComponent = impl(
  DividerApi,
  ({ props }: ViewProps) => <hr className={`a2-divider ${text(props.axis) === "vertical" ? "a2-divider-v" : ""}`} />,
);

const ButtonComponent = impl(
  ButtonApi,
  ({ props, buildChild }: ViewProps) => {
    const variant = text(props.variant) || "default";
    const action = props.action as unknown;
    return (
      <button
        className={`a2-button a2-button-${variant}`}
        data-testid="a2ui-button"
        onClick={() => {
          if (typeof action === "function") void (action as () => unknown)();
          else if (action && typeof action === "object") void action;
        }}
        type="button"
      >
        {renderChild(props.child, buildChild, "label")}
      </button>
    );
  },
);

const TextFieldComponent = impl(
  TextFieldApi,
  ({ props, context }: ViewProps) => {
    const label = text(props.label);
    const value = text(props.value);
    const variant = text(props.variant) || "shortText";
    const id = useId();
    const common = {
      id,
      className: "a2-input",
      value,
      "data-testid": "a2ui-text-field",
      onChange: (event: { target: { value: string } }) =>
        writeBound(context, "value", event.target.value),
    };
    return (
      <div className="a2-field">
        {label ? (
          <label className="a2-label" htmlFor={id}>
            {label}
          </label>
        ) : null}
        {variant === "longText" ? (
          <textarea {...common} rows={3} />
        ) : (
          <input
            {...common}
            inputMode={variant === "number" ? "decimal" : undefined}
            type={variant === "obscured" ? "password" : "text"}
          />
        )}
      </div>
    );
  },
);

const CheckBoxComponent = impl(
  CheckBoxApi,
  ({ props, context }: ViewProps) => {
    const checked = props.value === true;
    return (
      <label className="a2-check">
        <input
          checked={checked}
          data-testid="a2ui-checkbox"
          onChange={(event) => writeBound(context, "value", event.target.checked)}
          type="checkbox"
        />
        <span className="a2-check-box" aria-hidden />
        <span className="a2-check-label">{text(props.label)}</span>
      </label>
    );
  },
);

const ChoicePickerComponent = impl(
  ChoicePickerApi,
  ({ props, context }: ViewProps) => {
    const multiple = text(props.variant) === "multipleSelection";
    const selected = Array.isArray(props.value) ? props.value.map((entry) => text(entry)) : [];
    const options = Array.isArray(props.options)
      ? (props.options as Array<{ label?: unknown; value?: unknown }>)
      : [];
    const toggle = (optionValue: string) => {
      if (multiple) {
        const next = selected.includes(optionValue)
          ? selected.filter((entry) => entry !== optionValue)
          : [...selected, optionValue];
        writeBound(context, "value", next);
        return;
      }
      writeBound(context, "value", [optionValue]);
    };
    const chips = text(props.displayStyle) === "chips";
    return (
      <div className="a2-field">
        {text(props.label) ? <span className="a2-label">{text(props.label)}</span> : null}
        <div className={chips ? "a2-chips" : "a2-options"} role="group">
          {options.map((option, index) => {
            const optionValue = text(option?.value);
            const active = selected.includes(optionValue);
            return (
              <button
                key={`${optionValue}-${index}`}
                aria-pressed={active}
                className={chips ? `a2-chip ${active ? "is-active" : ""}` : `a2-option ${active ? "is-active" : ""}`}
                data-testid="a2ui-choice"
                onClick={() => toggle(optionValue)}
                type="button"
              >
                {!chips ? <span className={multiple ? "a2-box" : "a2-radio"} aria-hidden /> : null}
                {text(option?.label)}
              </button>
            );
          })}
        </div>
      </div>
    );
  },
);

const SliderComponent = impl(
  SliderApi,
  ({ props, context }: ViewProps) => {
    const min = typeof props.min === "number" ? props.min : 0;
    const max = typeof props.max === "number" ? props.max : 100;
    const value = typeof props.value === "number" ? props.value : min;
    return (
      <div className="a2-field">
        <div className="a2-slider-head">
          <span className="a2-label">{text(props.label)}</span>
          <span className="a2-slider-value">{value}</span>
        </div>
        <input
          className="a2-slider"
          max={max}
          min={min}
          onChange={(event) => writeBound(context, "value", Number(event.target.value))}
          type="range"
          value={value}
        />
      </div>
    );
  },
);

const DateTimeInputComponent = impl(
  DateTimeInputApi,
  ({ props, context }: ViewProps) => {
    const value = text(props.value);
    const withTime = props.enableTime === true;
    const type = props.enableDate === false && withTime ? "time" : withTime ? "datetime-local" : "date";
    return (
      <div className="a2-field">
        {text(props.label) ? <span className="a2-label">{text(props.label)}</span> : null}
        <input
          className="a2-input"
          onChange={(event) => writeBound(context, "value", event.target.value)}
          type={type}
          value={value}
        />
      </div>
    );
  },
);

const TabsComponent = impl(
  TabsApi,
  ({ props, buildChild }: ViewProps) => {
    const tabs = Array.isArray(props.tabs)
      ? (props.tabs as Array<{ title?: unknown; child?: unknown }>)
      : [];
    const [active, setActive] = useState(0);
    const current = tabs[Math.min(active, Math.max(tabs.length - 1, 0))];
    return (
      <div className="a2-tabs">
        <div className="a2-tab-list" role="tablist">
          {tabs.map((tab, index) => (
            <button
              aria-selected={index === active}
              className={`a2-tab ${index === active ? "is-active" : ""}`}
              key={index}
              onClick={() => setActive(index)}
              role="tab"
              type="button"
            >
              {text(tab.title)}
            </button>
          ))}
        </div>
        <div className="a2-tab-panel">{current ? renderChild(current.child, buildChild, "tab") : null}</div>
      </div>
    );
  },
);

const ModalComponent = impl(
  ModalApi,
  ({ props, buildChild }: ViewProps) => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <span
          className="a2-modal-trigger"
          onClick={() => setOpen(true)}
          role="presentation"
        >
          {renderChild(props.trigger, buildChild, "trigger")}
        </span>
        {open ? (
          <div className="a2-modal-backdrop" onClick={() => setOpen(false)} role="presentation">
            <div
              aria-modal
              className="a2-modal"
              onClick={(event) => event.stopPropagation()}
              role="dialog"
            >
              <button className="a2-modal-close" onClick={() => setOpen(false)} type="button">
                ×
              </button>
              {renderChild(props.content, buildChild, "content")}
            </div>
          </div>
        ) : null}
      </>
    );
  },
);

const ImageComponent = impl(
  ImageApi,
  ({ props }: ViewProps) => {
    const variant = text(props.variant) || "mediumFeature";
    return (
      <img
        alt={text(props.description)}
        className={`a2-image a2-image-${variant}`}
        src={text(props.url)}
        style={{ objectFit: (text(props.fit) || "cover") as CSSProperties["objectFit"] }}
      />
    );
  },
);

const ICON_PATHS: Record<string, string> = {
  check: "M3 8.5l3.2 3L13 5",
  close: "M4 4l8 8M12 4l-8 8",
  add: "M8 3v10M3 8h10",
  info: "M8 7v5M8 4.6v.1",
  error: "M8 4v5M8 11.6v.1",
  warning: "M8 3.5l5.5 9.5h-11zM8 7v3M8 11.6v.1",
  favorite: "M8 13S2.8 10 2.8 6.4A2.8 2.8 0 018 4.3a2.8 2.8 0 015.2 2.1C13.2 10 8 13 8 13z",
  home: "M3 7.5L8 3l5 4.5V13H3z",
  lock: "M4.5 7V5.5a3.5 3.5 0 017 0V7M3.5 7h9v6h-9z",
  lockOpen: "M4.5 7V5.5a3.5 3.5 0 016.5-1.8M3.5 7h9v6h-9z",
  calendarToday: "M3 5.5h10V13H3zM3 8h10M5.5 3v2M10.5 3v2",
  event: "M3 5.5h10V13H3zM3 8h10M5.5 3v2M10.5 3v2",
  download: "M8 3v7M4.5 7.5L8 11l3.5-3.5M3.5 13h9",
  upload: "M8 11V4M4.5 7.5L8 4l3.5 3.5M3.5 13h9",
  edit: "M3 13l1-3.5L10.5 3 13 5.5 6.5 12z",
  delete: "M4 5h8M6.5 5V3.5h3V5M5 5l.6 8h4.8L11 5",
  search: "M7 11a4 4 0 100-8 4 4 0 000 8zM10 10l3 3",
  settings: "M8 10a2 2 0 100-4 2 2 0 000 4zM8 2.5v2M8 11.5v2M2.5 8h2M11.5 8h2",
  star: "M8 2.8l1.6 3.4 3.6.5-2.6 2.5.7 3.6L8 11.1l-3.3 1.7.7-3.6L2.8 6.7l3.6-.5z",
  accountCircle: "M8 14a6 6 0 100-12 6 6 0 000 12zM4.8 12a3.4 3.4 0 016.4 0M8 8.2a2 2 0 100-4 2 2 0 000 4z",
  arrowForward: "M3 8h9M9 5l3 3-3 3",
  arrowBack: "M13 8H4M7 5L4 8l3 3",
  mail: "M2.8 4.5h10.4v7H2.8zM3 4.8L8 8.6l5-3.8",
  shoppingCart: "M2.5 3h1.7l1.5 7h6.6l1.2-5H5M6.5 13a.6.6 0 100-1.2.6.6 0 000 1.2zM11.5 13a.6.6 0 100-1.2.6.6 0 000 1.2z",
};

const IconComponent = impl(
  IconApi,
  ({ props }: ViewProps) => {
    const name = text(props.name);
    const path = ICON_PATHS[name] ?? "M8 13a5 5 0 100-10 5 5 0 000 10z";
    return (
      <svg className="a2-icon" data-icon={name} viewBox="0 0 16 16" aria-hidden>
        <path d={path} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  },
);

const VideoComponent = impl(
  VideoApi,
  ({ props }: ViewProps) => (
    <video className="a2-video" controls playsInline src={text(props.url)} />
  ),
);

const AudioComponent = impl(
  AudioPlayerApi,
  ({ props }: ViewProps) => (
    <div className="a2-audio">
      {text(props.description) ? <span className="a2-label">{text(props.description)}</span> : null}
      <audio controls src={text(props.url)} />
    </div>
  ),
);

export const appCatalog = new Catalog(
  CATALOG_ID,
  "0.9",
  [
    TextComponent,
    ImageComponent,
    IconComponent,
    VideoComponent,
    AudioComponent,
    RowComponent,
    ColumnComponent,
    ListComponent,
    CardComponent,
    TabsComponent,
    ModalComponent,
    DividerComponent,
    ButtonComponent,
    TextFieldComponent,
    CheckBoxComponent,
    ChoicePickerComponent,
    SliderComponent,
    DateTimeInputComponent,
  ],
  [],
);
