/**
 * 全局状态管理
 * 使用 Zustand 进行状态管理，数据自动持久化到 localStorage
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Doc, Message, AISettings, KnowledgeEntry } from './types'

// 状态接口定义
interface Store {
  // 文档相关
  docs: Doc[]                    // 所有文档列表
  currentDocId: string | null    // 当前选中的文档ID

  // AI对话相关
  messages: Message[]            // 对话消息列表
  aiSettings: AISettings         // AI配置（API地址、密钥、模型）
  saveApiKey: boolean            // 是否保存API Key到本地

  // 知识库相关
  knowledge: KnowledgeEntry[]           // 内置知识库（存储到localStorage）
  externalKnowledge: KnowledgeEntry[]   // 外部知识库（不存储，临时加载）

  // 文档操作方法
  addDoc: (title: string) => void
  updateDoc: (id: string, content: string) => void
  renameDoc: (id: string, title: string) => void
  deleteDoc: (id: string) => void
  setCurrentDoc: (id: string) => void

  // 消息操作方法
  addMessage: (msg: Message) => void
  clearMessages: () => void

  // 设置操作方法
  updateAISettings: (settings: Partial<AISettings>) => void
  setSaveApiKey: (save: boolean) => void

  // 知识库操作方法
  addKnowledge: (entry: Omit<KnowledgeEntry, 'id'>) => void
  updateKnowledge: (id: string, entry: Partial<KnowledgeEntry>) => void
  deleteKnowledge: (id: string) => void
  clearKnowledge: () => void  // 清空所有知识库
  appendToKnowledge: (id: string, content: string) => void
  setExternalKnowledge: (entries: KnowledgeEntry[]) => void
  clearExternalKnowledge: () => void
}

export const useStore = create<Store>()(
  persist(
    (set, _get) => ({
      // 初始状态
      docs: [],
      currentDocId: null,
      messages: [],
      aiSettings: {
        apiUrl: 'https://api.openai.com/v1/chat/completions',
        apiKey: '',
        model: 'gpt-4o-mini',
        systemPrompt: '你是一个专业的小说写作助手。帮助用户进行创作、润色、分析角色、构思情节等。\n回答要简洁实用，直接给出建议或修改后的内容。',
      },
      knowledge: [],
      externalKnowledge: [],
      saveApiKey: false,  // 默认不保存API Key

      // 新建文档
      addDoc: (title) => {
        const doc: Doc = {
          id: Date.now().toString(),
          title,
          content: '',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
        set((s) => ({ docs: [...s.docs, doc], currentDocId: doc.id }))
      },

      // 更新文档内容
      updateDoc: (id, content) =>
        set((s) => ({
          docs: s.docs.map((d) =>
            d.id === id ? { ...d, content, updatedAt: Date.now() } : d
          ),
        })),

      // 重命名文档
      renameDoc: (id, title) =>
        set((s) => ({
          docs: s.docs.map((d) => (d.id === id ? { ...d, title } : d)),
        })),

      // 删除文档（同时清空聊天记录，避免串话）
      deleteDoc: (id) =>
        set((s) => ({
          docs: s.docs.filter((d) => d.id !== id),
          currentDocId: s.currentDocId === id ? null : s.currentDocId,
          messages: s.currentDocId === id ? [] : s.messages,
        })),

      // 切换当前文档（同时清空聊天记录，避免串话）
      setCurrentDoc: (id) => set((s) => ({
        currentDocId: id,
        messages: s.currentDocId !== id ? [] : s.messages,
      })),

      // 添加对话消息
      addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),

      // 清空对话
      clearMessages: () => set({ messages: [] }),

      // 更新AI设置
      updateAISettings: (settings) =>
        set((s) => ({ aiSettings: { ...s.aiSettings, ...settings } })),

      // 设置是否保存API Key
      setSaveApiKey: (save) => set({ saveApiKey: save }),

      // 添加知识库条目
      addKnowledge: (entry) =>
        set((s) => ({
          knowledge: [...s.knowledge, { ...entry, id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}` }],
        })),

      // 更新知识库条目
      updateKnowledge: (id, entry) =>
        set((s) => ({
          knowledge: s.knowledge.map((k) =>
            k.id === id ? { ...k, ...entry } : k
          ),
        })),

      // 删除知识库条目
      deleteKnowledge: (id) =>
        set((s) => ({ knowledge: s.knowledge.filter((k) => k.id !== id) })),

      // 追加内容到知识库条目（追加到第一个文本字段）
      appendToKnowledge: (id, content) =>
        set((s) => ({
          knowledge: s.knowledge.map((k) => {
            if (k.id !== id) return k
            const details = { ...k.details }
            // 找到第一个文本字段追加内容
            const firstKey = Object.keys(details)[0]
            if (firstKey) {
              details[firstKey] = (details[firstKey] || '') + '\n\n---\n\n' + content
            }
            return { ...k, details }
          }),
        })),

      // 设置外部知识库（从JSON文件加载）
      setExternalKnowledge: (entries) => set({ externalKnowledge: entries }),

      // 清空外部知识库
      clearExternalKnowledge: () => set({ externalKnowledge: [] }),

      // 清空所有知识库
      clearKnowledge: () => set({ knowledge: [] }),
    }),
    {
      name: 'writing-assistant-store',  // localStorage 的 key
      // 只持久化这些字段，externalKnowledge 不存储
      // apiKey 不持久化，避免泄露风险
      partialize: (state) => ({
        docs: state.docs,
        currentDocId: state.currentDocId,
        messages: state.messages,
        saveApiKey: state.saveApiKey,
        aiSettings: {
          apiUrl: state.aiSettings.apiUrl,
          model: state.aiSettings.model,
          systemPrompt: state.aiSettings.systemPrompt,
          // 根据用户选择决定是否保存apiKey
          ...(state.saveApiKey ? { apiKey: state.aiSettings.apiKey } : {}),
        },
        knowledge: state.knowledge,
      })
    }
  )
)

// 获取当前文档的辅助函数
export const getCurrentDoc = () => {
  const { docs, currentDocId } = useStore.getState()
  return docs.find((d) => d.id === currentDocId)
}
