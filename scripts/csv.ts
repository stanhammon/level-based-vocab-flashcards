/**
 * Minimal RFC 4180 CSV parser: quoted fields, doubled quotes, commas and
 * newlines inside quotes, CRLF or LF, optional UTF-8 BOM. Each record keeps
 * the 1-based line it started on so validation errors can point at it.
 */
export interface CsvRecord {
  line: number
  fields: string[]
}

export function parseCsv(text: string): CsvRecord[] {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  const records: CsvRecord[] = []
  let fields: string[] = []
  let field = ''
  let inQuotes = false
  let line = 1
  let startLine = 1

  const endRecord = () => {
    fields.push(field)
    // Skip blank lines (a lone empty field).
    if (!(fields.length === 1 && fields[0] === '')) records.push({ line: startLine, fields })
    fields = []
    field = ''
  }

  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i++
        } else inQuotes = false
      } else {
        if (ch === '\n') line++
        field += ch
      }
    } else if (ch === '"') inQuotes = true
    else if (ch === ',') {
      fields.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      endRecord()
      line++
      startLine = line
    } else field += ch
  }
  if (field !== '' || fields.length > 0) endRecord()
  return records
}
