import { saveAs } from 'file-saver'

function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim()
}

export function exportToTxt(title: string, content: string) {
  const text = htmlToPlainText(content)
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  saveAs(blob, `${title}.txt`)
}

export function exportToWord(title: string, content: string) {
  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" 
          xmlns:w="urn:schemas-microsoft-com:office:word">
    <head><meta charset="utf-8"><title>${title}</title></head>
    <body>${content}</body>
    </html>
  `
  const blob = new Blob([html], { type: 'application/msword' })
  saveAs(blob, `${title}.doc`)
}
