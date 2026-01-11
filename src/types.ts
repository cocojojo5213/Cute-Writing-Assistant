export interface Doc {
  id: string
  title: string
  content: string
  createdAt: number
  updatedAt: number
}

export interface Message {
  role: 'user' | 'assistant'
  content: string
}

export interface AISettings {
  apiUrl: string
  apiKey: string
  model: string
}

export interface KnowledgeEntry {
  id: string
  category: '人物' | '世界观' | '剧情' | '设定' | '其他'
  title: string
  keywords: string[]
  content: string
}
