import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { expressionLanguageHelpHtml } from './expressionLanguageHelpContent'

type TocItem = {
  id: string
  text: string
  level: number
}

function normalizeText(s: string) {
  return (s || '').toLowerCase()
}

export default function ExpressionLanguageHelp() {
  const contentRef = useRef<HTMLDivElement | null>(null)
  const [toc, setToc] = useState<TocItem[]>([])
  const [query, setQuery] = useState<string>('')
  const [matchCount, setMatchCount] = useState<number>(0)
  const [activeMatchIdx, setActiveMatchIdx] = useState<number>(0)

  // Build TOC once content renders
  useEffect(() => {
    const root = contentRef.current
    if (!root) return
    const headings = Array.from(root.querySelectorAll('h1, h2, h3, h4')) as HTMLElement[]
    const items: TocItem[] = headings.map(h => ({
      id: h.id || '',
      text: (h.textContent || '').trim(),
      level: Number(h.tagName.replace('H', '')) || 2,
    })).filter(x => !!x.id && !!x.text)
    setToc(items)
  }, [])

  const filteredToc = useMemo(() => {
    const q = normalizeText(query).trim()
    if (!q) return toc
    return toc.filter(i => normalizeText(i.text).includes(q))
  }, [toc, query])

  // --- Search/highlight in content ---
  function clearHighlights(root: HTMLElement) {
    const marks = Array.from(root.querySelectorAll('mark[data-hl="1"]'))
    for (const m of marks) {
      const parent = m.parentNode
      if (!parent) continue
      parent.replaceChild(document.createTextNode(m.textContent || ''), m)
      parent.normalize()
    }
  }

  function highlightAll(root: HTMLElement, qRaw: string) {
    const q = qRaw.trim()
    if (!q) return 0

    // Walk all text nodes, skipping code/pre and nav-ish bits
    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          const parent = (node as any).parentElement as HTMLElement | null
          if (!parent) return NodeFilter.FILTER_REJECT
          const tag = parent.tagName
          if (tag === 'SCRIPT' || tag === 'STYLE') return NodeFilter.FILTER_REJECT
          if (parent.closest('pre') || parent.closest('code')) return NodeFilter.FILTER_REJECT
          if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT
          return NodeFilter.FILTER_ACCEPT
        }
      } as any,
      false
    )

    const qLower = q.toLowerCase()
    let total = 0
    const textNodes: Text[] = []
    while (walker.nextNode()) textNodes.push(walker.currentNode as Text)

    for (const node of textNodes) {
      const text = node.nodeValue || ''
      const lower = text.toLowerCase()
      const idx = lower.indexOf(qLower)
      if (idx === -1) continue

      const frag = document.createDocumentFragment()
      let last = 0
      let cur = 0

      while (true) {
        const found = lower.indexOf(qLower, cur)
        if (found === -1) break
        if (found > last) frag.appendChild(document.createTextNode(text.slice(last, found)))

        const mark = document.createElement('mark')
        mark.setAttribute('data-hl', '1')
        mark.textContent = text.slice(found, found + q.length)
        frag.appendChild(mark)

        total += 1
        cur = found + q.length
        last = cur
      }
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)))

      const parent = node.parentNode
      if (parent) parent.replaceChild(frag, node)
    }

    return total
  }

  function scrollToMatch(idx: number) {
    const root = contentRef.current
    if (!root) return
    const marks = Array.from(root.querySelectorAll('mark[data-hl="1"]')) as HTMLElement[]
    if (marks.length === 0) return
    const clamped = ((idx % marks.length) + marks.length) % marks.length
    setActiveMatchIdx(clamped)
    const el = marks[clamped]
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    // brief focus ring
    el.classList.add('hl-active')
    window.setTimeout(() => el.classList.remove('hl-active'), 350)
  }

  function runSearch(newQuery: string) {
    const root = contentRef.current
    if (!root) return
    clearHighlights(root)
    const n = highlightAll(root, newQuery)
    setMatchCount(n)
    setActiveMatchIdx(0)
    if (n > 0) scrollToMatch(0)
  }

  useEffect(() => {
    // debounce-ish: small delay so typing doesn't thrash DOM
    const t = window.setTimeout(() => runSearch(query), 150)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  function jumpTo(id: string) {
    const el = document.getElementById(id)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="helpLayout">
      <aside className="helpNav">
        <div className="helpNavTop">
          <Link to="/new" className="btn">← Back to New Sweep</Link>
          <div className="helpSearch">
            <input
              className="input"
              placeholder="Search…"
              value={query}
              onChange={(e)=>setQuery(e.target.value)}
            />
            <div className="helpSearchMeta">
              {matchCount > 0 ? (
                <span>{activeMatchIdx + 1}/{matchCount}</span>
              ) : (
                <span>{query.trim() ? '0/0' : ''}</span>
              )}
              <button
                className="btn btnSmall"
                onClick={()=>scrollToMatch(activeMatchIdx - 1)}
                disabled={matchCount === 0}
                title="Previous match"
              >↑</button>
              <button
                className="btn btnSmall"
                onClick={()=>scrollToMatch(activeMatchIdx + 1)}
                disabled={matchCount === 0}
                title="Next match"
              >↓</button>
            </div>
          </div>
        </div>

        <div className="helpToc">
          {filteredToc.map((h) => (
            <button
              key={h.id}
              className={"helpTocItem level" + h.level}
              onClick={()=>jumpTo(h.id)}
              title={h.text}
            >
              {h.text}
            </button>
          ))}
        </div>
      </aside>

      <main className="helpMain">
        <div className="helpHeaderRow">
          <h1 style={{margin:0}}>Expression Language</h1>
          <Link to="/new" className="btn">Back</Link>
        </div>
        <div className="helpBody" ref={contentRef} dangerouslySetInnerHTML={{ __html: expressionLanguageHelpHtml }} />
      </main>
    </div>
  )
}
