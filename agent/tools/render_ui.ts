import { defineTool } from "eve/tools";
import { z } from "zod";
import { buildCreateMessages } from "../../lib/a2ui/protocol";

export default defineTool({
  description: `在聊天中绘制一个新的 A2UI 界面（面）。用户要求界面、卡片、表单、列表、对比、仪表盘时调用。
参数：
- surfaceId：界面标识，kebab-case，例如 "coffee-order"。同一个 surfaceId 只能创建一次。
- components：A2UI 组件数组（邻接表）。必须有一个 id 为 "root" 的顶层容器，其他组件通过 id 被引用。
- data：可选的数据模型，供组件用 {"path": "/x"} 绑定。
返回 A2UI v0.9 消息，客户端用官方 @a2ui/react 渲染成原生界面。校验失败会返回错误，请按错误修正后重试。`,
  inputSchema: z.object({
    surfaceId: z.string().min(1).describe("界面标识，kebab-case"),
    components: z
      .array(z.record(z.string(), z.unknown()))
      .min(1)
      .describe("A2UI 组件邻接表，含 id 为 root 的顶层组件"),
    data: z.record(z.string(), z.unknown()).optional().describe("可选的数据模型"),
  }),
  async execute({ surfaceId, components, data }) {
    const result = buildCreateMessages({ surfaceId, components, data });
    if (!result.ok) {
      throw new Error(`A2UI 校验失败，修正后重新调用 render_ui：\n- ${result.errors.join("\n- ")}`);
    }
    return {
      operation: "create",
      surfaceId,
      messages: result.messages,
      warnings: result.warnings,
    };
  },
});
