import mammoth from 'mammoth'

export interface ParsedDocument {
  text: string
  pageCount: number
}

export async function parseDocument(
  buffer: Buffer,
  fileType: string,
): Promise<ParsedDocument> {
  const type = fileType.toLowerCase()

  if (type === 'pdf') {
    return await parsePdf(buffer)
  }

  if (type === 'docx' || type === 'doc') {
    const result = await mammoth.extractRawText({ buffer })
    return { text: result.value, pageCount: 1 }
  }

  if (type === 'txt') {
    return { text: buffer.toString('utf-8'), pageCount: 1 }
  }

  throw new Error(`Unsupported file type: ${fileType}`)
}

async function parsePdf(buffer: Buffer): Promise<ParsedDocument> {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) })
  const pdf = await loadingTask.promise
  const pageCount = pdf.numPages
  const textParts: string[] = []

  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const pageText = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
    textParts.push(pageText)
  }

  return { text: textParts.join('\n'), pageCount }
}

// Split text into overlapping chunks for better RAG retrieval
export function chunkText(
  text: string,
  chunkSize = 800,
  overlap = 100,
): string[] {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (cleaned.length === 0) return []

  const chunks: string[] = []
  let start = 0

  while (start < cleaned.length) {
    const end = Math.min(start + chunkSize, cleaned.length)
    const chunk = cleaned.slice(start, end).trim()
    if (chunk.length > 50) chunks.push(chunk)
    if (end === cleaned.length) break
    start = end - overlap
  }

  return chunks
}
