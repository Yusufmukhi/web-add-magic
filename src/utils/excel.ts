/**
 * Zero-dependency xlsx writer — dark-themed portfolio report.
 * Matches the reference design: dark navy bg, Calibri, real number values,
 * Indian rupee format, date serials, colour-coded P&L rows.
 */

// ─── Types ────────────────────────────────────────────────────────────────────
type CellValue = string | number | null | undefined;

export interface CellDef {
  v: CellValue;
  s: number;          // style index (into cellXfs)
  t?: "s" | "n";     // "s"=shared-string, "n"=number; omit → auto
}

export interface ImportedHolding {
  ticker: string;
  qty: number;
  price: number;
  date: string;
}

// ─── XML helpers ──────────────────────────────────────────────────────────────
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
}
function col(n: number): string {
  let s = "";
  while (n >= 0) { s = String.fromCharCode((n % 26) + 65) + s; n = Math.floor(n / 26) - 1; }
  return s;
}

// ─── Date helpers ─────────────────────────────────────────────────────────────
/** Convert YYYY-MM-DD string to Excel serial date (days since 1900-01-00) */
export function toSerial(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  // Excel epoch: 1 = 1900-01-01, but Excel wrongly counts 1900 as leap year (+1)
  return Math.floor((d.getTime() - Date.UTC(1899, 11, 30)) / 86400000);
}

// ─── Style indices (must match STYLES_XML below) ──────────────────────────────
export const S = {
  DEFAULT:        0,
  // Section title row: bold 14pt white on deep navy
  SECTION_TITLE:  1,
  SECTION_EMPTY:  2,   // empty cells that share the section title row bg
  // Summary meta label: small teal text on dark bg
  META_LABEL:     3,
  // Summary value cells
  META_DATE:      4,   // date serial with dd-mmm-yyyy
  META_EMPTY:     5,   // spacer on dark-bg rows
  // Column headers: bold white on mid-navy, thin border
  COL_HEADER:     6,
  COL_HEADER_EMPTY: 7, // empty header cells (no text, same bg)
  // Data rows — base (dark row 1)
  DATA_LABEL:     8,   // left label, dark text, no currency
  DATA_INR:       9,   // ₹ number, dark text
  DATA_PCT:       10,  // % number
  DATA_EMPTY:     11,  // empty spacer
  // Data rows — highlighted green (current value / net worth)
  DATA_INR_G:     12,  // ₹ number green text
  DATA_INR_B:     13,  // ₹ number blue text (cash)
  DATA_PCT_G:     14,  // CAGR % green
  // Performance rows
  DATA_PLAIN:     15,  // plain number (years)
  // Holdings data: alternating dark rows
  HOLD_TEXT:      16,  // ticker / name text, white, border, row A
  HOLD_INR:       17,  // ₹, white, border, row A
  HOLD_PCT:       18,  // %, white, border — P/L%
  HOLD_REALIZED:  19,  // realized number, gold text
  HOLD_DAYS:      20,  // integer days
  HOLD_DATE:      21,  // date serial
  // Totals row
  TOTAL_LABEL:    22,  // bold white label on dark-teal bg
  TOTAL_INR:      23,  // bold ₹ on dark-teal
  TOTAL_EMPTY:    24,  // empty on dark-teal
  // Alternating row (row B, slightly lighter)
  HOLD_TEXT_B:    25,
  HOLD_INR_B_ROW: 26,
  HOLD_PCT_B:     27,
  HOLD_REALIZED_B:28,
  HOLD_DAYS_B:    29,
  HOLD_DATE_B:    30,
  // Sell history
  SELL_DATE:      31,  // date on sell row (dark)
  SELL_TEXT:      32,  // text on sell row
  SELL_INR:       33,  // ₹ on sell row
  SELL_PROFIT_G:  34,  // profit — green bold
  SELL_DAYS:      35,  // days integer
  SELL_LTCG:      36,  // LTCG badge — green bold on green-tinted
  SELL_STCG:      37,  // STCG badge — yellow bold on yellow-tinted
  SELL_EMPTY:     38,  // spacer
  SELL_DATE_B:    39,  // sell row B
  SELL_TEXT_B:    40,
  SELL_INR_B:     41,
  SELL_PROFIT_R:  42,  // loss — red bold
  // Timeline event colour badges
  EVT_BUY:        43,  // bold green on green-tint
  EVT_SELL:       44,  // bold red on red-tint
  EVT_DEPOSIT:    45,  // bold blue on blue-tint
  EVT_EMPTY:      38,  // reuse SELL_EMPTY
};

