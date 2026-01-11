# Cute Writing Assistant

一个轻量级的小说写作辅助工具，集成 AI 助手和知识库管理功能。

[GitHub](https://github.com/cocojojo5213/Cute-Writing-Assistant)

## 功能特性

- 富文本编辑器，支持标题、加粗、斜体、列表等格式
- 多文档管理，数据自动保存到浏览器
- AI 写作助手，支持 OpenAI 兼容接口
- 知识库系统，管理人物、世界观、剧情等设定
- AI 自动匹配知识库关键词，提供上下文参考
- 导入分析功能，AI 自动提取文本中的设定信息
- 导出为 TXT 或 Word 格式
- 数据导入导出，方便备份和迁移

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build
```

构建后的文件在 `dist/` 目录，可以直接部署到任何静态服务器，或本地双击 `index.html` 打开使用。

## 配置 AI

点击左侧「AI设置」按钮，填入：

- API URL: 你的 AI 服务地址（兼容 OpenAI 格式）
- API Key: 你的 API 密钥
- 模型: 模型名称，如 gpt-4o-mini

## 知识库使用

1. 点击「知识库」创建条目，填写标题、分类、关键词和内容
2. 在 AI 对话中提到关键词时，系统会自动将相关设定发送给 AI
3. 可以使用「导入分析」功能，粘贴大段文本让 AI 自动提取设定

## 数据存储

- 数据默认保存在浏览器 localStorage 中
- 可在「AI设置」中导出/导入 JSON 备份文件
- 清除浏览器数据会丢失内容，请定期备份

## 技术栈

- React 19
- TypeScript
- Vite
- Zustand（状态管理）

## 许可证

MIT
