import { useState } from 'react'
import { useStore } from './store'
import { createEmptyDetails } from './types'
import type { KnowledgeCategory } from './types'
import mammoth from 'mammoth'
import './LongTextImport.css'

interface ExtractedItem {
  category: KnowledgeCategory
  title: string
  keywords: string[]
  content: string  // AI返回的是纯文本，导入时转换为details结构
}

// 按章节或段落切分文本，每段不超过 maxLen 字
function splitText(text: string, maxLen = 3000): { content: string; chapter?: string }[] {
  const chunks: { content: string; chapter?: string }[] = []
  
  // 匹配章节标题
  const chapterPattern = /(第[一二三四五六七八九十百千\d]+章[^\n]*|Chapter\s*\d+[^\n]*)/gi
  const parts = text.split(chapterPattern)
  
  let currentChapter = ''
  
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim()
    if (!part) continue
    
    // 检查是否是章节标题
    if (chapterPattern.test(part)) {
      chapterPattern.lastIndex = 0 // 重置正则
      currentChapter = part
      continue
    }
    
    if (part.length < 50) continue
    
    if (part.length <= maxLen) {
      chunks.push({ content: part, chapter: currentChapter || undefined })
    } else {
      // 内容太长，按段落再分
      const paragraphs = part.split(/\n\n+/)
      let current = ''
      for (const p of paragraphs) {
        if ((current + p).length > maxLen && current) {
          chunks.push({ content: current.trim(), chapter: currentChapter || undefined })
          current = p
        } else {
          current += '\n\n' + p
        }
      }
      if (current.trim().length > 50) {
        chunks.push({ content: current.trim(), chapter: currentChapter || undefined })
      }
    }
  }
  
  return chunks
}