// ─── Hardcoded styles XML ─────────────────────────────────────────────────────
// LIGHT THEME palette:
//   Page bg:            #FFFFFF
//   Section bar bg:     #E5E7EB  (light grey, dark text)
//   Meta strip bg:      #F3F4F6
//   Header / Total bg:  #1F2937  (dark slate, white bold text — for contrast)
//   Alt row bg:         #F9FAFB
//   Green text:         #15803D   Green tint: #DCFCE7   (profit / buy / deposit)
//   Red text:           #B91C1C   Red tint:   #FEE2E2   (loss / sell / withdraw)
//   Blue text:          #1D4ED8   Blue tint:  #DBEAFE   (cash)
//   Amber text:         #B45309   Amber tint: #FEF3C7   (realized / STCG)
//   Dark text:          #111827   Muted text: #6B7280

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="5">
  <numFmt numFmtId="164" formatCode="General"/>
  <numFmt numFmtId="165" formatCode="dd\\-mmm\\-yyyy"/>
  <numFmt numFmtId="166" formatCode="[$₹-hi-IN]#,##0"/>
  <numFmt numFmtId="167" formatCode="#,##0.00\\%"/>
  <numFmt numFmtId="168" formatCode="#,##0"/>
</numFmts>
<fonts count="15">
  <font><sz val="11"/><color rgb="FF111827"/><name val="Calibri"/><family val="2"/></font>
  <font><b/><sz val="14"/><color rgb="FF111827"/><name val="Calibri"/><family val="2"/></font>
  <font><sz val="9"/><color rgb="FF6B7280"/><name val="Calibri"/><family val="2"/></font>
  <font><b/><sz val="9"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>
  <font><sz val="9"/><color rgb="FF111827"/><name val="Calibri"/><family val="2"/></font>
  <font><b/><sz val="10"/><color rgb="FF111827"/><name val="Calibri"/><family val="2"/></font>
  <font><b/><sz val="10"/><color rgb="FF15803D"/><name val="Calibri"/><family val="2"/></font>
  <font><b/><sz val="10"/><color rgb="FF1D4ED8"/><name val="Calibri"/><family val="2"/></font>
  <font><b/><sz val="10"/><color rgb="FFB45309"/><name val="Calibri"/><family val="2"/></font>
  <font><b/><sz val="9"/><color rgb="FF15803D"/><name val="Calibri"/><family val="2"/></font>
  <font><b/><sz val="9"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>
  <font><b/><sz val="9"/><color rgb="FFB91C1C"/><name val="Calibri"/><family val="2"/></font>
  <font><b/><sz val="9"/><color rgb="FFB45309"/><name val="Calibri"/><family val="2"/></font>
  <font><b/><sz val="9"/><color rgb="FF1D4ED8"/><name val="Calibri"/><family val="2"/></font>
  <font><b/><sz val="9"/><color rgb="FF111827"/><name val="Calibri"/><family val="2"/></font>
</fonts>
<fills count="12">
  <fill><patternFill patternType="none"/></fill>
  <fill><patternFill patternType="gray125"/></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FFE5E7EB"/></patternFill></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FFF3F4F6"/></patternFill></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FF1F2937"/></patternFill></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FFFFFFFF"/></patternFill></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FFDCFCE7"/></patternFill></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FFFEE2E2"/></patternFill></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FFDBEAFE"/></patternFill></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FFFEF3C7"/></patternFill></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FFF9FAFB"/></patternFill></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FF1F2937"/></patternFill></fill>
</fills>
<borders count="3">
  <border><left/><right/><top/><bottom/><diagonal/></border>
  <border><left style="thin"><color rgb="FFE5E7EB"/></left><right style="thin"><color rgb="FFE5E7EB"/></right><top style="thin"><color rgb="FFE5E7EB"/></top><bottom style="thin"><color rgb="FFE5E7EB"/></bottom><diagonal/></border>
  <border><left/><right/><top/><bottom style="thin"><color rgb="FFE5E7EB"/></bottom><diagonal/></border>
