import { useRef, useEffect } from 'react'
import './Editor.css'

interface EditorProps {
  content: string
  onChange: (content: string) => void
}

function countWords(html: string): number {
  const text = html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
  return text.length
}

export function Editor({ content, onChange }: EditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const isInternalChange = useRef(false)

  useEffect(() => {
    if (editorRef.current && !isInternalChange.current) {
      if (editorRef.current.innerHTML !== content) {
        editorRef.current.innerHTML = content
      }
    }
    isInternalChange.current = false
  }, [content])

  const handleInput = () => {
    if (editorRef.current) {
      isInternalChange.current = true
      onChange(editorRef.current.innerHTML)
    }
  }

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value)
    editorRef.current?.focus()
    handleInput()
  }

  return (
    <div className="editor-wrapper">
      <div className="toolbar">
        <select onChange={(e) => execCommand('formatBlock', e.target.value)} defaultValue="">
          <option value="" disabled>标题</option>
          <option value="h1">标题 1</option>
          <option value="h2">标题 2</option>
          <option value="h3">标题 3</option>
          <option value="p">正文</option>
        </select>
        <button onClick={() => execCommand('bold')} title="加粗"><b>B</b></button>
        <button onClick={() => execCommand('italic')} title="斜体"><i>I</i></button>
        <button onClick={() => execCommand('underline')} title="下划线"><u>U</u></button>
      </div>
      <div
        ref={editorRef}
        className="editor-content"
        contentEditable
        onInput={handleInput}
      />
      <div className="word-count">{countWords(content)} 字</div>
    </div>
  )
}
