/**
 * AI 相关功能
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
 * 搜索范围：标题、关键词、详情内容
 * @param text 用户输入的文本
 * @returns 匹配到的知识库条目列表
 */
export function getMatchedKnowledge(text: string): KnowledgeEntry[] {
  const { knowledge, externalKnowledge } = useStore.getState()
  const allKnowledge = [...knowledge, ...externalKnowledge]
  const normalizedText = text.toLowerCase()

  // 提取用户问题中的关键词（简单分词）
  const queryWords = normalizedText
    .replace(/[，。？！、""''：；（）【】]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 2)

  return allKnowledge.filter((k) => {
    // 1. 匹配标题
    if (k.title && normalizedText.includes(k.title.toLowerCase())) {
      return true
    }

    // 2. 匹配关键词
    const keywords = Array.isArray(k.keywords) ? k.keywords : []
    if (keywords.some((kw) => {
      if (typeof kw !== 'string') return false
      const keyword = kw.trim().toLowerCase()
      if (!keyword) return false
      return normalizedText.includes(keyword)
    })) {
      return true
    }

    // 3. 匹配详情内容中的关键信息
    const detailsText = Object.values(k.details || {})
      .filter(v => typeof v === 'string')
      .join(' ')
      .toLowerCase()

    // 检查用户问题中的关键词是否出现在详情中
    const matchCount = queryWords.filter(w =>
      k.title?.toLowerCase().includes(w) ||
      keywords.some(kw => typeof kw === 'string' && kw.toLowerCase().includes(w)) ||
      detailsText.includes(w)
    ).length

    // 如果匹配了多个关键词，认为相关
    return matchCount >= 2
  })
}

/**
 * 获取所有知识库条目（用于全局搜索查询）
 */
export function getAllKnowledgeSummary(): string {
  const { knowledge, externalKnowledge } = useStore.getState()
  const allKnowledge = [...knowledge, ...externalKnowledge]

  if (allKnowledge.length === 0) return ''

  // 按分类整理
  const byCategory: Record<string, string[]> = {}
  allKnowledge.forEach(k => {
    if (!byCategory[k.category]) byCategory[k.category] = []
    byCategory[k.category].push(k.title)
  })

  let summary = '【知识库索引】\n'
  Object.entries(byCategory).forEach(([cat, titles]) => {
    summary += `${cat}: ${titles.join('、')}\n`
  })

  return summary
}

/**
 * 将知识库条目的details转换为可读文本
 */
function formatKnowledgeDetails(entry: KnowledgeEntry): string {
  const fields = CATEGORY_FIELDS[entry.category]
  // 防御性检查：如果category无效，直接返回details的所有值
  if (!fields) {
    return Object.values(entry.details || {}).filter(v => v && typeof v === 'string').join('\n')
  }
  const details = entry.details || {}
  const parts: string[] = []

  fields.forEach(field => {
    const value = details[field.key]
    if (value && typeof value === 'string' && value.trim()) {
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
  const knowledgeSummary = getAllKnowledgeSummary()

  // 构建系统提示词
  let systemPrompt = settings.systemPrompt || `你是一个专业的小说写作助手。帮助用户进行创作、润色、分析角色、构思情节等。
回答要简洁实用，直接给出建议或修改后的内容。`

  // 添加知识库使用说明
  systemPrompt += `

【重要】你拥有一个知识库，里面存储了小说的人物、设定、剧情等信息。
当用户问到与小说相关的问题时（如角色关系、见面次数、地点、事件等），请根据知识库中的信息回答。
如果知识库中没有相关信息，请诚实告知用户"知识库中未找到相关信息"。`

  // 添加知识库索引
  if (knowledgeSummary) {
    systemPrompt += `\n\n${knowledgeSummary}`
  }

  // 如果匹配到知识库条目，添加详细信息
  if (matched.length > 0) {
    systemPrompt += '\n\n以下是与问题相关的详细设定资料：\n'
    matched.slice(0, 10).forEach((k) => {  // 限制最多10个条目避免超长
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