</borders>
<cellStyleXfs count="1">
  <xf numFmtId="164" fontId="0" fillId="0" borderId="0"/>
</cellStyleXfs>
<cellXfs count="46">
  <!--  0 DEFAULT           --> <xf numFmtId="164" fontId="0"  fillId="0"  borderId="0" xfId="0"/>
  <!--  1 SECTION_TITLE     --> <xf numFmtId="164" fontId="1"  fillId="2"  borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
  <!--  2 SECTION_EMPTY     --> <xf numFmtId="164" fontId="0"  fillId="2"  borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
  <!--  3 META_LABEL        --> <xf numFmtId="164" fontId="2"  fillId="3"  borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
  <!--  4 META_DATE         --> <xf numFmtId="165" fontId="14" fillId="3"  borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
  <!--  5 META_EMPTY        --> <xf numFmtId="164" fontId="0"  fillId="3"  borderId="2" xfId="0" applyFill="1" applyBorder="1"/>
  <!--  6 COL_HEADER        --> <xf numFmtId="164" fontId="3"  fillId="4"  borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
  <!--  7 COL_HEADER_EMPTY  --> <xf numFmtId="164" fontId="0"  fillId="4"  borderId="1" xfId="0" applyFill="1" applyBorder="1"/>
  <!--  8 DATA_LABEL        --> <xf numFmtId="164" fontId="5"  fillId="5"  borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
  <!--  9 DATA_INR          --> <xf numFmtId="166" fontId="5"  fillId="5"  borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
  <!-- 10 DATA_PCT          --> <xf numFmtId="167" fontId="5"  fillId="5"  borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
  <!-- 11 DATA_EMPTY        --> <xf numFmtId="164" fontId="0"  fillId="5"  borderId="1" xfId="0" applyFill="1" applyBorder="1"/>
  <!-- 12 DATA_INR_G        --> <xf numFmtId="166" fontId="6"  fillId="5"  borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
  <!-- 13 DATA_INR_B        --> <xf numFmtId="166" fontId="7"  fillId="5"  borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
  <!-- 14 DATA_PCT_G        --> <xf numFmtId="167" fontId="6"  fillId="5"  borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
  <!-- 15 DATA_PLAIN        --> <xf numFmtId="164" fontId="4"  fillId="5"  borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
  <!-- 16 HOLD_TEXT A       --> <xf numFmtId="164" fontId="4"  fillId="5"  borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
  <!-- 17 HOLD_INR A        --> <xf numFmtId="166" fontId="4"  fillId="5"  borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
  <!-- 18 HOLD_PCT A        --> <xf numFmtId="167" fontId="4"  fillId="5"  borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
  <!-- 19 HOLD_REALIZED A   --> <xf numFmtId="166" fontId="8"  fillId="5"  borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
  <!-- 20 HOLD_DAYS A       --> <xf numFmtId="168" fontId="4"  fillId="5"  borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
  <!-- 21 HOLD_DATE A       --> <xf numFmtId="165" fontId="4"  fillId="5"  borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
  <!-- 22 TOTAL_LABEL       --> <xf numFmtId="164" fontId="10" fillId="11" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
  <!-- 23 TOTAL_INR         --> <xf numFmtId="166" fontId="10" fillId="11" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
  <!-- 24 TOTAL_EMPTY       --> <xf numFmtId="164" fontId="0"  fillId="11" borderId="1" xfId="0" applyFill="1" applyBorder="1"/>
  <!-- 25 HOLD_TEXT B       --> <xf numFmtId="164" fontId="4"  fillId="10" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
  <!-- 26 HOLD_INR B        --> <xf numFmtId="166" fontId="4"  fillId="10" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
  <!-- 27 HOLD_PCT B        --> <xf numFmtId="167" fontId="4"  fillId="10" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
  <!-- 28 HOLD_REALIZED B   --> <xf numFmtId="166" fontId="8"  fillId="10" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
  <!-- 29 HOLD_DAYS B       --> <xf numFmtId="168" fontId="4"  fillId="10" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
  <!-- 30 HOLD_DATE B       --> <xf numFmtId="165" fontId="4"  fillId="10" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
  <!-- 31 SELL_DATE A       --> <xf numFmtId="165" fontId="4"  fillId="5"  borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
  <!-- 32 SELL_TEXT A       --> <xf numFmtId="164" fontId="4"  fillId="5"  borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
  <!-- 33 SELL_INR A        --> <xf numFmtId="166" fontId="4"  fillId="5"  borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
  <!-- 34 SELL_PROFIT_G     --> <xf numFmtId="166" fontId="9"  fillId="6"  borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
  <!-- 35 SELL_DAYS A       --> <xf numFmtId="168" fontId="4"  fillId="5"  borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
  <!-- 36 SELL_LTCG         --> <xf numFmtId="164" fontId="9"  fillId="6"  borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
  <!-- 37 SELL_STCG         --> <xf numFmtId="164" fontId="12" fillId="9"  borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
  <!-- 38 SELL_EMPTY/EVT_EMPTY --> <xf numFmtId="164" fontId="0" fillId="5" borderId="1" xfId="0" applyFill="1" applyBorder="1"/>
  <!-- 39 SELL_DATE B       --> <xf numFmtId="165" fontId="4"  fillId="10" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
  <!-- 40 SELL_TEXT B       --> <xf numFmtId="164" fontId="4"  fillId="10" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
  <!-- 41 SELL_INR B        --> <xf numFmtId="166" fontId="4"  fillId="10" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
  <!-- 42 SELL_PROFIT_R     --> <xf numFmtId="166" fontId="11" fillId="7"  borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
  <!-- 43 EVT_BUY           --> <xf numFmtId="164" fontId="9"  fillId="6"  borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
  <!-- 44 EVT_SELL          --> <xf numFmtId="164" fontId="11" fillId="7"  borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
  <!-- 45 EVT_DEPOSIT       --> <xf numFmtId="164" fontId="13" fillId="8"  borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

