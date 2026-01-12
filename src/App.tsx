import { useState, useEffect } from 'react'
import { useStore, getCurrentDoc } from './store'
import { sendToAI, getMatchedKnowledge } from './ai'
import { exportToTxt, exportToWord } from './export'
import { Editor } from './Editor'
import { Knowledge } from './Knowledge'
import './App.css'

function App() {
  const { docs, currentDocId, messages, aiSettings, knowledge, externalKnowledge, saveApiKey, addDoc, updateDoc, renameDoc, deleteDoc, setCurrentDoc, addMessage, clearMessages, updateAISettings, setSaveApiKey, appendToKnowledge, setExternalKnowledge, clearExternalKnowledge } = useStore()
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showKnowledge, setShowKnowledge] = useState(false)
  const [editingTitle, setEditingTitle] = useState<string | null>(null)
  const [saveDropdown, setSaveDropdown] = useState<string | null>(null)
  const [storageUsage, setStorageUsage] = useState('')
  const [autoInsert, setAutoInsert] = useState(false)

  const currentDoc = getCurrentDoc()
  const matchedKnowledge = input ? getMatchedKnowledge(input) : []

  // 检测存储使用量（监听所有可能影响存储的状态）
  useEffect(() => {
    const data = localStorage.getItem('writing-assistant-store') || ''
    const sizeKB = (data.length / 1024).toFixed(1)
    const sizeMB = (data.length / 1024 / 1024).toFixed(2)
    setStorageUsage(data.length > 1024 * 1024 ? `${sizeMB} MB` : `${sizeKB} KB`)
  }, [docs, knowledge, messages])

  // 加载外部知识库
  const loadExternalKnowledge = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        const text = await file.text()
        try {
          const data = JSON.parse(text)
          // 支持两种格式：直接数组 或 {knowledge: [...]}
          const entries = Array.isArray(data) ? data : (data.state?.knowledge || data.knowledge || [])
          setExternalKnowledge(entries)
          alert(`已加载 ${entries.length} 条外部知识库`)
        } catch {
          alert('JSON 格式错误')
        }
      }
    }
    input.click()
  }
  const handleSend = async () => {
    if (!input.trim() || loading) return
    const userMsg = { role: 'user' as const, content: input }
    addMessage(userMsg)
    setInput('')
    setLoading(true)
    try {
      const reply = await sendToAI([...messages, userMsg], aiSettings, currentDoc?.content)
      addMessage({ role: 'assistant', content: reply })
      // 如果开启了实时写入，自动插入到编辑器
      if (autoInsert && currentDoc) {
        updateDoc(currentDoc.id, currentDoc.content + '<p>' + reply.replace(/\n/g, '</p><p>') + '</p>')
      }
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
              <Editor
                content={currentDoc.content}
                onChange={(val) => updateDoc(currentDoc.id, val)}
                onSendToAI={(text) => setInput(text)}
              />
            </div>
            <div className="chat-panel">
              <div className="chat-header">
                <span>🤖 AI 助手</span>
                <div className="chat-header-actions">
                  <label className="auto-insert-toggle" title="开启后AI回复自动写入编辑器">
                    <input type="checkbox" checked={autoInsert} onChange={(e) => setAutoInsert(e.target.checked)} />
                    <span>实时写入</span>
                  </label>
                  <button onClick={clearMessages}>清空</button>
                </div>
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
        <div className="modal-overlay">
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>设置</h3>
              <button className="modal-close" onClick={() => setShowSettings(false)}>×</button>
            </div>
            <label>API URL<input value={aiSettings.apiUrl} onChange={(e) => updateAISettings({ apiUrl: e.target.value })} /></label>
            <label>API Key<input type="password" value={aiSettings.apiKey} onChange={(e) => updateAISettings({ apiKey: e.target.value })} /></label>
            <label className="checkbox-label">
              <input type="checkbox" checked={saveApiKey} onChange={(e) => setSaveApiKey(e.target.checked)} />
              <span>记住API Key（保存到本地，方便下次使用）</span>
            </label>
            <label>模型<input value={aiSettings.model} onChange={(e) => updateAISettings({ model: e.target.value })} /></label>
            <label>系统提示词<textarea className="system-prompt-input" value={aiSettings.systemPrompt} onChange={(e) => updateAISettings({ systemPrompt: e.target.value })} placeholder="自定义AI助手的角色和行为..." /></label>

            <div className="settings-section">
              <h4>数据管理</h4>
              <p className="storage-info">存储使用: {storageUsage} / ~5MB</p>
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
                }}>导出数据</button>
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
                }}>导入数据</button>
              </div>
            </div>

            <div className="settings-section">
              <h4>外部知识库</h4>
              <p className="hint-text">加载外部 JSON 文件作为临时知识库，不占用浏览器存储</p>
              {externalKnowledge.length > 0 ? (
                <div className="external-info">
                  <span>已加载 {externalKnowledge.length} 条</span>
                  <button type="button" onClick={clearExternalKnowledge}>卸载</button>
                </div>
              ) : (
                <button type="button" className="load-external-btn" onClick={loadExternalKnowledge}>加载外部知识库</button>
              )}
            </div>

            <button className="modal-main-btn" onClick={() => setShowSettings(false)}>关闭</button>
          </div>
        </div>
      )}
      {showKnowledge && <Knowledge onClose={() => setShowKnowledge(false)} />}
    </div>
  )
}

export default App
