import { useState, useRef } from 'react'
import { useStore } from './store'
import { createEmptyDetails } from './types'
import type { KnowledgeCategory } from './types'
import mammoth from 'mammoth'
import './LongTextImport.css'

// 合法的分类列表
const VALID_CATEGORIES: KnowledgeCategory[] = [
  '人物简介', '世界观', '剧情梗概', '章节梗概',
  '支线伏笔', '道具物品', '场景地点', '时间线', '写作素材'
]

// 分类映射(处理AI可能返回的不规范分类名)
const CATEGORY_MAP: Record<string, KnowledgeCategory> = {
  '人物': '人物简介',
  '角色': '人物简介',
  '角色设定': '人物简介',
  '人物设定': '人物简介',
  '世界设定': '世界观',
  '背景设定': '世界观',
  '剧情': '剧情梗概',
  '主线剧情': '剧情梗概',
  '章节': '章节梗概',
  '伏笔': '支线伏笔',
  '道具': '道具物品',
  '物品': '道具物品',
  '场景': '场景地点',
  '地点': '场景地点',
  '素材': '写作素材',
}

// 标准化分类名
function normalizeCategory(category: string): KnowledgeCategory {
  // 先检查是否已经是合法分类
  if (VALID_CATEGORIES.includes(category as KnowledgeCategory)) {
    return category as KnowledgeCategory
  }
  // 尝试映射
  const mapped = CATEGORY_MAP[category]
  if (mapped) return mapped
  // 默认归类到写作素材
  console.warn(`[normalizeCategory] 未知分类 "${category}"，归类到"写作素材"`)
  return '写作素材'
}

// 清理AI返回的JSON（移除markdown代码块等）
function cleanAIResponse(content: string): string {
  // 移除 ```json ... ``` 包装
  let cleaned = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '')
  // 移除开头的非JSON字符
  cleaned = cleaned.trim()
  return cleaned
}

interface ExtractedItem {
  category: KnowledgeCategory
  title: string
  keywords: string[]
  content: string  // AI返回的是纯文本，导入时转换为details结构
}

// 预处理：清理文本中的网站元数据和无关内容
function preprocessText(text: string): string {
  let cleaned = text

  // 移除网站元数据行（常见于AO3等平台）
  const metadataPatterns = [
    /Chapter Management[\s\S]*?Chapter Text/gi,  // AO3章节管理区
    /Edit Chapter[\s\n]*/gi,
    /^Notes:[\s\S]*?(?=第|Chapter|\n\n)/gmi,  // Notes区域
    /^Summary:[\s\S]*?(?=第|Chapter|\n\n)/gmi,  // Summary区域
    /Chapter\s+\d+\s*\n\s*Chapter Text/gi,  // 章节标记
  ]

  for (const pattern of metadataPatterns) {
    cleaned = cleaned.replace(pattern, '\n')
  }

  // 移除分隔线
  cleaned = cleaned.replace(/[…·]{10,}/g, '\n')
  cleaned = cleaned.replace(/[-=]{10,}/g, '\n')

  // 移除多余空行
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n')

  console.log(`[preprocessText] 清理前: ${text.length}字, 清理后: ${cleaned.length}字`)

  return cleaned.trim()
}

// 检查内容是否为正文（而非元数据）
function isValidContent(text: string): boolean {
  const trimmed = text.trim()

  // 太短的不处理
  if (trimmed.length < 200) return false

  // 检查是否包含大量元数据特征
  const metadataKeywords = [
    '总字数', '章节数', '更新至', '预计', 'Chapter Management',
    'Edit Chapter', 'Notes:', 'Summary:', '人物简介：', '谨慎入坑',
    '警告！', '站反', 'OOC', '慢热型', '待补充'
  ]

  let metadataScore = 0
  for (const keyword of metadataKeywords) {
    if (trimmed.includes(keyword)) metadataScore++
  }

  // 如果超过3个元数据关键词，视为非正文
  if (metadataScore >= 3) return false

  return true
}

