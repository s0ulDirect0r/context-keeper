import jsPDF from 'jspdf';

/**
 * Trigger a markdown file download in the browser.
 */
export function downloadMarkdown(markdown: string, title: string): void {
  const sanitized = sanitizeFilename(title);
  const filename = `${sanitized || 'summary'}-summary.md`;
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Render markdown as a clean, text-selectable PDF using jsPDF.
 */
export function downloadPdf(markdown: string, title: string): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const m = { top: 20, bottom: 20, left: 15, right: 15 };
  const contentW = pageW - m.left - m.right;
  let y = m.top;

  function ensureSpace(needed: number) {
    if (y + needed > pageH - m.bottom) {
      doc.addPage();
      y = m.top;
    }
  }

  function renderLines(text: string, size: number, style: string, indent = 0) {
    doc.setFontSize(size);
    doc.setFont('helvetica', style);
    const wrapped = doc.splitTextToSize(text, contentW - indent);
    const lh = size * 0.4;
    ensureSpace(wrapped.length * lh);
    doc.text(wrapped, m.left + indent, y);
    y += wrapped.length * lh;
  }

  function strip(text: string): string {
    return text
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/_(.+?)_/g, '$1')
      .replace(/`(.+?)`/g, '$1')
      .replace(/\[(.+?)\]\(.+?\)/g, '$1');
  }

  const lines = markdown.split('\n');

  for (const line of lines) {
    if (line.startsWith('#### ')) {
      y += 1;
      renderLines(strip(line.slice(5)), 11, 'bold');
      y += 1;
    } else if (line.startsWith('### ')) {
      y += 1;
      renderLines(strip(line.slice(4)), 12, 'bold');
      y += 1;
    } else if (line.startsWith('## ')) {
      y += 2;
      renderLines(strip(line.slice(3)), 14, 'bold');
      y += 2;
    } else if (line.startsWith('# ')) {
      y += 2;
      renderLines(strip(line.slice(2)), 18, 'bold');
      y += 3;
    } else if (/^\s*[-*+]\s/.test(line)) {
      const text = strip(line.replace(/^\s*[-*+]\s+/, ''));
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const wrapped = doc.splitTextToSize(text, contentW - 10);
      ensureSpace(wrapped.length * 4);
      doc.text('\u2022', m.left + 3, y);
      doc.text(wrapped, m.left + 8, y);
      y += wrapped.length * 4;
    } else if (/^\s*\d+\.\s/.test(line)) {
      const match = line.match(/^(\s*\d+\.)\s+(.*)/);
      if (match) {
        const num = match[1].trim();
        const text = strip(match[2]);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        const wrapped = doc.splitTextToSize(text, contentW - 12);
        ensureSpace(wrapped.length * 4);
        doc.text(num, m.left + 2, y);
        doc.text(wrapped, m.left + 10, y);
        y += wrapped.length * 4;
      }
    } else if (line.startsWith('|')) {
      // Table row — monospace
      doc.setFontSize(8);
      doc.setFont('courier', 'normal');
      ensureSpace(3.5);
      doc.text(line, m.left, y);
      y += 3.5;
    } else if (/^[-*_]{3,}\s*$/.test(line)) {
      y += 2;
      doc.setDrawColor(200, 200, 200);
      doc.line(m.left, y, pageW - m.right, y);
      y += 3;
    } else if (line.trim() === '') {
      y += 2;
    } else {
      renderLines(strip(line), 10, 'normal');
      y += 1;
    }
  }

  const sanitized = sanitizeFilename(title);
  doc.save(`${sanitized || 'summary'}-summary.pdf`);
}

function sanitizeFilename(title: string): string {
  return title
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase()
    .slice(0, 50);
}
