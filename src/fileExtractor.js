/* Universal Client-Side File Extractor — Images, PDFs (text + scanned), DOCX, PPTX, XLSX, TXT/MD/CSV/JSON */
import JSZip from 'jszip';

let pdfjsPromise = null;
async function loadPdfJs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist').then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url
      ).toString();
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

function resizeImageToDataUrl(fileOrBlob, maxDim = 1400, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(fileOrBlob);
    const img = new Image();
    img.onload = () => {
      try {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        URL.revokeObjectURL(url);
        resolve(dataUrl);
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read image file.'));
    };
    img.src = url;
  });
}

function stripXmlTags(xml) {
  return String(xml || '')
    .replace(/<\/(w:p|a:p|p|tr|div|li|br|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function extractOfficeXml(file) {
  const zip = await JSZip.loadAsync(file);
  const lower = file.name.toLowerCase();
  const chunks = [];

  if (lower.endsWith('.docx')) {
    const doc = zip.file('word/document.xml');
    if (doc) chunks.push(stripXmlTags(await doc.async('text')));
  } else if (lower.endsWith('.pptx')) {
    const slideFiles = Object.keys(zip.files)
      .filter((n) => /^ppt\/slides\/slide\d+\.xml$/i.test(n))
      .sort((a, b) => {
        const na = parseInt(a.match(/\d+/)?.[0] || '0', 10);
        const nb = parseInt(b.match(/\d+/)?.[0] || '0', 10);
        return na - nb;
      });
    for (const sf of slideFiles) {
      const text = stripXmlTags(await zip.file(sf).async('text'));
      if (text) chunks.push(text);
    }
  } else if (lower.endsWith('.xlsx')) {
    const shared = zip.file('xl/sharedStrings.xml');
    if (shared) chunks.push(stripXmlTags(await shared.async('text')));
  } else {
    // Generic .zip / .srsl — read text/json/md files inside
    const textEntries = Object.values(zip.files).filter(
      (f) => !f.dir && /\.(txt|md|json|csv|tsv|xml|html)$/i.test(f.name) && !f.name.startsWith('__MACOSX/')
    );
    for (const entry of textEntries.slice(0, 10)) {
      const txt = await entry.async('text');
      chunks.push(`--- ${entry.name} ---\n${txt.slice(0, 8000)}`);
    }
  }

  return chunks.join('\n\n').trim();
}

async function extractPdf(file) {
  const pdfjs = await loadPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;

  const textPages = [];
  const totalPages = Math.min(pdf.numPages, 25);

  for (let p = 1; p <= totalPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => item.str || '')
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (pageText) {
      textPages.push(`[Page ${p}] ${pageText}`);
    }
  }

  const combinedText = textPages.join('\n\n');

  // If the PDF is scanned (very little selectable text), render up to 4 pages as JPEG images for vision AI
  const images = [];
  if (combinedText.length < 120) {
    const imgPages = Math.min(pdf.numPages, 4);
    for (let p = 1; p <= imgPages; p++) {
      const page = await pdf.getPage(p);
      const viewport = page.getViewport({ scale: 1.4 });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
      images.push({
        name: `${file.name} (page ${p})`,
        dataUrl: canvas.toDataURL('image/jpeg', 0.8)
      });
    }
  }

  return { text: combinedText, images };
}

/**
 * Extract readable text and/or compressed vision images from any uploaded File.
 * @param {File} file
 * @returns {Promise<{ name: string, kind: string, text: string, images: Array<{ name: string, dataUrl: string }> }>}
 */
export async function extractUploadFile(file) {
  const name = file.name || 'upload';
  const lower = name.toLowerCase();
  const type = (file.type || '').toLowerCase();

  // 1. Images
  if (type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp)$/i.test(lower)) {
    const dataUrl = await resizeImageToDataUrl(file);
    return {
      name,
      kind: 'image',
      text: '',
      images: [{ name, dataUrl }]
    };
  }

  // 2. PDFs
  if (type === 'application/pdf' || lower.endsWith('.pdf')) {
    const { text, images } = await extractPdf(file);
    return {
      name,
      kind: images.length ? 'pdf-scan' : 'pdf',
      text,
      images
    };
  }

  // 3. Office & Zip archives (.docx, .pptx, .xlsx, .zip, .srsl)
  if (/\.(docx|pptx|xlsx|zip|srsl)$/i.test(lower)) {
    const text = await extractOfficeXml(file);
    return {
      name,
      kind: lower.split('.').pop(),
      text,
      images: []
    };
  }

  // 4. Plain text, CSV, Markdown, JSON, HTML, Subtitles, code, etc.
  try {
    const text = (await file.text()).slice(0, 30000);
    return {
      name,
      kind: 'text',
      text,
      images: []
    };
  } catch {
    return {
      name,
      kind: 'file',
      text: `[Attached file: ${name}]`,
      images: []
    };
  }
}
