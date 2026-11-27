(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.FMXlsx = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

const STYLES = Object.freeze({
  default: 0,
  header: 1,
  title: 2,
  subtitle: 3,
  section: 4,
  currency: 5,
  date: 6,
  integer: 7,
  percent: 8,
  total: 9,
  wrapped: 10,
  number: 11,
});

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function crc32(buffer) {
  let value = 0xffffffff;
  for (const byte of buffer) value = CRC_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function concatBuffers(buffers) {
  const result = new Uint8Array(buffers.reduce((total, buffer) => total + buffer.length, 0));
  let offset = 0;
  for (const buffer of buffers) {
    result.set(buffer, offset);
    offset += buffer.length;
  }
  return result;
}

function bytes(value) {
  return new TextEncoder().encode(String(value));
}

function uint16(value) {
  const result = new Uint8Array(2);
  new DataView(result.buffer).setUint16(0, value, true);
  return result;
}

function uint32(value) {
  const result = new Uint8Array(4);
  new DataView(result.buffer).setUint32(0, value, true);
  return result;
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
}

function columnName(index) {
  if (!Number.isInteger(index) || index < 1 || index > 16384) {
    throw new Error(`Coluna XLSX inválida: ${index}`);
  }
  let value = index;
  let result = "";
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

function dosDateTime(date) {
  const year = Math.max(1980, date.getUTCFullYear());
  const time = (date.getUTCHours() << 11) | (date.getUTCMinutes() << 5) | Math.floor(date.getUTCSeconds() / 2);
  const day = ((year - 1980) << 9) | ((date.getUTCMonth() + 1) << 5) | date.getUTCDate();
  return { time, day };
}

function zipEntries(files, date) {
  if (files.length > 65535) throw new Error("XLSX excede o limite de 65.535 arquivos.");
  const locals = [];
  const centrals = [];
  let offset = 0;
  const { time, day } = dosDateTime(date);

  files.forEach((file) => {
    const name = bytes(file.name);
    const content = typeof file.content === "string" ? bytes(file.content) : new Uint8Array(file.content.buffer, file.content.byteOffset, file.content.byteLength);
    const checksum = crc32(content);
    const local = concatBuffers([
      uint32(0x04034b50), uint16(20), uint16(0x0800), uint16(0), uint16(time), uint16(day),
      uint32(checksum), uint32(content.length), uint32(content.length), uint16(name.length), uint16(0),
    ]);
    locals.push(local, name, content);

    const central = concatBuffers([
      uint32(0x02014b50), uint16(20), uint16(20), uint16(0x0800), uint16(0), uint16(time), uint16(day),
      uint32(checksum), uint32(content.length), uint32(content.length), uint16(name.length),
      uint16(0), uint16(0), uint16(0), uint16(0), uint32(0), uint32(offset),
    ]);
    centrals.push(central, name);
    offset += local.length + name.length + content.length;
  });

  const centralBuffer = concatBuffers(centrals);
  const end = concatBuffers([
    uint32(0x06054b50), uint16(0), uint16(0), uint16(files.length), uint16(files.length),
    uint32(centralBuffer.length), uint32(offset), uint16(0),
  ]);
  return concatBuffers([...locals, centralBuffer, end]);
}

function toExcelSerial(value) {
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) throw new Error("Data XLSX inválida.");
    return value.getTime() / 86400000 + 25569;
  }
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value)) {
    const normalized = value.length === 10 ? `${value}T00:00:00.000Z` : value;
    const parsed = Date.parse(normalized);
    if (Number.isFinite(parsed)) return parsed / 86400000 + 25569;
  }
  throw new Error(`Data XLSX inválida: ${value}`);
}

function xmlCell(cell, reference) {
  const input = cell && typeof cell === "object" && !Array.isArray(cell) ? cell : { value: cell };
  const value = input.value;
  let style = Number.isInteger(input.style) ? input.style : STYLES.default;
  const attributes = [`r="${reference}"`];
  if (style) attributes.push(`s="${style}"`);

  if (input.formula) {
    const formula = String(input.formula).replace(/^=/, "");
    if (value === null || value === undefined) {
      attributes.push('t="str"');
      return `<c ${attributes.join(" ")}><f>${escapeXml(formula)}</f><v></v></c>`;
    }
    if (typeof value === "string") {
      attributes.push('t="str"');
      return `<c ${attributes.join(" ")}><f>${escapeXml(formula)}</f><v>${escapeXml(value)}</v></c>`;
    }
    return `<c ${attributes.join(" ")}><f>${escapeXml(formula)}</f><v>${escapeXml(value)}</v></c>`;
  }

  if (value === null || value === undefined || value === "") return style ? `<c ${attributes.join(" ")}/>` : "";
  if (typeof value === "boolean") {
    attributes.push('t="b"');
    return `<c ${attributes.join(" ")}><v>${value ? 1 : 0}</v></c>`;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`Número XLSX inválido em ${reference}.`);
    return `<c ${attributes.join(" ")}><v>${value}</v></c>`;
  }
  if (value instanceof Date || style === STYLES.date) {
    if (!style) {
      style = STYLES.date;
      attributes.push(`s="${style}"`);
    }
    return `<c ${attributes.join(" ")}><v>${toExcelSerial(value)}</v></c>`;
  }

  const text = String(value);
  if (text.length > 32767) throw new Error(`Texto excede 32.767 caracteres em ${reference}.`);
  attributes.push('t="inlineStr"');
  return `<c ${attributes.join(" ")}><is><t xml:space="preserve">${escapeXml(text)}</t></is></c>`;
}

