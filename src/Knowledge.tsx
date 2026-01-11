import { useState } from 'react'
import { useStore } from './store'
import type { KnowledgeEntry } from './types'
import { ImportAnalyze } from './ImportAnalyze'
import './Knowledge.css'

const CATEGORIES: KnowledgeEntry['category'][] = ['人物', '世界观', '剧情', '设定', '其他']

export function Knowledge({ onClose }: { onClose: () => void }) {
  const { knowledge, addKnowledge, updateKnowledge, deleteKnowledge } = useStore()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [filter, setFilter] = useState<string>('全部')
  const [showImport, setShowImport] = useState(false)
  const [form, setForm] = useState({ title: '', category: '人物' as KnowledgeEntry['category'], keywords: '', content: '' })

  const filtered = filter === '全部' ? knowledge : knowledge.filter(k => k.category === filter)
  const selected = knowledge.find(k => k.id === selectedId)

  const handleNew = () => {
    setSelectedId(null)
    setForm({ title: '', category: '人物', keywords: '', content: '' })
    setEditing(true)
  }

  const handleEdit = () => {
    if (selected) {
      setForm({ title: selected.title, category: selected.category, keywords: selected.keywords.join(', '), content: selected.content })
      setEditing(true)
    }
  }

  const handleSave = () => {
    const entry = { ...form, keywords: form.keywords.split(',').map(k => k.trim()).filter(Boolean) }
    if (selectedId) {
      updateKnowledge(selectedId, entry)
    } else {
      addKnowledge(entry)
    }
    setEditing(false)
  }

  return (
    <div className="knowledge-modal">
      <div className="knowledge-container">
        <button className="btn-close" onClick={onClose}>×</button>
        <div className="knowledge-sidebar">
          <div className="knowledge-header">
            <h3>📖 知识库</h3>
            <div className="header-actions">
              <button className="btn-import" onClick={() => setShowImport(true)}>导入</button>
              <button className="btn-new" onClick={handleNew}>+ 新建</button>
            </div>
          </div>
          <div className="category-filter">
            {['全部', ...CATEGORIES].map(c => (
              <button key={c} className={filter === c ? 'active' : ''} onClick={() => setFilter(c)}>{c}</button>
            ))}
          </div>
          <ul className="knowledge-list">
            {filtered.map(k => (
              <li key={k.id} className={k.id === selectedId ? 'active' : ''} onClick={() => { setSelectedId(k.id); setEditing(false) }}>
                <span className="entry-category">{k.category}</span>
                <span className="entry-title">{k.title}</span>
              </li>
            ))}
            {filtered.length === 0 && <li className="empty">暂无条目</li>}
          </ul>
        </div>

        <div className="knowledge-detail">
          {editing ? (
            <>
              <div className="detail-header">
                <h4>{selectedId ? '编辑' : '新建'}条目</h4>
                <div className="detail-actions">
                  <button onClick={() => setEditing(false)}>取消</button>
                  <button className="btn-save" onClick={handleSave}>保存</button>
                </div>
              </div>
              <div className="detail-form">
                <label>标题<input value={form.title} onChange={e => setForm({...form, title: e.target.value})} /></label>
                <label>分类
                  <select value={form.category} onChange={e => setForm({...form, category: e.target.value as KnowledgeEntry['category']})}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
                <label>关键词 (逗号分隔)<input value={form.keywords} onChange={e => setForm({...form, keywords: e.target.value})} /></label>
                <label>内容<textarea value={form.content} onChange={e => setForm({...form, content: e.target.value})} /></label>
              </div>
            </>
          ) : selected ? (
            <>
              <div className="detail-header">
                <h4>{selected.title}</h4>
                <div className="detail-actions">
                  <button onClick={handleEdit}>编辑</button>
                  <button className="btn-delete" onClick={() => { deleteKnowledge(selected.id); setSelectedId(null) }}>删除</button>
                </div>
              </div>
              <div className="detail-content">
                <div className="meta">
                  <span className="category-tag">{selected.category}</span>
                  <span className="keywords">关键词: {selected.keywords.join(', ')}</span>
                </div>
                <div className="content-text">{selected.content}</div>
              </div>
            </>
          ) : (
            <div className="detail-empty">选择或新建一个条目</div>
          )}
        </div>
      </div>
      {showImport && <ImportAnalyze onClose={() => setShowImport(false)} />}
    </div>
  )
}
