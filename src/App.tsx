import { useState } from 'react'
import { useStore, getCurrentDoc } from './store'
import { sendToAI, getMatchedKnowledge } from './ai'
import { exportToTxt, exportToWord } from './export'
import { Editor } from './Editor'
import { Knowledge } from './Knowledge'
import './App.css'

function App() {
  const { docs, currentDocId, messages, aiSettings, knowledge, addDoc, updateDoc, renameDoc, deleteDoc, setCurrentDoc, addMessage, clearMessages, updateAISettings, appendToKnowledge } = useStore()
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showKnowledge, setShowKnowledge] = useState(false)
  const [editingTitle, setEditingTitle] = useState<string | null>(null)
  const [saveDropdown, setSaveDropdown] = useState<string | null>(null)

  const currentDoc = getCurrentDoc()
  const matchedKnowledge = input ? getMatchedKnowledge(input) : []

  const handleSend = async () => {
    if (!input.trim() || loading) return
    const userMsg = { role: 'user' as const, content: input }
    addMessage(userMsg)
    setInput('')
    setLoading(true)
    try {
      const reply = await sendToAI([...messages, userMsg], aiSettings, currentDoc?.content)
      addMessage({ role: 'assistant', content: reply })
    } catch (err) {
      addMessage({ role: 'assistant', content: `错误: ${err instanceof Error ? err.message : '未知错误'}` })
    }
    setLoading(false)
  }

  const insertToEditor = (text: string) => {
    if (!currentDoc) return
    updateDoc(currentDoc.id, currentDoc.content + '<p>' + text.replace(/\n/g, '</p><p>') + '</p>')
  }

  const handleNewDoc = () => {
    const title = prompt('文档标题:')
    if (title) addDoc(title)
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2>📚 文档</h2>
          <button onClick={handleNewDoc}>+ 新建</button>
        </div>
        <ul className="doc-list">
          {docs.map((doc) => (
            <li key={doc.id} className={doc.id === currentDocId ? 'active' : ''} onClick={() => setCurrentDoc(doc.id)}>
              {editingTitle === doc.id ? (
                <input autoFocus defaultValue={doc.title} onBlur={(e) => { renameDoc(doc.id, e.target.value); setEditingTitle(null) }} onClick={(e) => e.stopPropagation()} />
              ) : (
                <>
                  <span onDoubleClick={() => setEditingTitle(doc.id)}>{doc.title}</span>
                  <button className="delete-btn" onClick={(e) => { e.stopPropagation(); if (confirm('确定删除?')) deleteDoc(doc.id) }}>×</button>
                </>
              )}
            </li>
          ))}
        </ul>
        <div className="sidebar-footer">
          <button onClick={() => setShowKnowledge(true)}>📖 知识库 ({knowledge.length})</button>
          <button onClick={() => setShowSettings(true)}>⚙️ AI设置</button>
          {currentDoc && (
            <div className="export-btns">
              <button onClick={() => exportToTxt(currentDoc.title, currentDoc.content)}>TXT</button>
              <button onClick={() => exportToWord(currentDoc.title, currentDoc.content)}>Word</button>
            </div>
          )}
        </div>
      </aside>

      <main className="main">
        {currentDoc ? (
          <>
            <div className="editor-panel">
              <Editor content={currentDoc.content} onChange={(val) => updateDoc(currentDoc.id, val)} />
            </div>
            <div className="chat-panel">
              <div className="chat-header">
                <span>🤖 AI 助手</span>
                <button onClick={clearMessages}>清空</button>
              </div>
              <div className="chat-messages">
                {messages.length === 0 && (
                  <div className="chat-hint">
                    <p>💡 你可以问我：</p>
                    <ul><li>帮我分析一下这段的情绪</li><li>帮我想一个转折点</li><li>润色一下这段对话</li></ul>
                  </div>
                )}
                {messages.map((msg, i) => (
                  <div key={i} className={`message ${msg.role}`}>
                    <div className="message-content">{msg.content}</div>
                    {msg.role === 'assistant' && (
                      <div className="message-actions">
                        <button className="insert-btn" onClick={() => insertToEditor(msg.content)}>📝 插入</button>
                        <button className="save-btn" onClick={() => setSaveDropdown(saveDropdown === `${i}` ? null : `${i}`)}>💾 存入知识库</button>
                        {saveDropdown === `${i}` && (
                          <div className="save-dropdown">
                            {knowledge.map(k => <button key={k.id} onClick={() => { appendToKnowledge(k.id, msg.content); setSaveDropdown(null) }}>{k.title}</button>)}
                            {knowledge.length === 0 && <span className="no-knowledge">请先创建知识库条目</span>}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {loading && <div className="message assistant loading">思考中...</div>}
              </div>
              {matchedKnowledge.length > 0 && <div className="matched-hint">📎 将参考：{matchedKnowledge.map(k => k.title).join('、')}</div>}
              <div className="chat-input">
                <textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="输入消息..." onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }} />
                <button onClick={handleSend} disabled={loading}>发送</button>
              </div>
            </div>
          </>
        ) : (
          <div className="empty-state">
            <h2>✨ 写作助手</h2>
            <p>选择或创建一个文档开始写作</p>
            <button onClick={handleNewDoc}>创建新文档</button>
          </div>
        )}
      </main>

      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>⚙️ AI 设置</h3>
            <label>API URL<input value={aiSettings.apiUrl} onChange={(e) => updateAISettings({ apiUrl: e.target.value })} /></label>
            <label>API Key<input type="password" value={aiSettings.apiKey} onChange={(e) => updateAISettings({ apiKey: e.target.value })} /></label>
            <label>模型<input value={aiSettings.model} onChange={(e) => updateAISettings({ model: e.target.value })} /></label>
            <div className="data-btns">
              <button type="button" onClick={() => {
                const data = localStorage.getItem('writing-assistant-store')
                if (data) {
                  const blob = new Blob([data], { type: 'application/json' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `写作助手备份_${new Date().toLocaleDateString()}.json`
                  a.click()
                }
              }}>📤 导出数据</button>
              <button type="button" onClick={() => {
                const input = document.createElement('input')
                input.type = 'file'
                input.accept = '.json'
                input.onchange = (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0]
                  if (file) {
                    const reader = new FileReader()
                    reader.onload = () => {
                      if (confirm('确定导入？这会覆盖当前所有数据！')) {
                        localStorage.setItem('writing-assistant-store', reader.result as string)
                        location.reload()
                      }
                    }
                    reader.readAsText(file)
                  }
                }
                input.click()
              }}>📥 导入数据</button>
            </div>
            <button onClick={() => setShowSettings(false)}>关闭</button>
          </div>
        </div>
      )}
      {showKnowledge && <Knowledge onClose={() => setShowKnowledge(false)} />}
    </div>
  )
}

export default App