// 按章节或段落切分文本，每段不超过 maxLen 字
function splitText(text: string, maxLen = 3000): { content: string; chapter?: string }[] {
  const chunks: { content: string; chapter?: string }[] = []

  // 预处理文本
  const cleanedText = preprocessText(text)

  console.log(`[splitText] 开始处理，预处理后文本长度: ${cleanedText.length}字`)

  // 更广泛的章节标题匹配模式
  const chapterPatterns = [
    /(第[一二三四五六七八九十百千\d]+章[^\n]*)/gi,
    /(Chapter\s*\d+[^\n]*)/gi,
    /([第]?\d+[章节][^\n]*)/gi,
    /(序章|楔子|尾声|后记|番外[^\n]*)/gi
  ]

  // 先尝试按章节分割
  let bestSplit = null
  let maxChapters = 0

  for (const pattern of chapterPatterns) {
    pattern.lastIndex = 0
    const matches = cleanedText.match(pattern)
    console.log(`[splitText] 模式 ${pattern.source} 匹配到 ${matches?.length || 0} 个章节`)
    if (matches && matches.length > maxChapters) {
      maxChapters = matches.length
      bestSplit = pattern
    }
  }

  console.log(`[splitText] 最佳匹配: ${maxChapters} 个章节`)

  if (bestSplit && maxChapters > 1) {
    // 按最佳章节模式分割
    bestSplit.lastIndex = 0
    const parts = cleanedText.split(bestSplit)
    let currentChapter = ''
    console.log(`[splitText] 按章节分割得到 ${parts.length} 个部分`)

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i].trim()
      if (!part) continue

      // 检查是否是章节标题
      if (bestSplit.test(part)) {
        bestSplit.lastIndex = 0
        currentChapter = part
        continue
      }

      // 验证是否为有效正文
      if (!isValidContent(part)) {
        console.log(`[splitText] 跳过非正文段落(${part.length}字): ${part.substring(0, 50)}...`)
        continue
      }

      // 分段处理
      if (part.length <= maxLen) {
        chunks.push({ content: part, chapter: currentChapter || undefined })
      } else {
        // 按段落细分
        const paragraphs = part.split(/\n\s*\n/)
        let current = ''
        for (const p of paragraphs) {
          if ((current + p).length > maxLen && current.trim()) {
            if (isValidContent(current)) {
              chunks.push({ content: current.trim(), chapter: currentChapter || undefined })
            }
            current = p
          } else {
            current += (current ? '\n\n' : '') + p
          }
        }
        if (current.trim().length > 200) {
          chunks.push({ content: current.trim(), chapter: currentChapter || undefined })
        }
      }
    }
  } else {
    // 没有明显章节结构，按段落分割
    console.log(`[splitText] 无章节结构，按段落分割`)
    const paragraphs = cleanedText.split(/\n\s*\n/)
    let current = ''
    console.log(`[splitText] 段落数: ${paragraphs.length}`)

    for (const p of paragraphs) {
      const trimmed = p.trim()
      if (!trimmed || trimmed.length < 50) continue

      if ((current + trimmed).length > maxLen && current.trim()) {
        if (isValidContent(current)) {
          chunks.push({ content: current.trim() })
        }
        current = trimmed
      } else {
        current += (current ? '\n\n' : '') + trimmed
      }
    }

    if (current.trim().length > 200) {
      chunks.push({ content: current.trim() })
    }
  }

  // 最终过滤：确保每段都是有效正文且长度足够
  const filtered = chunks.filter(chunk => isValidContent(chunk.content))
  console.log(`[splitText] 最终分段数: ${filtered.length}，过滤前: ${chunks.length}`)
  filtered.forEach((chunk, i) => {
    console.log(`[splitText] 段${i + 1}: ${chunk.content.length}字, ${chunk.chapter || '无章节'}, 开头: ${chunk.content.substring(0, 50)}...`)
  })

  return filtered
}

