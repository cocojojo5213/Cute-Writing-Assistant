import { useState } from 'react'
import { useStore } from './store'
import type { KnowledgeEntry } from './types'
import './ImportAnalyze.css'

interface ExtractedEntry {
  category: KnowledgeEntry['category']
  title: string
  keywords: string[]
  content: string
  selected: boolean
}

export function ImportAnalyze({ onClose }: { onClose: () => void }) {
  const { aiSettings, addKnowledge } = useStore()
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [entries, setEntries] = useState<ExtractedEntry[]>([])
  const [error, setError] = useState('')

  const handleAnalyze = async () => {
    if (!text.trim() || !aiSettings.apiKey) {
      setError('请输入文本并配置 API Key')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch(aiSettings.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${aiSettings.apiKey}` },
        body: JSON.stringify({
          model: aiSettings.model,
          messages: [{
            role: 'user',
            content: `分析以下文本，提取人物、世界观、剧情、设定等信息。返回JSON数组格式：
[{"category":"人物|世界观|剧情|设定|其他","title":"标题","keywords":["关键词"],"content":"详细内容"}]
只返回JSON，不要其他内容。

文本：
${text}`
          }]
        })
      })
      const data = await res.json()
      const content = data.choices?.[0]?.message?.content || ''
      const match = content.match(/\[[\s\S]*\]/)
      if (match) {
        const parsed = JSON.parse(match[0])
        setEntries(parsed.map((e: Omit<ExtractedEntry, 'selected'>) => ({ ...e, selected: true })))
      }
    } catch (e) {
      setError('分析失败: ' + (e instanceof Error ? e.message : '未知错误'))
    }
    setLoading(false)
  }

  const handleImport = () => {
    entries.filter(e => e.selected).forEach(e => {
      addKnowledge({ category: e.category, title: e.title, keywords: e.keywords, content: e.content })
    })
    onClose()
  }

  return (
    <div className="import-modal">
      <div className="import-container">
        <button className="btn-close" onClick={onClose}>×</button>
        <h3>📥 导入分析</h3>
        {entries.length === 0 ? (
          <>
            <p className="hint">粘贴文本，AI 将自动提取人物、设定等信息</p>
            <textarea className="import-input" value={text} onChange={e => setText(e.target.value)} placeholder="粘贴你的文本..." />
            {error && <p className="error-msg">{error}</p>}
            <div className="import-footer">
              <span className="char-count">{text.length} 字</span>
              <button className="btn-analyze" onClick={handleAnalyze} disabled={loading}>{loading ? '分析中...' : '开始分析'}</button>
            </div>
          </>
        ) : (
          <>
            <div className="extract-header">
              <span>提取到 {entries.length} 个条目</span>
              <button onClick={() => setEntries([])}>重新分析</button>
            </div>
            <div className="extract-list">
              {entries.map((e, i) => (
                <div key={i} className={`extract-item ${e.selected ? 'selected' : ''}`} onClick={() => {
                  const newEntries = [...entries]
                  newEntries[i].selected = !newEntries[i].selected
                  setEntries(newEntries)
                }}>
                  <input type="checkbox" checked={e.selected} readOnly />
                  <div className="extract-info">
                    <div className="extract-meta"><span className="category-tag">{e.category}</span><span className="extract-title">{e.title}</span></div>
                    <div className="extract-keywords">关键词: {e.keywords.join(', ')}</div>
                    <div className="extract-preview">{e.content.slice(0, 100)}...</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="import-footer">
              <button className="btn-back" onClick={() => setEntries([])}>返回</button>
              <button className="btn-import" onClick={handleImport}>导入选中 ({entries.filter(e => e.selected).length})</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
