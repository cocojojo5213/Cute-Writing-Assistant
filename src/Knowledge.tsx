import { useState } from 'react'
import { useStore } from './store'
import type { KnowledgeCategory } from './types'
import { CATEGORY_FIELDS, createEmptyDetails } from './types'
import { ImportAnalyze } from './ImportAnalyze'
import { LongTextImport } from './LongTextImport'
import { MergeDuplicates } from './MergeDuplicates'
import './Knowledge.css'

const CATEGORIES: KnowledgeCategory[] = [
  '人物简介', '世界观', '剧情梗概', '章节梗概',
  '支线伏笔', '道具物品', '场景地点', '时间线', '写作素材'
]

export function Knowledge({ onClose }: { onClose: () => void }) {
  const { knowledge, addKnowledge, updateKnowledge, deleteKnowledge, clearKnowledge } = useStore()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [filter, setFilter] = useState<string>('全部')
  const [showImport, setShowImport] = useState(false)
  const [showLongImport, setShowLongImport] = useState(false)
  const [showMerge, setShowMerge] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [form, setForm] = useState<{
    title: string
    category: KnowledgeCategory
    keywords: string
    details: Record<string, string>
  }>({
    title: '',
    category: '人物简介',
    keywords: '',
    details: createEmptyDetails('人物简介')
  })

  const filtered = filter === '全部' ? knowledge : knowledge.filter(k => k.category === filter)
  const selected = knowledge.find(k => k.id === selectedId)

  // 按分类分组
  const grouped = CATEGORIES.reduce((acc, cat) => {
    const items = filtered.filter(k => k.category === cat)
    if (items.length > 0) acc[cat] = items
    return acc
  }, {} as Record<string, typeof knowledge>)

  const handleNew = () => {
    setSelectedId(null)
    setForm({
      title: '',
      category: '人物简介',
      keywords: '',
      details: createEmptyDetails('人物简介')
    })
    setEditing(true)
  }

  const handleEdit = () => {
    if (selected) {
      setForm({
        title: selected.title,
        category: selected.category,
        keywords: selected.keywords.join(', '),
        details: selected.details
      })
      setEditing(true)
    }
  }

  const handleCategoryChange = (newCategory: KnowledgeCategory) => {
    setForm({
      ...form,
      category: newCategory,
      details: createEmptyDetails(newCategory)
    })
  }

  const handleDetailChange = (key: string, value: string) => {
    setForm({
      ...form,
      details: { ...form.details, [key]: value }
    })
  }

  const handleSave = () => {
    const entry = {
      category: form.category,
      title: form.title,
      keywords: form.keywords.split(',').map(k => k.trim()).filter(Boolean),
      details: form.details
    }
    if (selectedId) {
      updateKnowledge(selectedId, entry)
    } else {
      addKnowledge(entry)
    }
    setEditing(false)
  }

  const currentFields = CATEGORY_FIELDS[form.category]

  return (
    <div className="knowledge-modal">
      <div className="knowledge-container">
        <button className="btn-close" onClick={onClose}>×</button>
        <div className="knowledge-sidebar">
          <div className="knowledge-header">
            <h3>知识库</h3>
            <div className="header-actions">
              <button className="btn-merge-dup" onClick={() => setShowMerge(true)}>合并</button>
              <button className="btn-import" onClick={() => setShowLongImport(true)}>长文</button>
              <button className="btn-import" onClick={() => setShowImport(true)}>导入</button>
              <button className="btn-new" onClick={handleNew}>+ 新建</button>
            </div>
          </div>
          <div className="category-filter">
            <button className={filter === '全部' ? 'active' : ''} onClick={() => setFilter('全部')}>全部 ({knowledge.length})</button>
            {CATEGORIES.map(c => (
              <button key={c} className={filter === c ? 'active' : ''} onClick={() => setFilter(c)}>{c}</button>
            ))}
            {knowledge.length > 0 && (
              <button className="btn-clear-all" onClick={() => setShowClearConfirm(true)}>🗑️ 清空</button>
            )}
          </div>
          <ul className="knowledge-list">
            {Object.entries(grouped).map(([category, items]) => (
              <li key={category} className="category-group">
                <div className="category-header" onClick={(e) => e.stopPropagation()}>{category} ({items.length})</div>
                <ul className="category-items">
                  {items.map(k => (
                    <li
                      key={k.id}
                      className={k.id === selectedId ? 'active' : ''}
                      onClick={(e) => { e.stopPropagation(); setSelectedId(k.id); setEditing(false) }}
                    >
                      <span className="entry-title">{k.title}</span>
                    </li>
                  ))}
                </ul>
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
                <div className="form-row">
                  <label className="form-label-inline">
                    标题
                    <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
                  </label>
                  <label className="form-label-inline">
                    分类
                    <select value={form.category} onChange={e => handleCategoryChange(e.target.value as KnowledgeCategory)}>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </label>
                </div>
                <label>
                  关键词 (逗号分隔)
                  <input value={form.keywords} onChange={e => setForm({ ...form, keywords: e.target.value })} />
                </label>
                <div className="detail-fields">
                  {currentFields.map(field => (
                    <label key={field.key} className="detail-field">
                      <span className="field-label">{field.label}</span>
                      {field.key === 'status' ? (
                        <select
                          value={form.details[field.key] || '未揭示'}
                          onChange={e => handleDetailChange(field.key, e.target.value)}
                        >
                          <option value="未揭示">未揭示</option>
                          <option value="已揭示">已揭示</option>
                        </select>
                      ) : (
                        <textarea
                          value={form.details[field.key] || ''}
                          onChange={e => handleDetailChange(field.key, e.target.value)}
                          placeholder={`输入${field.label}...`}
                        />
                      )}
                    </label>
                  ))}
                </div>
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
                  <span className="keywords">关键词: {selected.keywords.join(', ') || '无'}</span>
                </div>
                <div className="detail-sections">
                  {CATEGORY_FIELDS[selected.category].map(field => {
                    const value = selected.details[field.key]
                    if (!value) return null
                    return (
                      <div key={field.key} className="detail-section">
                        <h5>{field.label}</h5>
                        <p>{value}</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="detail-empty">选择或新建一个条目</div>
          )}
        </div>
      </div>
      {showImport && <ImportAnalyze onClose={() => setShowImport(false)} />}
      {showLongImport && <LongTextImport onClose={() => setShowLongImport(false)} />}
      {showMerge && <MergeDuplicates onClose={() => setShowMerge(false)} />}

      {/* 清空确认对话框 */}
      {showClearConfirm && (
        <div className="confirm-overlay">
          <div className="confirm-dialog">
            <h4>⚠️ 确认清空知识库？</h4>
            <p>此操作将删除所有 <strong>{knowledge.length}</strong> 个条目，且无法恢复。</p>
            <div className="confirm-actions">
              <button className="btn-cancel" onClick={() => setShowClearConfirm(false)}>取消</button>
              <button className="btn-danger" onClick={() => {
                clearKnowledge()
                setShowClearConfirm(false)
                setSelectedId(null)
              }}>确认清空</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
