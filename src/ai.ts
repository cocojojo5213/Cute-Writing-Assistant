/**
 * AI 相关功能
 * 处理与 AI API 的通信，以及知识库匹配
 */
import type { Message, AISettings, KnowledgeEntry } from './types'
import { CATEGORY_FIELDS } from './types'
import { useStore } from './store'

/**
 * 根据文本内容匹配相关的知识库条目
 * 会同时搜索内置知识库和外部知识库
 * @param text 用户输入的文本
 * @returns 匹配到的知识库条目列表
 */
export function getMatchedKnowledge(text: string): KnowledgeEntry[] {
  const { knowledge, externalKnowledge } = useStore.getState()
  const allKnowledge = [...knowledge, ...externalKnowledge]
  return allKnowledge.filter((k) => {
    // 防御性检查：确保 keywords 存在且为数组
    const keywords = Array.isArray(k.keywords) ? k.keywords : []
    return keywords.some((kw) => text.toLowerCase().includes(kw.toLowerCase()))
  })
}

/**
 * 将知识库条目的details转换为可读文本
 */
function formatKnowledgeDetails(entry: KnowledgeEntry): string {
  const fields = CATEGORY_FIELDS[entry.category]
  const details = entry.details
  const parts: string[] = []
  
  fields.forEach(field => {
    const value = details[field.key]
    if (value && value.trim()) {
      parts.push(`${field.label}：${value}`)
    }
  })
  
  return parts.join('\n')
}

/**
 * 发送消息给 AI 并获取回复
 * @param messages 对话历史
 * @param settings AI配置
 * @param currentContent 当前文档内容（可选，用于提供上下文）
 * @returns AI的回复内容
 */
export async function sendToAI(
  messages: Message[],
  settings: AISettings,
  currentContent?: string
): Promise<string> {
  const lastUserMsg = messages[messages.length - 1]?.content || ''
  const matched = getMatchedKnowledge(lastUserMsg)

  // 构建系统提示词
  let systemPrompt = settings.systemPrompt || `你是一个专业的小说写作助手。帮助用户进行创作、润色、分析角色、构思情节等。
回答要简洁实用，直接给出建议或修改后的内容。`

  // 如果匹配到知识库条目，添加到提示词中
  if (matched.length > 0) {
    systemPrompt += '\n\n以下是相关的设定资料，请参考：\n'
    matched.forEach((k) => {
      const detailsText = formatKnowledgeDetails(k)
      systemPrompt += `\n【${k.category}】${k.title}：\n${detailsText}\n`
    })
  }

  // 如果有当前文档内容，添加到提示词中（限制长度避免超出token限制）
  if (currentContent) {
    const plainText = currentContent.replace(/<[^>]*>/g, '').trim()
    if (plainText.length > 0) {
      systemPrompt += `\n\n当前文档内容：\n${plainText.slice(0, 3000)}`
    }
  }

  // 调用 AI API
  const res = await fetch(settings.apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    }),
  })

  if (!res.ok) throw new Error(`API错误: ${res.status}`)
  const data = await res.json()
  return data.choices?.[0]?.message?.content || '无响应'
}