export function LongTextImport({ onClose }: { onClose: () => void }) {
  const { aiSettings, addKnowledge } = useStore()
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [results, setResults] = useState<ExtractedItem[]>([])
  const [error, setError] = useState('')
  // 断点续传相关状态
  const [pausedAt, setPausedAt] = useState<number | null>(null)
  const [cachedChunks, setCachedChunks] = useState<{ content: string; chapter?: string }[]>([])

  // 读取文件
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setError('')
    
    if (file.name.endsWith('.txt')) {
      const content = await file.text()
      setText(content)
    } else if (file.name.endsWith('.docx') || file.name.endsWith('.doc')) {
      try {
        const arrayBuffer = await file.arrayBuffer()
        const result = await mammoth.extractRawText({ arrayBuffer })
        setText(result.value)
      } catch {
        setError('Word 文件读取失败，请尝试另存为 .docx 格式')
      }
    } else {
      setError('只支持 .txt 和 .docx 文件')
    }
  }

  const handleAnalyze = async (resumeFrom = 0) => {
    if (!text.trim()) return
    if (!aiSettings.apiKey) {
      setError('请先在 AI设置 中配置 API Key')
      return
    }

    // 如果是续传，使用缓存的chunks；否则重新切分
    const chunks = resumeFrom > 0 && cachedChunks.length > 0 ? cachedChunks : splitText(text)
    if (resumeFrom === 0) {
      setCachedChunks(chunks)
      setResults([])
    }
    
    setProgress({ current: resumeFrom, total: chunks.length })
    setLoading(true)
    setError('')
    setPausedAt(null)
    
    const allResults: ExtractedItem[] = resumeFrom > 0 ? [...results] : []

    for (let i = resumeFrom; i < chunks.length; i++) {
      setProgress({ current: i + 1, total: chunks.length })
      
      try {
        const chapterHint = chunks[i].chapter ? `\n当前章节：${chunks[i].chapter}` : ''
        const res = await fetch(aiSettings.apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${aiSettings.apiKey}`,
          },
          body: JSON.stringify({
            model: aiSettings.model,
            messages: [{
              role: 'user',
              content: `你是一个专业的小说分析师。请仔细分析以下小说片段，深入提取其中的信息。

分类说明（只能使用以下分类）：
1. 人物简介：人物姓名、外貌特征、性格特点、背景故事、人际关系、能力技能、生平经历等
2. 世界观：世界背景、历史、规则体系、势力分布、地理环境、特殊设定、术语解释等
3. 剧情梗概：主线故事发展、核心冲突、重大转折点等（整体性的剧情走向）
4. 章节梗概：当前章节的具体事件、场景描写、情节发展等
5. 支线伏笔：暗示、伏笔、未解之谜、潜在线索、可能的后续发展等
6. 道具物品：重要道具、武器、信物等的详细设定
7. 场景地点：重要场景的详细描写
8. 时间线：故事的时间轴事件
9. 写作素材：灵感、参考资料、待用片段等

要求：
- 请尽可能详细地描述每个条目，content 字段至少100字以上
- 关键词要包含人名、地名、术语等便于后续检索的词汇

返回JSON数组格式：[{"category":"人物简介|世界观|剧情梗概|章节梗概|支线伏笔|道具物品|场景地点|时间线|写作素材","title":"名称","keywords":["关键词1","关键词2"],"content":"详细描述（至少100字）"}]
只返回JSON数组，不要其他内容。如果没有可提取的内容，返回空数组 []
${chapterHint}
文本片段：
${chunks[i].content}`
            }]
          })
        })
        
        if (!res.ok) {
          throw new Error(`API 错误: ${res.status} ${res.statusText}`)
        }
        
        const data = await res.json()
        if (data.error) {
          throw new Error(data.error.message || 'API 返回错误')
        }
        
        const content = data.choices?.[0]?.message?.content || '[]'
        const match = content.match(/\[[\s\S]*\]/)
        if (match) {
          const items = JSON.parse(match[0]) as ExtractedItem[]
          allResults.push(...items)
          setResults([...allResults]) // 实时更新结果
        }
      } catch (e) {
        console.error('分析第', i + 1, '段失败:', e)
        // 保存断点，允许续传
        setError(`第 ${i + 1} 段分析失败: ${e instanceof Error ? e.message : '未知错误'}`)
        setPausedAt(i)
        setResults(allResults)
        setLoading(false)
        return
      }
      
      // 避免请求太快
      await new Promise(r => setTimeout(r, 500))
    }

    setResults(allResults)
    setLoading(false)
    setCachedChunks([])
    setPausedAt(null)
  }

  // 合并相同标题的条目
  const mergedResults = results.reduce((acc, item) => {
    const existing = acc.find(a => a.title === item.title && a.category === item.category)
    if (existing) {
      existing.content += '\n\n' + item.content
      existing.keywords = [...new Set([...existing.keywords, ...item.keywords])]
    } else {
      acc.push({ ...item })
    }
    return acc
  }, [] as ExtractedItem[])

  const handleImport = () => {
    mergedResults.forEach(item => {
      // 创建空的details结构，将content放入第一个字段
      const details = createEmptyDetails(item.category)
      const firstKey = Object.keys(details)[0]
      if (firstKey) {
        details[firstKey] = item.content
      }
      
      addKnowledge({
        category: item.category,
        title: item.title,
        keywords: item.keywords,
        details: details
      })
    })
    onClose()
  }

  return (
    <div className="long-import-modal">
      <div className="long-import-container">
        <button className="btn-close" onClick={onClose}>x</button>
        <h3>长文分析导入</h3>
        
        {results.length === 0 ? (
          <>
            <p className="hint">
              导入小说文件或粘贴内容（支持10万字以上），系统会自动分段让 AI 逐段分析，提取人物、设定等信息。
            </p>
            <div className="file-select">
              <label className="file-btn">
                选择文件 (TXT/Word)
                <input type="file" accept=".txt,.doc,.docx" onChange={handleFileSelect} hidden />
              </label>
              <span className="file-hint">或直接在下方粘贴文本</span>
            </div>
            <textarea
              className="long-input"
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="粘贴小说内容..."
              disabled={loading}
            />
            {error && <p className="error-msg">{error}</p>}
            <div className="long-footer">
              <span className="char-count">{text.length.toLocaleString()} 字</span>
              {loading ? (
                <span className="progress">
                  正在分析第 {progress.current}/{progress.total} 段...
                </span>
              ) : pausedAt !== null ? (
                <div className="resume-section">
                  <span className="pause-info">已完成 {pausedAt}/{cachedChunks.length} 段，已提取 {results.length} 条</span>
                  <button className="btn-resume" onClick={() => handleAnalyze(pausedAt)}>
                    继续分析
                  </button>
                  <button className="btn-restart" onClick={() => { setPausedAt(null); setResults([]); setCachedChunks([]); setError('') }}>
                    重新开始
                  </button>
                </div>
              ) : (
                <button className="btn-analyze" onClick={() => handleAnalyze(0)} disabled={!text.trim()}>
                  开始分析
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <p className="hint">
              分析完成，共提取 {mergedResults.length} 个条目（已自动合并相同项）
            </p>
            <div className="result-list">
              {mergedResults.map((item, i) => (
                <div key={i} className="result-item">
                  <div className="result-header">
                    <span className="category-tag">{item.category}</span>
                    <span className="result-title">{item.title}</span>
                  </div>
                  <div className="result-keywords">关键词: {item.keywords.join(', ')}</div>
                  <div className="result-preview">{item.content.slice(0, 150)}...</div>
                </div>
              ))}
            </div>
            <div className="long-footer">
              <button className="btn-back" onClick={() => setResults([])}>重新分析</button>
              <button className="btn-import" onClick={handleImport}>
                全部导入知识库 ({mergedResults.length})
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
