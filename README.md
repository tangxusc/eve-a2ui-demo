# eve × A2UI demo

一个完整的「Agent 画界面」演示：Vercel 的 [eve](https://vercel.com/docs/eve) agent 通过工具调用产出
[A2UI v0.9](https://a2ui.org) 消息，浏览器用官方 `@a2ui/react` 渲染器把消息画成可点击、可填写的原生组件；
用户在界面里操作后，动作回到 agent，界面随数据模型原地更新。

模型走 DeepSeek 的 Anthropic 兼容接口（`deepseek-v4-flash`），不依赖 Vercel AI Gateway。

## 一次请求发生了什么

```
浏览器                       Next.js + eve                      DeepSeek
  │  用户: 画一个咖啡下单界面        │                                 │
  ├───────────────────────────────►│  /eve/v1/session                │
  │                                ├────────────────────────────────►│  tools: render_ui
  │                                │◄────────────────────────────────┤  tool_call(components[])
  │                                │  lib/a2ui/protocol.ts 校验 + 组装 │
  │◄───────────────────────────────┤  session 事件流: tool output      │
  │  MessageProcessor.processMessages(createSurface / updateComponents│
  │                                   / updateDataModel)             │
  │  A2uiSurface + appCatalog → DOM                                 │
  │                                                                  │
  │  用户点击「下单」                                                 │
  │  actionHandler → agent.send("<a2ui_action>{...}</a2ui_action>")   │
  ├───────────────────────────────►│  update_ui → updateDataModel     │
  │◄───────────────────────────────┤  同一个 surface 原地刷新          │
```

关键点：

- **工具而不是文本。** 模型调用 `render_ui` / `update_ui`，参数是 A2UI 组件邻接表。文本回复里没有 JSON。
- **服务端兜底。** `lib/a2ui/protocol.ts` 检查组件类型、必填属性、子组件引用、`root` 唯一性和可达性，
  把模型常犯的结构错误变成工具错误返回给模型，让它当轮修正，而不是让浏览器白屏。
- **官方渲染器 + 自定义 catalog。** 组件名和 schema 来自 A2UI Basic Catalog（`@a2ui/web_core`），
  渲染层是 `lib/a2ui/catalog.tsx` 里的 React 实现，所以界面用的是本项目的设计系统，不是渲染器的默认样式。
- **动作闭环。** `MessageProcessor` 的 action handler 把动作序列化成 `<a2ui_action>` 消息发给 agent，
  agent 用同一个 `surfaceId` 调 `update_ui`；`A2uiSurface` 通过数据模型信号自动重渲染。

## 目录

```
agent/
  agent.ts              # defineAgent：DeepSeek 模型、关闭默认工具
  instructions.md       # 系统提示：组件表、布局规则、动作回传约定
  channels/eve.ts       # eveChannel 鉴权（公开 demo 用 none()）
  tools/render_ui.ts    # 新建界面 → A2UI v0.9 消息
  tools/update_ui.ts    # 更新界面 → updateComponents / updateDataModel
lib/a2ui/
  protocol.ts           # 消息构造与校验（服务端共享）
  catalog.tsx           # 18 个组件的 React 实现，注册进 Catalog
  runtime.ts            # 浏览器侧 MessageProcessor，动作与协议日志
app/
  page.tsx              # 服务端壳
  components/chat.tsx   # useEveAgent + 消息流 + 动作回传
  components/a2ui-view.tsx  # surface 卡片、协议流面板
  globals.css
e2e/                    # Playwright 端到端测试
```

## 运行

需要 Node 24（eve 1.0 要求 `>=24`，`.nvmrc` 已给出）。

```bash
nvm use            # 或自行切换到 Node 24
npm install
cp .env.example .env.local   # 填入 DEEPSEEK_API_KEY
npm run dev        # Next.js 会同时拉起 eve dev server
```

打开 http://localhost:3000。

环境变量：

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com/anthropic` | Anthropic 兼容端点 |
| `DEEPSEEK_MODEL` | `deepseek-v4-flash` | 需要支持 tool calling |
| `DEEPSEEK_API_KEY` | 无 | 必填 |

生产构建：

```bash
npm run build
npm start          # next start 同时托管 agent（端口 4274 起）
```

## 测试

```bash
npm run typecheck
npx playwright install chromium   # 首次运行
npm run e2e
```

Playwright 默认复用 `http://localhost:3000` 上已运行的 dev server；没有则自己启动（需要 Node 24）。
测试用真实模型，单条用例 5–30 秒，超时设得比较宽。

覆盖范围：

| 用例 | 验证 |
| --- | --- |
| `shell.spec.ts` | 首屏、示例入口、发送按钮状态、协议面板空态、窄屏布局 |
| `render.spec.ts` | 模型调用工具 → surface 渲染出 catalog 组件；协议流含三类消息，`catalogId` 正确 |
| `interaction.spec.ts` | 点击按钮 → 动作回传 → `update_ui` → 同一 surface 原地更新；文字指令同样走 `update_ui` |
| `session.spec.ts` | 概念问题只回文字不画界面；新对话清空消息、界面和协议流 |

## 已知限制

- `agent/channels/eve.ts` 用 `none()` 放行所有请求，只适合公开 demo；接入真实数据前换成会话校验。
- 会话存在 eve 的 workflow 里，没有自己的数据库，刷新页面会开新会话。
- 界面质量取决于模型的工具调用；`deepseek-v4-flash` 偶尔会把元素写得偏少，但结构错误会被服务端校验挡住。
