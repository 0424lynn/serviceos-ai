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
    const pdfModule = await import('pdf-parse')
    const pdfParse = pdfModule as unknown as (buf: Buffer) => Promise<{ text: string; numpages: number }>
    const result = await pdfParse(buffer)
    return { text: result.text, pageCount: result.numpages }
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