export function LongTextImport({ onClose }: { onClose: () => void }) {
  const { aiSettings, knowledge, addKnowledge, appendToKnowledge } = useStore()
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [results, setResults] = useState<ExtractedItem[]>([])
  const [error, setError] = useState('')
  const [appendMode, setAppendMode] = useState(true)  // 追加模式默认开启
  // 断点续传相关状态
  const [pausedAt, setPausedAt] = useState<number | null>(null)
  const [cachedChunks, setCachedChunks] = useState<{ content: string; chapter?: string }[]>([])
  // 取消/暂停控制
  const abortControllerRef = useRef<AbortController | null>(null)
  const isPausingRef = useRef(false)  // 使用ref以避免闭包问题

  // 带重试的fetch函数
  const fetchWithRetry = async (
    url: string,
    options: RequestInit,
    maxRetries = 3,
    signal?: AbortSignal
  ): Promise<Response> => {
    let lastError: Error | null = null
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const res = await fetch(url, { ...options, signal })
        if (res.ok) return res
        // 401认证错误不重试，立即报错
        if (res.status === 401) {
          throw new Error('API Key 无效或已过期，请检查设置')
        }
        // 如果是网络错误（非业务错误），重试
        if (res.status >= 500 || res.status === 429) {
          lastError = new Error(`API 错误: ${res.status} ${res.statusText}`)
          console.log(`第${attempt}次请求失败(${res.status})，${attempt < maxRetries ? '准备重试...' : '放弃'}`)
          if (attempt < maxRetries) {
            await new Promise(r => setTimeout(r, 2000 * attempt))  // 递增延迟
            continue
          }
        }
        return res  // 其他4xx错误不重试
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') throw e  // 取消不重试
        lastError = e instanceof Error ? e : new Error(String(e))
        console.log(`第${attempt}次请求异常: ${lastError.message}，${attempt < maxRetries ? '准备重试...' : '放弃'}`)
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 1000 * attempt))
        }
      }
    }
    throw lastError || new Error('请求失败')
  }

  // 暂停分析
  const handlePause = () => {
    isPausingRef.current = true
    abortControllerRef.current?.abort()
  }

  // 取消分析
  const handleCancel = () => {
    isPausingRef.current = false
    abortControllerRef.current?.abort()
    setLoading(false)
    setPausedAt(null)
    setError('已取消分析')
  }

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
      // 调试信息：显示分段结果
      console.log(`文本长度: ${text.length}字，分成 ${chunks.length} 段`)
      chunks.forEach((chunk, i) => {
        console.log(`第${i + 1}段 (${chunk.content.length}字): ${chunk.chapter || '无章节'} - ${chunk.content.substring(0, 50)}...`)
      })
    }

    setProgress({ current: resumeFrom, total: chunks.length })
    setLoading(true)
    setError('')
    setPausedAt(null)
    isPausingRef.current = false

    // 创建AbortController用于取消
    abortControllerRef.current = new AbortController()
    const signal = abortControllerRef.current.signal

    const allResults: ExtractedItem[] = resumeFrom > 0 ? [...results] : []

    for (let i = resumeFrom; i < chunks.length; i++) {
      // 检查是否被暂停/取消
      if (signal.aborted) {
        if (isPausingRef.current) {
          setPausedAt(i)
          setResults(allResults)
          setLoading(false)
          isPausingRef.current = false
          setError(`已暂停，完成 ${i}/${chunks.length} 段`)
          return
        }
        break
      }

      setProgress({ current: i + 1, total: chunks.length })

      try {
        const chapterHint = chunks[i].chapter ? `\n当前章节：${chunks[i].chapter}` : ''
        console.log(`正在分析第 ${i + 1} 段: ${chunks[i].content.length}字`)

        const res = await fetchWithRetry(aiSettings.apiUrl, {
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

分析要求：
- 仔细阅读每一段内容，不要遗漏任何重要信息
- 每个人物都要单独提取，包括配角和路人甲
- 每个地点、道具、组织都要单独分析
- 每个章节的事件要详细记录
- 所有伏笔、暗示都要捕捉
- content 字段至少150字以上，要非常详细
- 关键词要包含人名、地名、术语等便于后续检索的词汇
- 如果这段内容是目录、统计信息、创作计划等元数据，请返回空数组 []

返回JSON数组格式：[{"category":"人物简介|世界观|剧情梗概|章节梗概|支线伏笔|道具物品|场景地点|时间线|写作素材","title":"名称","keywords":["关键词1","关键词2"],"content":"详细描述（至少150字）"}]
只返回JSON数组，不要其他内容。如果没有可提取的内容，返回空数组 []
${chapterHint}
文本片段：
${chunks[i].content}`
            }]
          })
        }, 3, signal)  // 最多重试3次

        if (!res.ok) {
          throw new Error(`API 错误: ${res.status} ${res.statusText}`)
        }

        const data = await res.json()
        if (data.error) {
          throw new Error(data.error.message || 'API 返回错误')
        }

        const rawContent = data.choices?.[0]?.message?.content || '[]'
        console.log(`第 ${i + 1} 段AI返回:`, rawContent.substring(0, 200))

        // 清理并解析JSON
        const cleanedContent = cleanAIResponse(rawContent)
        const match = cleanedContent.match(/\[[\s\S]*\]/)
        if (match) {
          try {
            const rawItems = JSON.parse(match[0]) as Array<{
              category?: string
              title?: string
              keywords?: string[] | string
              content?: string
            }>
            // 验证和标准化每个条目
            const validItems: ExtractedItem[] = rawItems
              .filter(item => item && item.title && item.content)
              .map(item => ({
                category: normalizeCategory(item.category || '写作素材'),
                title: String(item.title || '未命名'),
                keywords: Array.isArray(item.keywords)
                  ? item.keywords.map(k => String(k))
                  : typeof item.keywords === 'string'
                    ? item.keywords.split(/[,，]/).map(k => k.trim()).filter(Boolean)
                    : [],
                content: String(item.content || '')
              }))
            console.log(`第 ${i + 1} 段提取到 ${validItems.length} 个有效条目`)
            allResults.push(...validItems)
            setResults([...allResults]) // 实时更新结果
          } catch (parseError) {
            console.error(`第 ${i + 1} 段JSON解析失败:`, parseError, '\n原始内容:', match[0].substring(0, 200))
          }
        }
      } catch (e) {
        // 检查是否是用户取消
        if (e instanceof Error && e.name === 'AbortError') {
          if (isPausingRef.current) {
            setPausedAt(i)
            setResults(allResults)
            setLoading(false)
            isPausingRef.current = false
            setError(`已暂停，完成 ${i}/${chunks.length} 段`)
          }
          return
        }
        console.error('分析第', i + 1, '段失败:', e)
        // 保存断点，允许续传
        setError(`第 ${i + 1} 段分析失败(已重试3次): ${e instanceof Error ? e.message : '未知错误'}`)
        setPausedAt(i)
        setResults(allResults)
        setLoading(false)
        return
      }

      // 避免请求太快，间隔2秒
      await new Promise(r => setTimeout(r, 2000))
    }

    console.log(`分析完成，共提取 ${allResults.length} 个条目`)
    setResults(allResults)
    setLoading(false)
    setCachedChunks([])
    setPausedAt(null)
    abortControllerRef.current = null
  }

  // 不自动合并，显示所有提取的条目
  const mergedResults = results.map((item, index) => ({
    ...item,
    // 如果标题重复，添加序号区分
    title: results.filter((r, i) => i <= index && r.title === item.title && r.category === item.category).length > 1
      ? `${item.title} (${results.filter((r, i) => i <= index && r.title === item.title && r.category === item.category).length})`
      : item.title
  }))

  // 提取标题的基础名称（用于匹配现有条目）
  const getBaseName = (title: string): string => {
    let name = title.replace(/\s*[（(]\d+[)）]\s*$/, '')
    name = name.replace(/\s*[（(][^)）]+[)）]\s*$/, '')
    name = name.replace(/\s*[-—：:]\s*.+$/, '')
    return name.trim()
  }

  // 查找匹配的现有条目
  const findExistingEntry = (category: string, title: string) => {
    const baseName = getBaseName(title)
    return knowledge.find(k =>
      k.category === category &&
      getBaseName(k.title) === baseName
    )
  }

  const handleImport = async () => {
    let appendedCount = 0
    let createdCount = 0

    for (const item of mergedResults) {
      if (appendMode) {
        // 追加模式：检查是否有同名条目
        const existing = findExistingEntry(item.category, item.title)

        if (existing) {
          // 追加到现有条目
          const newContent = `\n\n---\n\n【新增信息】\n${item.content}`
          appendToKnowledge(existing.id, newContent)
          appendedCount++
          continue
        }
      }

      // 创建新条目
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
      createdCount++

      // 添加小延迟确保ID不重复
      await new Promise(r => setTimeout(r, 1))
    }

    // 显示导入结果
    const message = appendMode
      ? `导入完成：新建 ${createdCount} 条，追加 ${appendedCount} 条`
      : `导入完成：共 ${createdCount} 条`
    alert(message)
    onClose()
  }

  return (
    <div className="long-import-modal">
      <div className="long-import-container">
        <button className="btn-close" onClick={onClose}>x</button>
        <h3>长文分析导入</h3>

        {loading ? (
          <>
            <p className="hint">
              正在分析中，请耐心等待...
            </p>
            <div className="progress-panel">
              <div className="progress-info">
                <span className="progress-text">
                  📊 进度: <strong>{progress.current}</strong> / {progress.total} 段
                </span>
                <span className="progress-text">
                  📝 已提取: <strong>{results.length}</strong> 个条目
                </span>
              </div>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
                />
              </div>
              {results.length > 0 && (
                <div className="realtime-results">
                  <p className="realtime-title">实时提取结果预览：</p>
                  <div className="realtime-list">
                    {results.slice(-5).map((item, i) => (
                      <div key={i} className="realtime-item">
                        <span className="category-tag">{item.category}</span>
                        <span>{item.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="long-footer">
              <span className="char-count">{text.length.toLocaleString()} 字</span>
              <div className="loading-controls">
                <button className="btn-pause" onClick={handlePause}>
                  暂停
                </button>
                <button className="btn-cancel" onClick={handleCancel}>
                  取消
                </button>
              </div>
            </div>
          </>
        ) : results.length === 0 ? (
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
              {pausedAt !== null ? (
                <div className="resume-section">
                  <span className="pause-info">已完成 {pausedAt}/{cachedChunks.length} 段（第{pausedAt + 1}段失败），已提取 {results.length} 条</span>
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
              ✅ 分析完成，共提取 {mergedResults.length} 个条目
            </p>
            <div className="import-options">
              <label className="checkbox-option">
                <input
                  type="checkbox"
                  checked={appendMode}
                  onChange={e => setAppendMode(e.target.checked)}
                />
                <span>🔗 追加模式</span>
                <span className="option-hint">（同名条目追加内容而非创建新条目）</span>
              </label>
            </div>
            <div className="result-list">
              {mergedResults.map((item, i) => (
                <div key={i} className="result-item">
                  <div className="result-header">
                    <span className="category-tag">{item.category}</span>
                    <span className="result-title">{item.title}</span>
                    {appendMode && findExistingEntry(item.category, item.title) && (
                      <span className="append-badge">📎 将追加</span>
                    )}
                  </div>
                  <div className="result-keywords">关键词: {Array.isArray(item.keywords) ? item.keywords.join(', ') : String(item.keywords || '')}</div>
                  <div className="result-preview">{item.content.slice(0, 150)}...</div>
                </div>
              ))}
            </div>
            <div className="long-footer">
              <button className="btn-back" onClick={() => setResults([])}>重新分析</button>
              <button className="btn-import" onClick={handleImport}>
                {appendMode ? '智能导入' : '全部导入'} ({mergedResults.length})
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
