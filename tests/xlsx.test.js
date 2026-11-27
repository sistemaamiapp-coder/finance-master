import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const context = vm.createContext({ TextEncoder, TextDecoder, Uint8Array, DataView, Date, console });
vm.runInContext(fs.readFileSync(path.join(root, "assets/js/xlsx.js"), "utf8"), context);

function readZip(file) {
  const view = new DataView(file.buffer, file.byteOffset, file.byteLength);
  assert.equal(view.getUint32(0, true), 0x04034b50);
  assert.equal(view.getUint32(file.length - 22, true), 0x06054b50);
  const entries = [];
  let offset = 0;
  while (view.getUint32(offset, true) === 0x04034b50) {
    const method = view.getUint16(offset + 8, true);
    const size = view.getUint32(offset + 18, true);
    const original = view.getUint32(offset + 22, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const name = new TextDecoder().decode(file.slice(offset + 30, offset + 30 + nameLength));
    const start = offset + 30 + nameLength + extraLength;
    const content = file.slice(start, start + size);
    assert.equal(method, 0);
    assert.equal(content.length, original);
    entries.push({ name, content: new TextDecoder().decode(content) });
    offset = start + size;
  }
  return entries;
}

test("XLSX é um ZIP universal com textos inertes e caracteres escapados", () => {
  const file = context.FMXlsx.buildXlsx([{ name: "Dados & vendas", rows: [
    ["Descrição", "Valor"],
    ["=1+1", 12.5],
    ["+COMANDO", 0],
    ["@SOMA", -3],
    ["Café & <chá> \"especial\"", 7],
  ] }]);
  const entries = readZip(file);
  const sheet = entries.find((entry) => entry.name === "xl/worksheets/sheet1.xml").content;
  assert.ok(entries.some((entry) => entry.name === "[Content_Types].xml"));
  assert.equal((sheet.match(/t="inlineStr"/g) || []).length, 6);
  assert.equal(sheet.includes("<f>"), false);
  assert.ok(sheet.includes("Café &amp; &lt;chá&gt; &quot;especial&quot;"));
  assert.ok(sheet.includes("<v>12.5</v>"));
});

test("XLSX aplica data, moeda e cabeçalho sem atributos duplicados", () => {
  const file = context.FMXlsx.buildXlsx([{ name: "Financeiro", rows: [
    [{ value: "Data", style: context.FMXlsx.STYLES.header }, { value: "Valor", style: context.FMXlsx.STYLES.header }],
    [{ value: "2026-11-27", style: context.FMXlsx.STYLES.date }, { value: 1234.56, style: context.FMXlsx.STYLES.currency }],
  ] }]);
  const sheet = readZip(file).find((entry) => entry.name === "xl/worksheets/sheet1.xml").content;
  assert.ok(sheet.includes('<c r="A2" s="6"><v>46353</v></c>'));
  assert.ok(sheet.includes('<c r="B2" s="5"><v>1234.56</v></c>'));
  assert.equal(/s="6" s="/.test(sheet), false);
  assert.equal((sheet.match(/s="1"/g) || []).length, 2);
});