// ─── Sheet builder ────────────────────────────────────────────────────────────
type RowSpec = (CellDef | null)[];  // null = skip (empty cell)

function buildSheetXml(rows: RowSpec[], colWidths: number[]): { sheetXml: string; ssXml: string } {
  const ss: string[] = [];
  const ssMap = new Map<string, number>();

  function si(v: string): number {
    if (ssMap.has(v)) return ssMap.get(v)!;
    const i = ss.length;
    ss.push(v);
    ssMap.set(v, i);
    return i;
  }

  const colDefs = colWidths
    .map((w, i) => `<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1" collapsed="false" hidden="false" outlineLevel="0"/>`)
    .join("");

  const dataRows = rows.map((row, ri) => {
    if (row.length === 0) return ""; // blank row — omit entirely (row number gap creates blank)
    const cells = row.map((cell, ci) => {
      if (!cell) return "";
      const ref = `${col(ci)}${ri + 1}`;
      const { v, s } = cell;
      if (v === null || v === undefined || v === "") return `<c r="${ref}" s="${s}"/>`;
      if (typeof v === "number" && isFinite(v)) {
        return `<c r="${ref}" s="${s}" t="n"><v>${v}</v></c>`;
      }
      // string → shared string
      const idx = si(esc(String(v)));
      return `<c r="${ref}" s="${s}" t="s"><v>${idx}</v></c>`;
    }).join("");
    return `<row r="${ri+1}" customHeight="true" ht="16.5">${cells}</row>`;
  }).filter(Boolean).join("");

  const sheetXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<sheetPr><tabColor rgb="FF1A6B3C"/></sheetPr>` +
    `<sheetViews><sheetView workbookViewId="0" tabSelected="1">` +
    `<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>` +
    `</sheetView></sheetViews>` +
    `<cols>${colDefs}</cols>` +
    `<sheetData>${dataRows}</sheetData>` +
    `</worksheet>`;

  const ssXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${ss.length}" uniqueCount="${ss.length}">` +
    ss.map((s) => `<si><t xml:space="preserve">${s}</t></si>`).join("") +
    `</sst>`;

  return { sheetXml, ssXml };
}

