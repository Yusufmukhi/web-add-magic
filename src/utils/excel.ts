/**
 * Zero-dependency xlsx writer/reader.
 * Builds a valid .xlsx (OOXML) using only browser-native APIs — no npm packages needed.
 * Supports rich formatting: cell colors, bold/italic fonts, number formats, borders.
 */

// ─── Types ────────────────────────────────────────────────────────────────────
type CellValue = string | number | null | undefined;

export interface CellStyle {
  bold?: boolean;
  italic?: boolean;
  fontSize?: number;             // points, default 11
  fontColor?: string;            // hex RRGGBB e.g. "FF0000"
  bgColor?: string;              // hex RRGGBB e.g. "1E3A5F"
  numFmt?: string;               // Excel number format string
  align?: "left" | "center" | "right";
  wrapText?: boolean;
  border?: boolean;              // thin border on all sides
}

export interface StyledCell {
  v: CellValue;
  s?: CellStyle;
}

// A row is either plain values OR styled cells
type Row = (CellValue | StyledCell)[];

export interface ImportedHolding {
  ticker: string;
  qty: number;
  price: number;
  date: string;
}

// ─── XML helpers ──────────────────────────────────────────────────────────────
function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
}

function colName(n: number): string {
  let s = "";
  while (n >= 0) {
    s = String.fromCharCode((n % 26) + 65) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

// ─── Style registry ──────────────────────────────────────────────────────────
// We build OOXML style parts: numFmts, fonts, fills, borders, cellXfs
interface StyleEntry {
  fontIdx: number;
  fillIdx: number;
  borderIdx: number;
  numFmtId: number;
  alignH?: string;
  wrapText?: boolean;
}

class StyleBook {
  numFmts: { id: number; code: string }[] = [];
  fonts: string[] = [];
  fills: string[] = [];
  borders: string[] = [];
  xfs: StyleEntry[] = [];

  private numFmtMap = new Map<string, number>();
  private fontMap = new Map<string, number>();
  private fillMap = new Map<string, number>();
  private borderMap = new Map<string, number>();
  private xfMap = new Map<string, number>();
  private nextNumFmtId = 164; // custom numFmt IDs start at 164

  constructor() {
    // Bootstrap required OOXML defaults
    // 2 default fills required by spec
    this._addFill('<fill><patternFill patternType="none"/></fill>');
    this._addFill('<fill><patternFill patternType="gray125"/></fill>');
    // Default border
    this._addBorder("<border><left/><right/><top/><bottom/><diagonal/></border>");
    // Default font
    this._addFont('<font><sz val="11"/><name val="Arial"/></font>');
  }

  private _addFill(xml: string): number {
    if (this.fillMap.has(xml)) return this.fillMap.get(xml)!;
    const i = this.fills.length;
    this.fills.push(xml);
    this.fillMap.set(xml, i);
    return i;
  }
  private _addFont(xml: string): number {
    if (this.fontMap.has(xml)) return this.fontMap.get(xml)!;
    const i = this.fonts.length;
    this.fonts.push(xml);
    this.fontMap.set(xml, i);
    return i;
  }
  private _addBorder(xml: string): number {
    if (this.borderMap.has(xml)) return this.borderMap.get(xml)!;
    const i = this.borders.length;
    this.borders.push(xml);
    this.borderMap.set(xml, i);
    return i;
  }

  getXfIndex(s: CellStyle): number {
    const numFmtId = s.numFmt ? this._getNumFmtId(s.numFmt) : 0;

    // Font
    let fontXml = `<font>`;
    if (s.bold) fontXml += `<b/>`;
    if (s.italic) fontXml += `<i/>`;
    fontXml += `<sz val="${s.fontSize ?? 11}"/>`;
    if (s.fontColor) fontXml += `<color rgb="FF${s.fontColor}"/>`;
    fontXml += `<name val="Arial"/>`;
    fontXml += `</font>`;
    const fontIdx = this._addFont(fontXml);

    // Fill
    let fillIdx = 0;
    if (s.bgColor) {
      const fillXml = `<fill><patternFill patternType="solid"><fgColor rgb="FF${s.bgColor}"/></patternFill></fill>`;
      fillIdx = this._addFill(fillXml);
    }

    // Border
    let borderIdx = 0;
    if (s.border) {
      const b = `<border><left style="thin"><color rgb="FFB0B0B0"/></left><right style="thin"><color rgb="FFB0B0B0"/></right><top style="thin"><color rgb="FFB0B0B0"/></top><bottom style="thin"><color rgb="FFB0B0B0"/></bottom><diagonal/></border>`;
      borderIdx = this._addBorder(b);
    }

    const alignH = s.align;
    const wrapText = s.wrapText;

    const key = `${fontIdx}|${fillIdx}|${borderIdx}|${numFmtId}|${alignH}|${wrapText}`;
    if (this.xfMap.has(key)) return this.xfMap.get(key)!;
    const i = this.xfs.length;
    this.xfs.push({ fontIdx, fillIdx, borderIdx, numFmtId, alignH, wrapText });
    this.xfMap.set(key, i);
    return i;
  }

  private _getNumFmtId(code: string): number {
    if (this.numFmtMap.has(code)) return this.numFmtMap.get(code)!;
    const id = this.nextNumFmtId++;
    this.numFmts.push({ id, code });
    this.numFmtMap.set(code, id);
    return id;
  }

  toXml(): string {
    const numFmtsXml = this.numFmts.length
      ? `<numFmts count="${this.numFmts.length}">${this.numFmts.map((n) => `<numFmt numFmtId="${n.id}" formatCode="${escapeXml(n.code)}"/>`).join("")}</numFmts>`
      : `<numFmts count="0"/>`;

    const fontsXml = `<fonts count="${this.fonts.length}">${this.fonts.join("")}</fonts>`;
    const fillsXml = `<fills count="${this.fills.length}">${this.fills.join("")}</fills>`;
    const bordersXml = `<borders count="${this.borders.length}">${this.borders.join("")}</borders>`;

    // cellStyleXfs — one default required
    const cellStyleXfsXml = `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>`;

    const xfsXml =
      `<cellXfs count="${this.xfs.length + 1}">` +
      // index 0 = default
      `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
      this.xfs
        .map((x) => {
          let a = "";
          if (x.alignH || x.wrapText) {
            a = `<alignment${x.alignH ? ` horizontal="${x.alignH}"` : ""}${x.wrapText ? ` wrapText="1"` : ""}/>`;
          }
          return (
            `<xf numFmtId="${x.numFmtId}" fontId="${x.fontIdx}" fillId="${x.fillIdx}" borderId="${x.borderIdx}" xfId="0"` +
            (x.numFmtId ? ` applyNumberFormat="1"` : "") +
            (x.fontIdx ? ` applyFont="1"` : "") +
            (x.fillIdx ? ` applyFill="1"` : "") +
            (x.borderIdx ? ` applyBorder="1"` : "") +
            (a ? ` applyAlignment="1">` + a + `</xf>` : `/>`)
          );
        })
        .join("") +
      `</cellXfs>`;

    const cellStylesXml = `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>`;

    return (
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
      numFmtsXml + fontsXml + fillsXml + bordersXml +
      cellStyleXfsXml + xfsXml + cellStylesXml +
      `</styleSheet>`
    );
  }
}

// ─── Sheet + shared-strings + styles XML builder ──────────────────────────────
function buildSheetXml(rows: Row[]): { sheetXml: string; ssXml: string; stylesXml: string } {
  const sb = new StyleBook();
  const sharedStrings: string[] = [];
  const ssIndex = new Map<string, number>();

  function getSSI(v: string): number {
    if (ssIndex.has(v)) return ssIndex.get(v)!;
    const i = sharedStrings.length;
    sharedStrings.push(v);
    ssIndex.set(v, i);
    return i;
  }

  const colWidths: number[] = [];
  const cellRows: string[] = [];

  rows.forEach((row, ri) => {
    const cells: string[] = [];
    row.forEach((raw, ci) => {
      const ref = `${colName(ci)}${ri + 1}`;

      // Unwrap styled cell
      const isStyled = raw !== null && typeof raw === "object" && "v" in raw;
      const val: CellValue = isStyled ? (raw as StyledCell).v : (raw as CellValue);
      const style: CellStyle | undefined = isStyled ? (raw as StyledCell).s : undefined;

      const content = String(val ?? "");
      const len = content.length;
      if (len + 2 > (colWidths[ci] ?? 0)) colWidths[ci] = Math.min(60, len + 2);

      if (val === null || val === undefined || content === "") return;

      // Style index (0 = default)
      let sIdx = 0;
      if (style) sIdx = sb.getXfIndex(style) + 1; // +1 because index 0 in xfs is reserved default

      const sAttr = sIdx ? ` s="${sIdx}"` : "";

      if (typeof val === "number" && isFinite(val)) {
        cells.push(`<c r="${ref}"${sAttr}><v>${val}</v></c>`);
      } else {
        const si = getSSI(escapeXml(content));
        cells.push(`<c r="${ref}" t="s"${sAttr}><v>${si}</v></c>`);
      }
    });
    cellRows.push(`<row r="${ri + 1}">${cells.join("")}</row>`);
  });

  const maxCols = Math.max(0, ...rows.map((r) => r.length));
  const lastCol = colName(Math.max(0, maxCols - 1));
  const dim = `A1:${lastCol}${rows.length}`;
  const colDefs = colWidths
    .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" bestFit="1" customWidth="1"/>`)
    .join("");

  const sheetXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<dimension ref="${dim}"/>` +
    `<sheetViews><sheetView workbookViewId="0"><selection activeCell="A1" sqref="A1"/></sheetView></sheetViews>` +
    `<cols>${colDefs}</cols>` +
    `<sheetData>${cellRows.join("")}</sheetData>` +
    `</worksheet>`;

  const ssXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${sharedStrings.length}" uniqueCount="${sharedStrings.length}">` +
    sharedStrings.map((s) => `<si><t xml:space="preserve">${s}</t></si>`).join("") +
    `</sst>`;

  return { sheetXml, ssXml, stylesXml: sb.toXml() };
}

// ─── Minimal ZIP builder (store, no compression) ──────────────────────────────
function str2u8(s: string): Uint8Array {
  const b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 0xff;
  return b;
}

function crc32(data: Uint8Array): number {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = t[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function u32(n: number) { return new Uint8Array([n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff]); }
function u16(n: number) { return new Uint8Array([n & 0xff, (n >> 8) & 0xff]); }
function cat(...a: Uint8Array[]) {
  const out = new Uint8Array(a.reduce((s, x) => s + x.length, 0));
  let off = 0; a.forEach((x) => { out.set(x, off); off += x.length; }); return out;
}

function buildZip(files: { name: string; content: string | Uint8Array }[]): Uint8Array {
  const entries: { nameB: Uint8Array; data: Uint8Array; crc: number; offset: number }[] = [];
  const locals: Uint8Array[] = [];
  let offset = 0;

  files.forEach(({ name, content }) => {
    const nameB = str2u8(name);
    const data = typeof content === "string" ? str2u8(content) : content;
    const crc = crc32(data);
    const local = cat(
      new Uint8Array([0x50, 0x4b, 0x03, 0x04]),
      u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(data.length), u32(data.length),
      u16(nameB.length), u16(0),
      nameB, data
    );
    entries.push({ nameB, data, crc, offset });
    locals.push(local);
    offset += local.length;
  });

  const centrals = entries.map(({ nameB, data, crc, offset }) =>
    cat(
      new Uint8Array([0x50, 0x4b, 0x01, 0x02]),
      u16(20), u16(20), u16(0), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(data.length), u32(data.length),
      u16(nameB.length), u16(0), u16(0), u16(0), u16(0), u32(0),
      u32(offset), nameB
    )
  );

  const centralB = cat(...centrals);
  const eocd = cat(
    new Uint8Array([0x50, 0x4b, 0x05, 0x06]),
    u16(0), u16(0),
    u16(entries.length), u16(entries.length),
    u32(centralB.length), u32(offset), u16(0)
  );

  return cat(...locals, centralB, eocd);
}

// ─── Public: download xlsx ────────────────────────────────────────────────────
export function downloadExcel(
  sheets: { name: string; rows: Row[] }[],
  filename: string
): void {
  const { rows, name } = sheets[0];
  const { sheetXml, ssXml, stylesXml } = buildSheetXml(rows);
  const sheetName = name.slice(0, 31).replace(/[:\\/?*[\]]/g, "_");

  const files = [
    {
      name: "[Content_Types].xml",
      content:
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
        `<Default Extension="xml" ContentType="application/xml"/>` +
        `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
        `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
        `<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>` +
        `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
        `</Types>`,
    },
    {
      name: "_rels/.rels",
      content:
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
        `</Relationships>`,
    },
    {
      name: "xl/workbook.xml",
      content:
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
        `<sheets><sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/></sheets>` +
        `</workbook>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      content:
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
        `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>` +
        `<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
        `</Relationships>`,
    },
    { name: "xl/worksheets/sheet1.xml", content: sheetXml },
    { name: "xl/sharedStrings.xml", content: ssXml },
    { name: "xl/styles.xml", content: stylesXml },
  ];

  const blob = new Blob([buildZip(files)], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Public: parse uploaded xlsx ─────────────────────────────────────────────
export async function parseHoldingsExcel(
  file: File
): Promise<{ holdings: ImportedHolding[]; errors: string[] }> {
  const errors: string[] = [];
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  function readEntry(name: string): string | null {
    const nameB = str2u8(name);
    for (let i = 0; i < bytes.length - 30; i++) {
      if (bytes[i] !== 0x50 || bytes[i+1] !== 0x4b || bytes[i+2] !== 0x03 || bytes[i+3] !== 0x04) continue;
      const fnLen = bytes[i+26] | (bytes[i+27] << 8);
      const extraLen = bytes[i+28] | (bytes[i+29] << 8);
      const fn = bytes.slice(i + 30, i + 30 + fnLen);
      if (fn.length !== nameB.length || !fn.every((b, j) => b === nameB[j])) continue;
      const start = i + 30 + fnLen + extraLen;
      const size = bytes[i+18] | (bytes[i+19] << 8) | (bytes[i+20] << 16) | (bytes[i+21] << 24);
      return new TextDecoder().decode(bytes.slice(start, start + size));
    }
    return null;
  }

  const ssXml = readEntry("xl/sharedStrings.xml");
  const sheetXml = readEntry("xl/worksheets/sheet1.xml");

  if (!sheetXml) {
    return { holdings: [], errors: ["Could not read sheet data. Please ensure it's a valid .xlsx file."] };
  }

  // Parse shared strings
  const ss: string[] = [];
  if (ssXml) {
    for (const m of ssXml.matchAll(/<si>.*?<\/si>/gs)) {
      let val = "";
      for (const t of m[0].matchAll(/<t[^>]*>(.*?)<\/t>/gs)) val += t[1];
      ss.push(val.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'"));
    }
  }

  function cellVal(xml: string): string {
    const t = xml.match(/ t="([^"]+)"/)?.[1];
    const v = xml.match(/<v>([^<]*)<\/v>/)?.[1] ?? "";
    return t === "s" ? (ss[parseInt(v, 10)] ?? "") : v;
  }

  function parseRow(rowXml: string): string[] {
    const cells = [...rowXml.matchAll(/<c [^>]*r="([A-Z]+)\d+"[^>]*>.*?<\/c>/gs)];
    if (!cells.length) return [];
    let maxIdx = 0;
    const indexed: { idx: number; val: string }[] = cells.map((c) => {
      const col = c[1];
      let n = 0;
      for (const ch of col) n = n * 26 + (ch.charCodeAt(0) - 64);
      n -= 1;
      if (n > maxIdx) maxIdx = n;
      return { idx: n, val: cellVal(c[0]) };
    });
    const row = new Array(maxIdx + 1).fill("");
    indexed.forEach(({ idx, val }) => { row[idx] = val; });
    return row;
  }

  const rowMatches = [...sheetXml.matchAll(/<row[^>]*>(.*?)<\/row>/gs)];
  if (rowMatches.length < 2) {
    return { holdings: [], errors: ["Sheet is empty or has only a header row."] };
  }

  const header = parseRow(rowMatches[0][1]).map((h) => h.trim().toLowerCase());
  const idx = {
    ticker: header.findIndex((h) => ["ticker", "symbol", "stock"].includes(h)),
    qty:    header.findIndex((h) => ["qty", "quantity", "shares"].includes(h)),
    price:  header.findIndex((h) => ["price", "avg price", "avg cost", "buy price"].includes(h)),
    date:   header.findIndex((h) => ["date", "buy date"].includes(h)),
  };

  if (idx.ticker < 0 || idx.qty < 0 || idx.price < 0) {
    return {
      holdings: [],
      errors: [
        "Excel sheet must have columns: Ticker, Qty, Price, Date (Date is optional). " +
        "Row 1 must be the header row. Please check column names and try again.",
      ],
    };
  }

  const today = new Date().toISOString().slice(0, 10);
  const holdings: ImportedHolding[] = [];

  for (let i = 1; i < rowMatches.length; i++) {
    const r = parseRow(rowMatches[i][1]);
    if (r.every((c) => !c.trim())) continue;

    const ticker = (r[idx.ticker] ?? "").trim().toUpperCase();
    const qty    = parseFloat((r[idx.qty] ?? "").replace(/,/g, ""));
    const price  = parseFloat((r[idx.price] ?? "").replace(/[₹,$\s,]/g, ""));
    let   date   = idx.date >= 0 ? (r[idx.date] ?? "").trim() : "";

    // Excel serial date number → YYYY-MM-DD
    const serial = parseFloat(date);
    if (!isNaN(serial) && serial > 1000 && serial < 100000) {
      const d = new Date(Math.round((serial - 25569) * 86400 * 1000));
      date = d.toISOString().slice(0, 10);
    }

    if (!ticker || !isFinite(qty) || qty <= 0 || !isFinite(price) || price <= 0) {
      errors.push(
        `Row ${i + 1}: Skipped — invalid data (Ticker: "${ticker}", Qty: ${qty}, Price: ${price}). ` +
        "Ensure all values are filled and positive."
      );
      continue;
    }

    holdings.push({ ticker, qty, price, date: date || today });
  }

  return { holdings, errors };
}

// ─── Styled cell helpers (for use in PortfolioPanel) ─────────────────────────

/** Dark navy header row — white bold text */
export const S_SECTION_HEADER: CellStyle = {
  bold: true, fontSize: 13, fontColor: "FFFFFF", bgColor: "1B2A4A",
};

/** Medium blue sub-header — white bold */
export const S_COL_HEADER: CellStyle = {
  bold: true, fontSize: 10, fontColor: "FFFFFF", bgColor: "2E5A9C", border: true,
};

/** Positive P&L — dark green text */
export const S_GAIN: CellStyle = {
  bold: true, fontColor: "1A6B3A", border: true,
};

/** Negative P&L — red text */
export const S_LOSS: CellStyle = {
  bold: true, fontColor: "C0392B", border: true,
};

/** Totals row — light blue background, bold */
export const S_TOTAL: CellStyle = {
  bold: true, bgColor: "D6E4F7", border: true,
};

/** Metadata label — gray italic */
export const S_META_LABEL: CellStyle = {
  italic: true, fontColor: "555555",
};

/** Metric label in summary block */
export const S_METRIC_LABEL: CellStyle = {
  bold: true, fontColor: "1B2A4A",
};

/** Metric value — blue */
export const S_METRIC_VAL: CellStyle = {
  bold: true, fontColor: "2E5A9C",
};

/** Normal data cell with border */
export const S_DATA: CellStyle = { border: true };

/** Alternating row — very light gray */
export const S_ALT_ROW: CellStyle = { bgColor: "F4F7FB", border: true };

/** Indian Rupee number format */
export const FMT_INR = '₹#,##0.00;[Red]-₹#,##0.00';
export const FMT_PCT = '+0.00%;-0.00%';
export const FMT_INT = '#,##0';

/** Convenience: create a styled cell */
export function sc(v: CellValue, s: CellStyle): StyledCell {
  return { v, s };
}

/** Styled cell for a P&L number (green if >= 0, red if < 0) */
export function plCell(v: number | null | undefined, label?: string): StyledCell {
  const n = v ?? 0;
  const style: CellStyle = n >= 0 ? S_GAIN : S_LOSS;
  return { v: label ?? (n >= 0 ? `▲ ${n.toFixed(2)}` : `▼ ${Math.abs(n).toFixed(2)}`), s: style };
}
