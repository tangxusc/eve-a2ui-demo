import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "eve × A2UI · Agent 生成界面的演示",
  description:
    "Vercel eve agent 通过工具调用产出 A2UI v0.9 消息，浏览器用官方 React 渲染器画成可交互界面。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