// ─── ZIP builder (store, no compression) ─────────────────────────────────────
// FIX: use TextEncoder instead of charCode-truncating loop so non-ASCII chars
// (e.g. special characters in company names) don't corrupt the XML.
function s2u(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}
function crc32(d: Uint8Array): number {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) { let c = i; for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[i] = c; }
  let crc = 0xffffffff;
  for (let i = 0; i < d.length; i++) crc = t[(crc ^ d[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function u32(n: number) { return new Uint8Array([n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff]); }
function u16(n: number) { return new Uint8Array([n & 0xff, (n >> 8) & 0xff]); }
function cat(...a: Uint8Array[]) {
  const out = new Uint8Array(a.reduce((s, x) => s + x.length, 0));
  let off = 0; a.forEach((x) => { out.set(x, off); off += x.length; }); return out;
}
function buildZip(files: { name: string; content: string }[]): Uint8Array {
  const entries: { nb: Uint8Array; data: Uint8Array; crc: number; off: number }[] = [];
  const locals: Uint8Array[] = [];
  let offset = 0;
  files.forEach(({ name, content }) => {
    const nb = s2u(name), data = s2u(content), crc = crc32(data);
    const local = cat(new Uint8Array([0x50,0x4b,0x03,0x04]),u16(20),u16(0),u16(0),u16(0),u16(0),u32(crc),u32(data.length),u32(data.length),u16(nb.length),u16(0),nb,data);
    entries.push({ nb, data, crc, off: offset });
    locals.push(local);
    offset += local.length;
  });
 const centrals = entries.map(({ nb, data, crc, off }) =>
  cat(new Uint8Array([0x50,0x4b,0x01,0x02]),
    u16(20),u16(20),u16(0),u16(0),u16(0),u16(0),
    u32(crc),u32(data.length),u32(data.length),
    u16(nb.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(off),nb));

  const cb = cat(...centrals);
  const eocd = cat(new Uint8Array([0x50,0x4b,0x05,0x06]),u16(0),u16(0),u16(entries.length),u16(entries.length),u32(cb.length),u32(offset),u16(0));
  return cat(...locals, cb, eocd);
}

// ─── Public API ───────────────────────────────────────────────────────────────
export function downloadExcel(rows: RowSpec[], colWidths: number[], filename: string): void {
  const { sheetXml, ssXml } = buildSheetXml(rows, colWidths);
  const files = [
    { name: "[Content_Types].xml", content:
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
      `<Default Extension="xml" ContentType="application/xml"/>` +
      `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
      `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
      `<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>` +
      `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
      `</Types>` },
    { name: "_rels/.rels", content:
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
      `</Relationships>` },
    { name: "xl/workbook.xml", content:
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
      `<sheets><sheet name="Portfolio Report" sheetId="1" r:id="rId1"/></sheets>` +
      `</workbook>` },
    { name: "xl/_rels/workbook.xml.rels", content:
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
      `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>` +
      `<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
      `</Relationships>` },
    { name: "xl/worksheets/sheet1.xml", content: sheetXml },
    { name: "xl/sharedStrings.xml", content: ssXml },
    { name: "xl/styles.xml", content: STYLES_XML },
  ];
  const blob = new Blob([buildZip(files)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ─── Helpers for building rows ────────────────────────────────────────────────
export const n = (v: number | null | undefined, s: number): CellDef => ({ v: v ?? null, s });
export const t = (v: string | null | undefined, s: number): CellDef => ({ v: v ?? null, s });
export const empty = (s: number): CellDef => ({ v: null, s });
export const NCOLS = 11; // number of columns in the sheet

// ─── Public: parse uploaded xlsx ─────────────────────────────────────────────
export async function parseHoldingsExcel(file: File): Promise<{ holdings: ImportedHolding[]; errors: string[] }> {
  const errors: string[] = [];
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  function readEntry(name: string): string | null {
    const nb = s2u(name);
    for (let i = 0; i < bytes.length - 30; i++) {
      if (bytes[i] !== 0x50 || bytes[i+1] !== 0x4b || bytes[i+2] !== 0x03 || bytes[i+3] !== 0x04) continue;
      const fnLen = bytes[i+26] | (bytes[i+27] << 8);
      const extraLen = bytes[i+28] | (bytes[i+29] << 8);
      const fn = bytes.slice(i + 30, i + 30 + fnLen);
      if (fn.length !== nb.length || !fn.every((b, j) => b === nb[j])) continue;
      const start = i + 30 + fnLen + extraLen;
      const size = bytes[i+18] | (bytes[i+19] << 8) | (bytes[i+20] << 16) | (bytes[i+21] << 24);
      return new TextDecoder().decode(bytes.slice(start, start + size));
    }
    return null;
  }

  const ssXml = readEntry("xl/sharedStrings.xml");
  const sheetXml = readEntry("xl/worksheets/sheet1.xml");
  if (!sheetXml) return { holdings: [], errors: ["Could not read sheet data."] };

  const ss: string[] = [];
  if (ssXml) {
    for (const m of ssXml.matchAll(/<si>.*?<\/si>/gs)) {
      let val = "";
      for (const t2 of m[0].matchAll(/<t[^>]*>(.*?)<\/t>/gs)) val += t2[1];
      ss.push(val.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'"));
    }
  }

  function cellVal(xml: string): string {
    const tp = xml.match(/ t="([^"]+)"/)?.[1];
    const v = xml.match(/<v>([^<]*)<\/v>/)?.[1] ?? "";
    return tp === "s" ? (ss[parseInt(v, 10)] ?? "") : v;
  }
  function parseRow(rowXml: string): string[] {
    const cells = [...rowXml.matchAll(/<c [^>]*r="([A-Z]+)\d+"[^>]*>.*?<\/c>/gs)];
    if (!cells.length) return [];
    let maxIdx = 0;
    const indexed = cells.map((c) => {
      const co = c[1]; let nn = 0;
      for (const ch of co) nn = nn * 26 + (ch.charCodeAt(0) - 64);
      nn -= 1; if (nn > maxIdx) maxIdx = nn;
      return { idx: nn, val: cellVal(c[0]) };
    });
    const row = new Array(maxIdx + 1).fill("");
    indexed.forEach(({ idx, val }) => { row[idx] = val; });
    return row;
  }

  const rowMatches = [...sheetXml.matchAll(/<row[^>]*>(.*?)<\/row>/gs)];
  if (rowMatches.length < 2) return { holdings: [], errors: ["Sheet is empty."] };

  // Parse all rows into string arrays
  const allRows = rowMatches.map((m) => parseRow(m[1]));

  const today = new Date().toISOString().slice(0, 10);
  const holdings: ImportedHolding[] = [];

  // ── Detect broker format (Angel One / Zerodha style) ─────────────────────
  // Broker files have metadata rows at top, then a "Holding Details" marker row,
  // followed by the actual column headers, then data rows.
  // Key column names: "Scrip/Contract", "Quantity", "Avg Trading Price", "Date of Download"
  const isBrokerFormat = allRows.some((r) =>
    r.some((c) => /scrip|holding details|avg trading price/i.test(c))
  );

  if (isBrokerFormat) {
    // Extract "Date of Download" from metadata rows (used as buy date fallback)
    let brokerDate = today;
    for (const r of allRows) {
      const joined = r.join("\t");
      const dm = joined.match(/date of download\s*[\t:]+\s*([\d\-\/]+)/i);
      if (dm) {
        // Parse the date — could be YYYY-MM-DD, DD/MM/YYYY, or Excel serial
        const raw = dm[1].trim();
        const serial = parseFloat(raw);
        if (!isNaN(serial) && serial > 1000 && serial < 100000) {
          brokerDate = new Date(Math.round((serial - 25569) * 86400 * 1000)).toISOString().slice(0, 10);
        } else if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
          brokerDate = raw;
        } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(raw)) {
          const [d, mo, y] = raw.split("/");
          brokerDate = `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
        }
        break;
      }
      // Also check if a cell value alone is a date-like value
      for (let ci = 0; ci < r.length - 1; ci++) {
        if (/date of download/i.test(r[ci])) {
          const raw = (r[ci + 1] ?? "").trim();
          const serial = parseFloat(raw);
          if (!isNaN(serial) && serial > 1000 && serial < 100000) {
            brokerDate = new Date(Math.round((serial - 25569) * 86400 * 1000)).toISOString().slice(0, 10);
          } else if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
            brokerDate = raw;
          }
          break;
        }
      }
    }

    // Find the header row — the row containing "Scrip/Contract" or similar
    let headerRowIdx = -1;
    for (let i = 0; i < allRows.length; i++) {
      if (allRows[i].some((c) => /scrip[\s\/]*contract/i.test(c))) {
        headerRowIdx = i;
        break;
      }
    }
    if (headerRowIdx < 0) {
      return { holdings: [], errors: ["Could not find 'Scrip/Contract' header row in broker file."] };
    }

    const header = allRows[headerRowIdx].map((h) => h.trim().toLowerCase());

    // Map broker column names → indices
    const idxTicker = header.findIndex((h) => /scrip|contract|symbol|stock/i.test(h));
    const idxQty    = header.findIndex((h) => /^quantity$|^qty$/i.test(h));
    const idxPrice  = header.findIndex((h) => /avg trading price|avg cost|avg price|average price/i.test(h));
    // "Blocked_qty" column — we skip rows where all qty is blocked
    const idxBlocked = header.findIndex((h) => /blocked/i.test(h));

    if (idxTicker < 0 || idxQty < 0 || idxPrice < 0) {
      return { holdings: [], errors: [`Broker file missing required columns. Found: ${header.filter(Boolean).join(", ")}`] };
    }

    for (let i = headerRowIdx + 1; i < allRows.length; i++) {
      const r = allRows[i];
      if (r.every((c) => !c.trim())) continue;

      const ticker = (r[idxTicker] ?? "").trim().toUpperCase();
      const qty    = parseFloat((r[idxQty] ?? "").replace(/,/g, ""));
      const price  = parseFloat((r[idxPrice] ?? "").replace(/[₹,$\s,]/g, ""));
      const blocked = idxBlocked >= 0 ? parseFloat((r[idxBlocked] ?? "0").replace(/,/g, "")) || 0 : 0;

      // Skip summary/total rows (non-ticker rows)
      if (!ticker || /^total|^grand total/i.test(ticker)) continue;
      if (!isFinite(qty) || qty <= 0 || !isFinite(price) || price <= 0) {
        errors.push(`Row ${i + 1}: Skipped — Ticker: "${ticker}", Qty: ${qty}, Price: ${price}`);
        continue;
      }

      // Use tradeable qty (qty minus blocked)
      const tradeableQty = Math.max(qty - blocked, qty); // keep full qty for portfolio tracking

      holdings.push({ ticker, qty: tradeableQty, price, date: brokerDate });
    }

    return { holdings, errors };
  }

  // ── Generic flat format: Row 1 = headers, rows 2+ = data ─────────────────
  const header = allRows[0].map((h) => h.trim().toLowerCase());
  const idx = {
    ticker: header.findIndex((h) => ["ticker", "symbol", "stock"].includes(h)),
    qty:    header.findIndex((h) => ["qty", "quantity", "shares"].includes(h)),
    price:  header.findIndex((h) => ["price", "avg price", "avg cost", "buy price"].includes(h)),
    date:   header.findIndex((h) => ["date", "buy date"].includes(h)),
  };
  if (idx.ticker < 0 || idx.qty < 0 || idx.price < 0) {
    return { holdings: [], errors: ["Excel must have columns: Ticker, Qty, Price, Date (optional). Or upload a broker holdings export (Angel One / Zerodha format)."] };
  }

  for (let i = 1; i < allRows.length; i++) {
    const r = allRows[i];
    if (r.every((c) => !c.trim())) continue;
    const ticker = (r[idx.ticker] ?? "").trim().toUpperCase();
    const qty    = parseFloat((r[idx.qty] ?? "").replace(/,/g, ""));
    const price  = parseFloat((r[idx.price] ?? "").replace(/[₹,$\s,]/g, ""));
    let date = idx.date >= 0 ? (r[idx.date] ?? "").trim() : "";
    const serial = parseFloat(date);
    if (!isNaN(serial) && serial > 1000 && serial < 100000) {
      date = new Date(Math.round((serial - 25569) * 86400 * 1000)).toISOString().slice(0, 10);
    }
    if (!ticker || !isFinite(qty) || qty <= 0 || !isFinite(price) || price <= 0) {
      errors.push(`Row ${i + 1}: Skipped — Ticker: "${ticker}", Qty: ${qty}, Price: ${price}`);
      continue;
    }
    holdings.push({ ticker, qty, price, date: date || today });
  }
  return { holdings, errors };
}
