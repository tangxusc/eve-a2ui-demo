import { defineTool } from "eve/tools";
import { z } from "zod";
import { buildUpdateMessages } from "../../lib/a2ui/protocol";

export default defineTool({
  description: `更新已经存在的 A2UI 界面。用户点击了界面里的按钮（收到 <a2ui_action>），或要求修改已有界面的内容时调用。
参数：
- surfaceId：之前 render_ui 用过的同一个 surfaceId。
- components：可选的局部组件更新，按 id 覆盖或新增；不含 root 也合法。
- data：新的完整数据模型，会替换旧数据。只改数据时传这个即可。
返回 A2UI v0.9 updateComponents / updateDataModel 消息，客户端在原位刷新界面。`,
  inputSchema: z.object({
    surfaceId: z.string().min(1).describe("已存在的界面标识"),
    components: z
      .array(z.record(z.string(), z.unknown()))
      .optional()
      .describe("局部组件更新，按 id 覆盖或新增"),
    data: z.record(z.string(), z.unknown()).optional().describe("替换数据模型"),
  }),
  async execute({ surfaceId, components, data }) {
    const result = buildUpdateMessages({ surfaceId, components: components ?? [], data });
    if (!result.ok) {
      throw new Error(`A2UI 校验失败，修正后重新调用 update_ui：\n- ${result.errors.join("\n- ")}`);
    }
    return {
      operation: "update",
      surfaceId,
      messages: result.messages,
      warnings: result.warnings,
    };
  },
});
