import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Doc, Message, AISettings, KnowledgeEntry } from './types'

interface Store {
  docs: Doc[]
  currentDocId: string | null
  messages: Message[]
  aiSettings: AISettings
  knowledge: KnowledgeEntry[]
  addDoc: (title: string) => void
  updateDoc: (id: string, content: string) => void
  renameDoc: (id: string, title: string) => void
  deleteDoc: (id: string) => void
  setCurrentDoc: (id: string) => void
  addMessage: (msg: Message) => void
  clearMessages: () => void
  updateAISettings: (settings: Partial<AISettings>) => void
  addKnowledge: (entry: Omit<KnowledgeEntry, 'id'>) => void
  updateKnowledge: (id: string, entry: Partial<KnowledgeEntry>) => void
  deleteKnowledge: (id: string) => void
  appendToKnowledge: (id: string, content: string) => void
}

export const useStore = create<Store>()(
  persist(
    (set, _get) => ({
      docs: [],
      currentDocId: null,
      messages: [],
      aiSettings: {
        apiUrl: 'https://api.openai.com/v1/chat/completions',
        apiKey: '',
        model: 'gpt-4o-mini',
      },
      knowledge: [],

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

      updateDoc: (id, content) =>
        set((s) => ({
          docs: s.docs.map((d) =>
            d.id === id ? { ...d, content, updatedAt: Date.now() } : d
          ),
        })),

      renameDoc: (id, title) =>
        set((s) => ({
          docs: s.docs.map((d) => (d.id === id ? { ...d, title } : d)),
        })),

      deleteDoc: (id) =>
        set((s) => ({
          docs: s.docs.filter((d) => d.id !== id),
          currentDocId: s.currentDocId === id ? null : s.currentDocId,
        })),

      setCurrentDoc: (id) => set({ currentDocId: id }),

      addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),

      clearMessages: () => set({ messages: [] }),

      updateAISettings: (settings) =>
        set((s) => ({ aiSettings: { ...s.aiSettings, ...settings } })),

      addKnowledge: (entry) =>
        set((s) => ({
          knowledge: [...s.knowledge, { ...entry, id: Date.now().toString() }],
        })),

      updateKnowledge: (id, entry) =>
        set((s) => ({
          knowledge: s.knowledge.map((k) =>
            k.id === id ? { ...k, ...entry } : k
          ),
        })),

      deleteKnowledge: (id) =>
        set((s) => ({ knowledge: s.knowledge.filter((k) => k.id !== id) })),

      appendToKnowledge: (id, content) =>
        set((s) => ({
          knowledge: s.knowledge.map((k) =>
            k.id === id ? { ...k, content: k.content + '\n\n---\n\n' + content } : k
          ),
        })),
    }),
    { name: 'writing-assistant-store' }
  )
)

export const getCurrentDoc = () => {
  const { docs, currentDocId } = useStore.getState()
  return docs.find((d) => d.id === currentDocId)
}