function sheetXml(sheet, generatedAt) {
  const rows = Array.isArray(sheet.rows) ? sheet.rows : [];
  if (rows.length > 1048576) throw new Error(`Planilha "${sheet.name}" excede o limite de linhas.`);
  const maxColumns = rows.reduce((max, row) => Math.max(max, Array.isArray(row) ? row.length : 0), 1);
  if (maxColumns > 16384) throw new Error(`Planilha "${sheet.name}" excede o limite de colunas.`);

  const freezeRows = Math.max(0, Math.trunc(sheet.freezeRows || 0));
  const freezeColumns = Math.max(0, Math.trunc(sheet.freezeColumns || 0));
  let pane = "";
  if (freezeRows || freezeColumns) {
    const activePane = freezeRows && freezeColumns ? "bottomRight" : freezeRows ? "bottomLeft" : "topRight";
    const splits = [
      freezeColumns ? `xSplit="${freezeColumns}"` : "",
      freezeRows ? `ySplit="${freezeRows}"` : "",
      `topLeftCell="${columnName(freezeColumns + 1)}${freezeRows + 1}"`,
      `activePane="${activePane}"`,
      'state="frozen"',
    ].filter(Boolean);
    pane = `<pane ${splits.join(" ")}/>`;
  }

  const widths = Array.isArray(sheet.columnWidths) ? sheet.columnWidths : [];
  const cols = Array.from({ length: maxColumns }, (_, index) => {
    const width = Number(widths[index]);
    return `<col min="${index + 1}" max="${index + 1}" width="${Number.isFinite(width) && width > 0 ? width : 14}" customWidth="1"/>`;
  }).join("");

  const data = rows.map((row, rowIndex) => {
    const values = Array.isArray(row) ? row : [];
    const height = Number(sheet.rowHeights?.[rowIndex]);
    const rowAttributes = [`r="${rowIndex + 1}"`];
    if (Number.isFinite(height) && height > 0) {
      rowAttributes.push(`ht="${height}"`, 'customHeight="1"');
    }
    const cells = values.map((cell, columnIndex) => xmlCell(cell, `${columnName(columnIndex + 1)}${rowIndex + 1}`)).join("");
    return `<row ${rowAttributes.join(" ")}>${cells}</row>`;
  }).join("");

  const autoFilter = sheet.autoFilter ? `<autoFilter ref="${escapeXml(sheet.autoFilter)}"/>` : "";
  const merges = Array.isArray(sheet.merges) && sheet.merges.length
    ? `<mergeCells count="${sheet.merges.length}">${sheet.merges.map((ref) => `<mergeCell ref="${escapeXml(ref)}"/>`).join("")}</mergeCells>`
    : "";
  const orientation = sheet.page?.orientation === "portrait" ? "portrait" : "landscape";
  const generated = generatedAt.toLocaleString("pt-BR", { timeZone: "UTC" });

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>
  <dimension ref="A1:${columnName(maxColumns)}${Math.max(1, rows.length)}"/>
  <sheetViews><sheetView workbookViewId="0" showGridLines="0">${pane}</sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="15"/>
  <cols>${cols}</cols>
  <sheetData>${data}</sheetData>
  ${autoFilter}
  ${merges}
  <printOptions horizontalCentered="1"/>
  <pageMargins left="0.25" right="0.25" top="0.5" bottom="0.5" header="0.2" footer="0.2"/>
  <pageSetup paperSize="9" orientation="${orientation}" fitToWidth="1" fitToHeight="0"/>
  <headerFooter><oddFooter>&amp;L&amp;8Gerado em ${escapeXml(generated)}&amp;R&amp;8Página &amp;P de &amp;N</oddFooter></headerFooter>
</worksheet>`;
}

function workbookXml(sheets) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <fileVersion appName="xl" lastEdited="7" lowestEdited="7" rupBuild="0"/>
  <workbookPr defaultThemeVersion="166925"/>
  <bookViews><workbookView xWindow="0" yWindow="0" windowWidth="24000" windowHeight="12000"/></bookViews>
  <sheets>${sheets.map((sheet, index) => `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("")}</sheets>
  <calcPr calcId="191029" fullCalcOnLoad="1"/>
</workbook>`;
}

function workbookRelationships(sheetCount) {
  const sheets = Array.from({ length: sheetCount }, (_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets}<Relationship Id="rId${sheetCount + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
}

function contentTypes(sheetCount) {
  const sheets = Array.from({ length: sheetCount }, (_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${sheets}
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`;
}

function rootRelationships() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;
}

function stylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="2">
    <numFmt numFmtId="164" formatCode="[$R$-pt-BR] #,##0.00;[Red]-[$R$-pt-BR] #,##0.00"/>
    <numFmt numFmtId="165" formatCode="dd/mm/yyyy"/>
  </numFmts>
  <fonts count="5">
    <font><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font>
    <font><b/><sz val="16"/><color rgb="FF352B3C"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font>
    <font><sz val="10"/><color rgb="FF667085"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font>
    <font><b/><sz val="11"/><color rgb="FF352B3C"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font>
  </fonts>
  <fills count="4">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF352B3C"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF1F4FA"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border><left style="thin"><color rgb="FFD9E1EA"/></left><right style="thin"><color rgb="FFD9E1EA"/></right><top style="thin"><color rgb="FFD9E1EA"/></top><bottom style="thin"><color rgb="FFD9E1EA"/></bottom><diagonal/></border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="12">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
    <xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>
    <xf numFmtId="0" fontId="4" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
    <xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
    <xf numFmtId="1" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
    <xf numFmtId="10" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
    <xf numFmtId="164" fontId="4" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1"/>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
    <xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
  <dxfs count="0"/>
  <tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/>
</styleSheet>`;
}

function coreProperties(date) {
  const timestamp = date.toISOString();
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:creator>Meu Lar Financeiro</dc:creator>
  <cp:lastModifiedBy>Meu Lar Financeiro</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${timestamp}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${timestamp}</dcterms:modified>
</cp:coreProperties>`;
}

function appProperties(sheets) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Meu Lar Financeiro</Application>
  <DocSecurity>0</DocSecurity>
  <ScaleCrop>false</ScaleCrop>
  <HeadingPairs><vt:vector size="2" baseType="variant"><vt:variant><vt:lpstr>Planilhas</vt:lpstr></vt:variant><vt:variant><vt:i4>${sheets.length}</vt:i4></vt:variant></vt:vector></HeadingPairs>
  <TitlesOfParts><vt:vector size="${sheets.length}" baseType="lpstr">${sheets.map((sheet) => `<vt:lpstr>${escapeXml(sheet.name)}</vt:lpstr>`).join("")}</vt:vector></TitlesOfParts>
  <Company></Company>
  <LinksUpToDate>false</LinksUpToDate>
  <SharedDoc>false</SharedDoc>
  <HyperlinksChanged>false</HyperlinksChanged>
  <AppVersion>1.0</AppVersion>
</Properties>`;
}

function normalizeSheets(sheets) {
  if (!Array.isArray(sheets) || sheets.length === 0) throw new Error("Informe ao menos uma planilha para exportar.");
  const names = new Set();
  return sheets.map((sheet) => {
    const name = String(sheet.name || "").trim();
    if (!name || name.length > 31 || /[\\/*?:[\]]/.test(name)) {
      throw new Error(`Nome de planilha inválido: ${name || "(vazio)"}`);
    }
    if (names.has(name.toLocaleLowerCase("pt-BR"))) throw new Error(`Nome de planilha duplicado: ${name}`);
    names.add(name.toLocaleLowerCase("pt-BR"));
    return {
      ...sheet,
      name,
      rows: Array.isArray(sheet.rows) ? sheet.rows.map((row) => Array.isArray(row) ? row : []) : [],
    };
  });
}

function buildXlsx(inputSheets, options = {}) {
  const sheets = normalizeSheets(inputSheets);
  const generatedAt = options.generatedAt instanceof Date && Number.isFinite(options.generatedAt.getTime())
    ? options.generatedAt
    : new Date();
  const files = [
    { name: "[Content_Types].xml", content: contentTypes(sheets.length) },
    { name: "_rels/.rels", content: rootRelationships() },
    { name: "docProps/core.xml", content: coreProperties(generatedAt) },
    { name: "docProps/app.xml", content: appProperties(sheets) },
    { name: "xl/workbook.xml", content: workbookXml(sheets) },
    { name: "xl/_rels/workbook.xml.rels", content: workbookRelationships(sheets.length) },
    { name: "xl/styles.xml", content: stylesXml() },
    ...sheets.map((sheet, index) => ({
      name: `xl/worksheets/sheet${index + 1}.xml`,
      content: sheetXml(sheet, generatedAt),
    })),
  ];
  return zipEntries(files, generatedAt);
}

  return { buildXlsx, columnName, STYLES };
});
