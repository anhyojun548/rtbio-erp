const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, PageNumber, PageBreak, LevelFormat
} = require("docx");

// Constants
const PAGE_WIDTH = 12240;
const MARGIN = 1440;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2; // 9360

const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border };
const cellMargins = { top: 60, bottom: 60, left: 100, right: 100 };

const headerBg = { fill: "2B5797", type: ShadingType.CLEAR };
const altRowBg = { fill: "F2F2F2", type: ShadingType.CLEAR };

function headerCell(text, width) {
  return new TableCell({
    borders, width: { size: width, type: WidthType.DXA },
    shading: headerBg, margins: cellMargins,
    verticalAlign: "center",
    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text, bold: true, color: "FFFFFF", font: "Arial", size: 20 })] })]
  });
}

function cell(text, width, opts = {}) {
  const runs = [];
  // Parse bold markers **text**
  const parts = text.split(/(\*\*[^*]+\*\*)/);
  for (const part of parts) {
    if (part.startsWith("**") && part.endsWith("**")) {
      runs.push(new TextRun({ text: part.slice(2, -2), bold: true, font: "Arial", size: 20, ...(opts.runOpts || {}) }));
    } else {
      runs.push(new TextRun({ text: part, font: "Arial", size: 20, ...(opts.runOpts || {}) }));
    }
  }
  return new TableCell({
    borders, width: { size: width, type: WidthType.DXA },
    shading: opts.shading || undefined,
    margins: cellMargins,
    children: [new Paragraph({ children: runs })]
  });
}

function makeTable(headers, rows, colWidths) {
  const totalWidth = colWidths.reduce((a, b) => a + b, 0);
  return new Table({
    width: { size: totalWidth, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: [
      new TableRow({ children: headers.map((h, i) => headerCell(h, colWidths[i])) }),
      ...rows.map((row, ri) =>
        new TableRow({
          children: row.map((c, ci) => cell(c, colWidths[ci], { shading: ri % 2 === 1 ? altRowBg : undefined }))
        })
      )
    ]
  });
}

function h1(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 360, after: 200 }, children: [new TextRun({ text, font: "Arial" })] });
}
function h2(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 280, after: 160 }, children: [new TextRun({ text, font: "Arial" })] });
}
function h3(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_3, spacing: { before: 200, after: 120 }, children: [new TextRun({ text, font: "Arial" })] });
}
function p(text, opts = {}) {
  const runs = [];
  const parts = text.split(/(\*\*[^*]+\*\*)/);
  for (const part of parts) {
    if (part.startsWith("**") && part.endsWith("**")) {
      runs.push(new TextRun({ text: part.slice(2, -2), bold: true, font: "Arial", size: 22, ...(opts.runOpts || {}) }));
    } else {
      runs.push(new TextRun({ text: part, font: "Arial", size: 22, ...(opts.runOpts || {}) }));
    }
  }
  return new Paragraph({ spacing: { after: 120 }, ...opts, children: runs });
}
function bullet(text, level = 0) {
  const runs = [];
  const parts = text.split(/(\*\*[^*]+\*\*)/);
  for (const part of parts) {
    if (part.startsWith("**") && part.endsWith("**")) {
      runs.push(new TextRun({ text: part.slice(2, -2), bold: true, font: "Arial", size: 22 }));
    } else {
      runs.push(new TextRun({ text: part, font: "Arial", size: 22 }));
    }
  }
  return new Paragraph({
    numbering: { reference: "bullets", level },
    spacing: { after: 60 },
    children: runs
  });
}
function quote(text) {
  return new Paragraph({
    spacing: { after: 120 },
    indent: { left: 720 },
    border: { left: { style: BorderStyle.SINGLE, size: 6, color: "2B5797", space: 8 } },
    children: [new TextRun({ text, font: "Arial", size: 22, italics: true, color: "333333" })]
  });
}
function codeBlock(lines) {
  return lines.map(line =>
    new Paragraph({
      spacing: { after: 0 },
      indent: { left: 360 },
      children: [new TextRun({ text: line, font: "Consolas", size: 18, color: "333333" })]
    })
  );
}
function spacer() {
  return new Paragraph({ spacing: { after: 200 }, children: [] });
}
function checkItem(text) {
  return new Paragraph({
    numbering: { reference: "checklist", level: 0 },
    spacing: { after: 60 },
    children: [new TextRun({ text, font: "Arial", size: 22 })]
  });
}

// Build document
const doc = new Document({
  styles: {
    default: { document: { run: { font: "Arial", size: 22 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 36, bold: true, font: "Arial", color: "1B3A5C" },
        paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, font: "Arial", color: "2B5797" },
        paragraph: { spacing: { before: 280, after: 160 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, font: "Arial", color: "444444" },
        paragraph: { spacing: { before: 200, after: 120 }, outlineLevel: 2 } },
    ]
  },
  numbering: {
    config: [
      { reference: "bullets", levels: [
        { level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
        { level: 1, format: LevelFormat.BULLET, text: "\u25E6", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 1440, hanging: 360 } } } },
      ]},
      { reference: "checklist", levels: [
        { level: 0, format: LevelFormat.BULLET, text: "\u2610", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
      ]},
    ]
  },
  sections: [
    // ===== COVER PAGE =====
    {
      properties: {
        page: {
          size: { width: PAGE_WIDTH, height: 15840 },
          margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN }
        }
      },
      children: [
        spacer(), spacer(), spacer(), spacer(), spacer(), spacer(),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [
          new TextRun({ text: "RTBIO", font: "Arial", size: 72, bold: true, color: "2B5797" })
        ]}),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [
          new TextRun({ text: "\uC5C5\uBB34 \uC790\uB3D9\uD654 \uC2DC\uC2A4\uD15C", font: "Arial", size: 48, color: "333333" })
        ]}),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 400 }, children: [
          new TextRun({ text: "\uC124\uACC4 \uBB38\uC11C", font: "Arial", size: 36, color: "666666" })
        ]}),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 3, color: "2B5797", space: 1 } },
          children: [] }),
        spacer(),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [
          new TextRun({ text: "\uBC84\uC804: v1.2", font: "Arial", size: 24, color: "666666" })
        ]}),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [
          new TextRun({ text: "\uC791\uC131\uC77C: 2026\uB144 4\uC6D4 3\uC77C", font: "Arial", size: 24, color: "666666" })
        ]}),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [
          new TextRun({ text: "\uC791\uC131: \uD558\uB9C8\uB2E4\uB7A9\uC2A4", font: "Arial", size: 24, color: "666666" })
        ]}),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [
          new TextRun({ text: "\uC0C1\uD0DC: \uAC80\uD1A0 \uC911", font: "Arial", size: 24, color: "666666" })
        ]}),
      ]
    },
    // ===== MAIN CONTENT =====
    {
      properties: {
        page: {
          size: { width: PAGE_WIDTH, height: 15840 },
          margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN }
        }
      },
      headers: {
        default: new Header({ children: [
          new Paragraph({ alignment: AlignmentType.RIGHT, children: [
            new TextRun({ text: "RTBIO \uC5C5\uBB34 \uC790\uB3D9\uD654 \uC2DC\uC2A4\uD15C \u2014 \uC124\uACC4 \uBB38\uC11C v1.2", font: "Arial", size: 16, color: "999999" })
          ]})
        ]})
      },
      footers: {
        default: new Footer({ children: [
          new Paragraph({ alignment: AlignmentType.CENTER, children: [
            new TextRun({ text: "\uD558\uB9C8\uB2E4\uB7A9\uC2A4  |  ", font: "Arial", size: 16, color: "999999" }),
            new TextRun({ text: "Page ", font: "Arial", size: 16, color: "999999" }),
            new TextRun({ children: [PageNumber.CURRENT], font: "Arial", size: 16, color: "999999" })
          ]})
        ]})
      },
      children: [
        // 1. 프로젝트 개요
        h1("1. \uD504\uB85C\uC81D\uD2B8 \uAC1C\uC694"),
        h2("\uBC30\uACBD"),
        p("RTBIO\uB294 \uD604\uC7AC \uBC1C\uC8FC \uC811\uC218, \uC7AC\uACE0 \uAD00\uB9AC, \uC815\uC0B0, \uC601\uC5C5 \uB370\uC774\uD130 \uAD00\uB9AC \uB4F1 \uD575\uC2EC \uC6B4\uC601 \uC5C5\uBB34\uB97C \uC5D1\uC140\xB7\uC218\uAE30 \uC911\uC2EC\uC73C\uB85C \uCC98\uB9AC\uD558\uACE0 \uC788\uB2E4. \uC774\uB85C \uC778\uD574 \uC911\uBCF5 \uC785\uB825, \uC624\uAE30\uC785, \uC2E4\uC2DC\uAC04 \uD604\uD669 \uD30C\uC545 \uBD88\uAC00 \uB4F1\uC758 \uBB38\uC81C\uAC00 \uBC1C\uC0DD\uD558\uACE0 \uC788\uC73C\uBA70, \uD5A5\uD6C4 \uC758\uB8CC\uAE30\uAE30 2\uB4F1\uAE09 \uC81C\uD488 \uD310\uB9E4 \uD655\uB300 \uC2DC \uB0A9\uD488 \uC774\uB825 \uBC0F \uCD94\uC801 \uAD00\uB9AC \uC694\uAD6C\uB3C4 \uC99D\uAC00\uD560 \uAC83\uC73C\uB85C \uC608\uC0C1\uB41C\uB2E4."),

        h2("\uBAA9\uD45C"),
        bullet("\uACBD\uC601\uC9C0\uC6D0\uD300 \uC218\uAE30 \uC5C5\uBB34(\uD558\uB8E8 \uC57D 30\uAC74 \uBC1C\uC8FC \uCC98\uB9AC)\uB97C \uC2DC\uC2A4\uD15C \uAE30\uBC18\uC73C\uB85C \uC790\uB3D9\uD654"),
        bullet("\uBD80\uC11C\uBCC4 \uB370\uC774\uD130\uB97C \uD558\uB098\uC758 \uD1B5\uD569 \uC2DC\uC2A4\uD15C\uC73C\uB85C \uAD00\uB9AC"),
        bullet("\uD5A5\uD6C4 \uC571 \uD655\uC7A5, \uC758\uB8CC\uAE30\uAE30 \uCD94\uC801, \uC0DD\uC0B0 \uC5F0\uB3D9\uAE4C\uC9C0 \uB2E8\uACC4\uC801\uC73C\uB85C \uD655\uC7A5 \uAC00\uB2A5\uD55C \uAD6C\uC870 \uAD6C\uCD95"),

        h2("\uC0AC\uC5C5\uC801 \uD3EC\uC9C0\uC154\uB2DD"),
        p("\uBCF8 \uC2DC\uC2A4\uD15C\uC740 RTBIO\uC758 \uC5C5\uBB34 \uD750\uB984\uC5D0 100% \uB9DE\uCDA4 \uC124\uACC4\uB41C **\uCEE4\uC2A4\uD140 ERP**\uB2E4. \uAE30\uC874 \uBC94\uC6A9 ERP \uB300\uBE44 \uC544\uB798\uC640 \uAC19\uC740 \uCC28\uBCC4\uC810\uC744 \uAC16\uB294\uB2E4."),
        makeTable(
          ["\uD56D\uBAA9", "\uAE30\uC874 ERP (\uB354\uC874, SAP \uB4F1)", "\uBCF8 \uC2DC\uC2A4\uD15C"],
          [
            ["\uCEE4\uC2A4\uD130\uB9C8\uC774\uC9D5", "\uC5B4\uB835\uACE0 \uBE44\uC304", "RTBIO \uC5C5\uBB34\uC5D0 100% \uB9DE\uCDA4"],
            ["UI/UX", "\uBCF5\uC7A1\uD55C \uAD6C\uC870", "\uC2E4\uBB34\uC790 \uC911\uC2EC \uB2E8\uC21C \uC124\uACC4"],
            ["\uD655\uC7A5", "\uBAA8\uB4C8 \uAD6C\uB9E4 \uD544\uC694", "\uD544\uC694 \uAE30\uB2A5 \uC9C1\uC811 \uCD94\uAC00"],
            ["\uBE44\uC6A9 \uAD6C\uC870", "\uB77C\uC774\uC120\uC2A4 \uBE44\uC6A9 \uC9C0\uC18D \uBC1C\uC0DD", "\uC720\uC9C0\uBCF4\uC218 \uACC4\uC57D\uC73C\uB85C \uC804\uD658"],
          ],
          [2000, 3680, 3680]
        ),

        // 2. 기존 ERP 관련 방향 선택
        new Paragraph({ children: [new PageBreak()] }),
        h1("2. \uAE30\uC874 ERP \uAD00\uB828 \uBC29\uD5A5 \uC120\uD0DD"),
        p("\uBCF8 \uC2DC\uC2A4\uD15C \uAD6C\uCD95 \uBC29\uC2DD\uC5D0 \uB300\uD574 \uB450 \uAC00\uC9C0 \uC635\uC158\uC744 \uC81C\uC2DC\uD55C\uB2E4."),

        h2("\uC635\uC158 A \u2014 \uB3C5\uB9BD \uC2DC\uC2A4\uD15C \uAD6C\uCD95 (\uAD8C\uC7A5)"),
        p("\uAE30\uC874 ERP\uC640 \uBCC4\uB3C4\uB85C \uC644\uC804\uD788 \uC0C8\uB85C\uC6B4 \uC2DC\uC2A4\uD15C\uC744 \uAD6C\uCD95\uD55C\uB2E4. \uAE30\uC874 ERP\uC758 \uB370\uC774\uD130\uB294 \uC5D1\uC140 \uB0B4\uBCF4\uB0B4\uAE30\uB97C \uD1B5\uD574 \uCD08\uAE30 \uB9C8\uC774\uADF8\uB808\uC774\uC158 \uBC29\uC2DD\uC73C\uB85C \uC774\uC804\uD55C\uB2E4."),
        p("**\uC7A5\uC810**"),
        bullet("RTBIO \uC5C5\uBB34 \uD750\uB984\uC5D0 100% \uB9DE\uCDA4 \uC124\uACC4 \uAC00\uB2A5"),
        bullet("\uAE30\uC874 ERP \uAD6C\uC870\uC5D0 \uC885\uC18D\uB418\uC9C0 \uC54A\uC74C"),
        bullet("\uC7A5\uAE30\uC801\uC73C\uB85C \uC720\uC9C0\uBCF4\uC218\xB7\uD655\uC7A5\uC774 \uC6A9\uC774"),
        bullet("\uC6B4\uC601 \uC2DC\uC2A4\uD15C \uB2E8\uC77C\uD654\uB85C \uB2F4\uB2F9\uC790 \uD63C\uC120 \uC81C\uAC70"),
        p("**\uB2E8\uC810**"),
        bullet("\uCD08\uAE30 \uB370\uC774\uD130 \uB9C8\uC774\uADF8\uB808\uC774\uC158 \uC791\uC5C5 \uD544\uC694"),
        bullet("\uAE30\uC874 ERP\uC640 \uBCD1\uD589 \uC6B4\uC601 \uAE30\uAC04 \uBC1C\uC0DD \uAC00\uB2A5"),

        h2("\uC635\uC158 B \u2014 \uAE30\uC874 ERP \uC5F0\uB3D9\uD615"),
        p("\uAE30\uC874 ERP\uB97C \uC720\uC9C0\uD558\uBA74\uC11C \uBCF8 \uC2DC\uC2A4\uD15C\uC744 \uD504\uB860\uD2B8\uC5D4\uB4DC + \uC790\uB3D9\uD654 \uB808\uC774\uC5B4\uB85C \uC5F0\uACB0\uD55C\uB2E4."),
        p("**\uC7A5\uC810**"),
        bullet("\uAE30\uC874 ERP \uB370\uC774\uD130 \uC989\uC2DC \uD65C\uC6A9 \uAC00\uB2A5"),
        bullet("\uC804\uD658 \uB9AC\uC2A4\uD06C \uB0AE\uC74C"),
        p("**\uB2E8\uC810**"),
        bullet("\uAE30\uC874 ERP \uAD6C\uC870\uC5D0 \uB9DE\uCDB0\uC57C \uD574 \uCEE4\uC2A4\uD130\uB9C8\uC774\uC9D5 \uC81C\uD55C"),
        bullet("\uB450 \uC2DC\uC2A4\uD15C \uAC04 \uB370\uC774\uD130 \uC815\uD569\uC131 \uAD00\uB9AC \uD544\uC694"),
        bullet("\uAE30\uC874 ERP \uBCA4\uB354 \uC758\uC874\uB3C4 \uC720\uC9C0"),
        quote("\uAD8C\uC7A5\uC548: \uC635\uC158 A \u2014 \uAE30\uC874 ERP\uB294 \uC5D1\uC140\uB85C \uB370\uC774\uD130\uB97C \uB0B4\uBCF4\uB0BC \uC218 \uC788\uC5B4 \uCD08\uAE30 \uB9C8\uC774\uADF8\uB808\uC774\uC158\uC774 \uAC00\uB2A5\uD558\uB2E4. \uC7A5\uAE30\uC801\uC73C\uB85C RTBIO \uC5C5\uBB34 \uD655\uC7A5\uC131\uACFC \uC2DC\uC2A4\uD15C \uB2E8\uC77C\uD654\uB97C \uACE0\uB824\uD560 \uB54C \uB3C5\uB9BD \uAD6C\uCD95\uC774 \uB354 \uC720\uB9AC\uD558\uB2E4."),

        // 3. 시스템 아키텍처
        new Paragraph({ children: [new PageBreak()] }),
        h1("3. \uC2DC\uC2A4\uD15C \uC544\uD0A4\uD14D\uCC98"),
        h2("3-1. \uC804\uCCB4 \uAD6C\uC870"),
        ...codeBlock([
          "\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510",
          "\u2502           \uC678\uBD80 \uC0AC\uC6A9\uC790                    \u2502",
          "\u2502   \uB300\uB9AC\uC810 / \uBCD1\uC6D0 (\uC6F9\uD3FC or \uCE74\uCE74\uC624\uD1A1/\uC5D1\uC140) \u2502",
          "\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u252C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518",
          "            \u2502",
          "\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u25BC\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510",
          "\u2502        Next.js (Web Frontend)            \u2502",
          "\u2502  - \uACBD\uC601\uC9C0\uC6D0\uD300 \uB300\uC2DC\uBCF4\uB4DC                    \u2502",
          "\u2502  - \uD488\uC9C8\uAD00\uB9AC\uD300 \uC7AC\uACE0 \uD604\uD669                   \u2502",
          "\u2502  - \uC601\uC5C5\uBD80 \uB9E4\uCD9C/\uBBF8\uC218\uAE08 \uC870\uD68C                \u2502",
          "\u2502  - \uC678\uBD80 \uAC70\uB798\uCC98 \uBC1C\uC8FC \uC6F9\uD3FC                  \u2502",
          "\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u252C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518",
          "            \u2502 REST API",
          "\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u25BC\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510",
          "\u2502        NestJS (Backend API)              \u2502",
          "\u2502  - \uC778\uC99D/\uAD8C\uD55C (JWT + RBAC)                  \u2502",
          "\u2502  - \uBC1C\uC8FC / \uC7AC\uACE0 / \uC815\uC0B0 / \uAC70\uB798\uCC98 \uBAA8\uB4C8     \u2502",
          "\u2502  - \uC54C\uB9BC/\uBA54\uC77C \uBC1C\uC1A1 \uBAA8\uB4C8                \u2502",
          "\u2514\u2500\u2500\u2500\u252C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u252C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518",
          "    \u2502                  \u2502",
          " PostgreSQL         \uC678\uBD80 \uC11C\uBE44\uC2A4",
          "  (\uBA54\uC778 DB)       (AWS SES, S3, AI API)",
        ]),
        spacer(),

        h2("3-2. \uAE30\uC220 \uC2A4\uD0DD"),
        makeTable(
          ["\uC601\uC5ED", "\uAE30\uC220", "\uC120\uD0DD \uC774\uC720"],
          [
            ["\uD504\uB860\uD2B8\uC5D4\uB4DC", "Next.js (React)", "\uBC18\uC751\uD615 \uC6F9, \uBE60\uB978 \uB80C\uB354\uB9C1"],
            ["\uBC31\uC5D4\uB4DC API", "NestJS (Node.js, TypeScript)", "\uAD6C\uC870\uC801 \uBAA8\uB4C8 \uC124\uACC4, \uD655\uC7A5\uC131"],
            ["\uB370\uC774\uD130\uBCA0\uC774\uC2A4", "PostgreSQL", "\uAD00\uACC4\uD615 \uB370\uC774\uD130, RLS \uBCF4\uC548 \uC9C0\uC6D0"],
            ["\uC778\uC99D", "JWT + RBAC", "\uC5ED\uD560 \uAE30\uBC18 \uC811\uADFC \uC81C\uC5B4"],
            ["\uBA54\uC77C \uBC1C\uC1A1", "AWS SES", "\uB300\uB7C9 \uBC1C\uC1A1, \uC548\uC815\uC131"],
            ["\uD30C\uC77C \uC800\uC7A5", "AWS S3", "PDF \uAC70\uB798\uBA85\uC138\uC11C \uC800\uC7A5"],
            ["AI \uD30C\uC2F1", "AI API (\uBCA4\uB354 \uBBF8\uC815, PIPA \uAC80\uD1A0 \uD6C4)", "\uBC1C\uC8FC \uC635\uC158 B \uC120\uD0DD \uC2DC\uB9CC"],
            ["\uC778\uD504\uB77C", "AWS (\uCEE8\uD14C\uC774\uB108 \uAE30\uBC18)", "\uD655\uC7A5\uC131, \uBCF4\uC548, \uAC00\uC6A9\uC131"],
          ],
          [2000, 4000, 3360]
        ),

        h2("3-3. \uC124\uACC4 \uC6D0\uCE59"),
        makeTable(
          ["\uC6D0\uCE59", "\uB0B4\uC6A9"],
          [
            ["**\uB2E8\uC77C \uB370\uC774\uD130**", "\uBAA8\uB4E0 \uBD80\uC11C\uAC00 \uAC19\uC740 DB \uACF5\uC720, \uBDF0/\uAD8C\uD55C\uB9CC \uBD80\uC11C\uBCC4 \uBD84\uB9AC"],
            ["**RBAC \uAD8C\uD55C \uAD00\uB9AC**", "\uC5ED\uD560\uBCC4 \uC811\uADFC \uBC94\uC704 \uBA85\uD655\uD788 \uBD84\uB9AC"],
            ["**API-first**", "\uD5A5\uD6C4 \uBAA8\uBC14\uC77C \uC571\uC774 \uB3D9\uC77C NestJS API \uC7AC\uC0AC\uC6A9 \uAC00\uB2A5"],
            ["**\uBAA8\uB4C8 \uD655\uC7A5**", "Phase\uBCC4 \uBAA8\uB4C8 \uCD94\uAC00 \uBC29\uC2DD\uC73C\uB85C \uAE30\uB2A5 \uD655\uC7A5"],
            ["**\uBCF4\uC548**", "HTTPS, JWT \uD1A0\uD070, \uBBFC\uAC10 \uB370\uC774\uD130 \uC554\uD638\uD654, \uC811\uADFC \uB85C\uADF8"],
            ["**\uC18C\uD504\uD2B8 \uB51C\uB9AC\uD2B8**", "\uB370\uC774\uD130 \uC0AD\uC81C \uC5C6\uC774 \uC774\uB825 \uBCF4\uC874 (\uC758\uB8CC\uAE30\uAE30 \uCD94\uC801 \uB300\uBE44)"],
          ],
          [3000, 6360]
        ),

        // 4. 웹 vs 앱 판단
        new Paragraph({ children: [new PageBreak()] }),
        h1("4. \uC6F9 vs \uC571 \uD310\uB2E8"),
        quote("\uACB0\uB860: 1\uB2E8\uACC4\uB294 \uBC18\uC751\uD615 \uC6F9\uC73C\uB85C \uAD6C\uCD95. \uC571\uC740 2\uB2E8\uACC4 \uC774\uD6C4 \uD544\uC694\uC131 \uAC80\uD1A0 \uD6C4 \uACB0\uC815."),

        h2("\uD310\uB2E8 \uADFC\uAC70"),
        makeTable(
          ["\uAE30\uC900", "\uC6F9 (\uBC18\uC751\uD615)", "\uB124\uC774\uD2F0\uBE0C \uC571"],
          [
            ["\uACBD\uC601\uC9C0\uC6D0\uD300 \uB0B4\uBD80 \uC5C5\uBB34", "PC \uC911\uC2EC, \uC6F9\uC73C\uB85C \uCDA9\uBD84", "\uBD88\uD544\uC694"],
            ["\uB300\uB9AC\uC810/\uBCD1\uC6D0 \uBC1C\uC8FC", "\uB9C1\uD06C \uC811\uC18D, \uC124\uCE58 \uBD88\uD544\uC694", "\uC124\uCE58 \uAC70\uBD80\uAC10 \uC788\uC744 \uC218 \uC788\uC74C"],
            ["\uC601\uC5C5\uC0AC\uC6D0 \uC678\uADFC \uC911 \uC870\uD68C", "\uAC00\uB2A5\uD558\uB098 \uACBD\uD5D8 \uB2E4\uC18C \uB0AE\uC74C", "\uB354 \uD3B8\uD568"],
            ["\uD478\uC2DC \uC54C\uB9BC", "\uC6F9\uD478\uC2DC \uAC00\uB2A5\uD558\uB098 \uC81C\uD55C\uC801", "\uB124\uC774\uD2F0\uBE0C \uD478\uC2DC"],
            ["\uAC1C\uBC1C \uBE44\uC6A9", "\uB0AE\uC74C", "\uB192\uC74C (iOS + Android)"],
            ["\uBC30\uD3EC \uC18D\uB3C4", "\uC989\uC2DC", "\uC571\uC2A4\uD1A0\uC5B4 \uC2EC\uC0AC \uD544\uC694"],
          ],
          [3120, 3120, 3120]
        ),

        h2("\uC571 \uC804\uD658 \uAC80\uD1A0 \uC2DC\uC810 (Phase 2 \uC774\uD6C4)"),
        p("\uC544\uB798 \uC870\uAC74 \uC911 2\uAC1C \uC774\uC0C1 \uD574\uB2F9 \uC2DC \uC571 \uAC1C\uBC1C \uCC29\uC218\uB97C \uAD8C\uC7A5\uD55C\uB2E4."),
        bullet("\uC601\uC5C5\uC0AC\uC6D0\uC774 \uC678\uADFC \uC911 \uC2E4\uC2DC\uAC04 \uC870\uD68C\uB97C \uC790\uC8FC \uD558\uB294\uAC00?"),
        bullet("\uAC70\uB798\uCC98\uAC00 \uC571 \uC124\uCE58\uB97C \uC6D0\uD558\uB294\uAC00?"),
        bullet("\uD478\uC2DC \uC54C\uB9BC\uC774 \uC5C5\uBB34\uC5D0 \uC2E4\uC9C8\uC801\uC73C\uB85C \uD544\uC694\uD55C\uAC00?"),

        h2("\uC571 \uC804\uD658 \uC2DC \uBE44\uC6A9 \uCD5C\uC18C\uD654 \uC804\uB7B5"),
        p("1\uB2E8\uACC4 \uC6F9 \uC11C\uBE44\uC2A4\uB97C API-first \uAD6C\uC870\uB85C \uC124\uACC4\uD558\uAE30 \uB54C\uBB38\uC5D0, \uC571 \uC804\uD658 \uC2DC **NestJS \uBC31\uC5D4\uB4DC\uB97C \uADF8\uB300\uB85C \uC7AC\uC0AC\uC6A9**\uD560 \uC218 \uC788\uB2E4. React Native\uB85C \uC571 UI\uB9CC \uCD94\uAC00\uD558\uBA74 iOS/Android \uB3D9\uC2DC \uCD9C\uC2DC\uAC00 \uAC00\uB2A5\uD558\uC5EC \uCD94\uAC00 \uAC1C\uBC1C \uBE44\uC6A9\uC744 \uCD5C\uC18C\uD654\uD55C\uB2E4."),

        // 5. 사용자 역할 및 유저 플로우
        new Paragraph({ children: [new PageBreak()] }),
        h1("5. \uC0AC\uC6A9\uC790 \uC5ED\uD560 \uBC0F \uC720\uC800 \uD50C\uB85C\uC6B0"),
        h2("5-1. \uAD8C\uD55C\uBCC4 \uC0AC\uC6A9\uC790 \uC5ED\uD560 \uBC0F \uB370\uC774\uD130 \uC18C\uC720\uAD8C"),
        makeTable(
          ["\uC5ED\uD560", "\uB300\uC0C1", "\uC811\uADFC \uBC94\uC704"],
          [
            ["\uC288\uD37C\uC5B4\uB4DC\uBBFC", "RTBIO \uAD00\uB9AC\uC790", "\uC804\uCCB4 \uC2DC\uC2A4\uD15C"],
            ["\uACBD\uC601\uC9C0\uC6D0\uD300", "RTBIO \uB0B4\uBD80 \uB2F4\uB2F9\uC790", "\uBC1C\uC8FC\xB7\uAC70\uB798\uBA85\uC138\uC11C\xB7\uC815\uC0B0\xB7\uB9C8\uAC10"],
            ["\uD488\uC9C8\uAD00\uB9AC\uD300", "RTBIO \uB0B4\uBD80 \uB2F4\uB2F9\uC790", "\uC7AC\uACE0 \uC785\uCD9C\uACE0\xB7\uD604\uD669 \uB300\uC2DC\uBCF4\uB4DC"],
            ["\uC601\uC5C5\uBD80", "RTBIO \uC601\uC5C5 \uC9C1\uC6D0", "\uAC70\uB798\uCC98 \uB9E4\uCD9C\xB7\uBBF8\uC218\uAE08 \uC870\uD68C (\uC77D\uAE30 \uC804\uC6A9)"],
            ["\uC678\uBD80\uAC70\uB798\uCC98", "\uB300\uB9AC\uC810 / \uBCD1\uC6D0 \uB2F4\uB2F9\uC790", "\uBC1C\uC8FC \uC785\uB825 + \uBCF8\uC778 \uAC70\uB798 \uB0B4\uC5ED \uC870\uD68C"],
          ],
          [2000, 3680, 3680]
        ),
        spacer(),
        quote("\uB370\uC774\uD130 \uC18C\uC720\uAD8C: \uC2DC\uC2A4\uD15C \uB0B4 \uBAA8\uB4E0 \uB370\uC774\uD130\uC758 \uC18C\uC720\uAD8C\uC740 RTBIO\uC5D0 \uADC0\uC18D\uB41C\uB2E4. \uC2DC\uC2A4\uD15C \uC778\uC218\uC778\uACC4 \uC644\uB8CC \uD6C4 \uC288\uD37C\uC5B4\uB4DC\uBBFC \uACC4\uC815\uC740 RTBIO\uB85C \uC774\uC804\uB418\uBA70, \uD558\uB9C8\uB2E4\uB7A9\uC2A4\uB294 \uC720\uC9C0\uBCF4\uC218 \uACC4\uC57D \uAE30\uAC04 \uC911 \uC778\uD504\uB77C \uBAA8\uB2C8\uD130\uB9C1 \uBC0F \uC7A5\uC560 \uB300\uC751 \uBAA9\uC801\uC5D0 \uD55C\uC815\uB41C \uBCC4\uB3C4 \uAD00\uB9AC \uACC4\uC815\uC744 \uBCF4\uC720\uD55C\uB2E4. \uD574\uB2F9 \uACC4\uC815\uC740 RTBIO\uC758 \uC694\uCCAD \uC2DC \uC5B8\uC81C\uB4E0 \uC811\uADFC \uB85C\uADF8\uB97C \uC81C\uACF5\uD558\uBA70, \uACC4\uC57D \uC885\uB8CC \uC2DC \uC989\uC2DC \uD3D0\uAE30\uD55C\uB2E4."),

        h2("5-2. \uD575\uC2EC \uD50C\uB85C\uC6B0 \u2014 \uBC1C\uC8FC \u2192 \uCD9C\uACE0 \u2192 \uC815\uC0B0"),
        ...codeBlock([
          "[\uC678\uBD80\uAC70\uB798\uCC98: \uB300\uB9AC\uC810/\uBCD1\uC6D0]",
          "  \u2502  \uBC1C\uC8FC \uC635\uC158 A: \uC6F9\uD3FC \uC9C1\uC811 \uC785\uB825",
          "  \u2502  \uBC1C\uC8FC \uC635\uC158 B: \uCE74\uCE74\uC624\uD1A1/\uC5D1\uC140 \u2192 AI \uD30C\uC2F1",
          "  \u25BC",
          "[\uBC1C\uC8FC \uC811\uC218] \u2500 \uC790\uB3D9 \uBC1C\uC8FC\uBC88\uD638 \uC0DD\uC131",
          "  \u25BC",
          "[\uACBD\uC601\uC9C0\uC6D0\uD300 \uD655\uC778]",
          "  - \uD488\uBAA9\xB7\uC218\uB7C9\xB7\uBC30\uC1A1\uBE44 \uC790\uB3D9 \uACC4\uC0B0",
          "  - \uAC70\uB798\uCC98\uBCC4 \uC608\uC678 \uC815\uCC45 \uC790\uB3D9 \uC801\uC6A9",
          "  - \uC774\uC0C1 \uC788\uC73C\uBA74 \uC218\uB3D9 \uC218\uC815 \uD6C4 \uD655\uC815",
          "  \u25BC",
          "[\uCD9C\uACE0 \uD655\uC778] (Phase 2\uBD80\uD130 \uC7AC\uACE0 \uC790\uB3D9 \uCC28\uAC10 \uC5F0\uB3D9)",
          "  \u25BC",
          "[\uAC70\uB798\uBA85\uC138\uC11C \uC790\uB3D9 \uC0DD\uC131] \u2192 PDF + \uBA54\uC77C \uBC1C\uC1A1",
          "  \u25BC",
          "[\uC815\uC0B0 \uAD00\uB9AC] \u2192 \uAC70\uB798\uCC98\uBCC4 \uC815\uC0B0 \uC8FC\uAE30 \uC790\uB3D9 \uC801\uC6A9",
          "  \u25BC",
          "[\uC6D4 \uB9C8\uAC10 \uBCF4\uACE0\uC11C \uC790\uB3D9 \uC0DD\uC131]",
        ]),

        h2("5-3. \uBC1C\uC8FC \uC635\uC158 \uBE44\uAD50"),
        h3("\uC635\uC158 A \u2014 \uC6F9\uD3FC \uC9C1\uC811 \uC785\uB825 (\uAD8C\uC7A5)"),
        p("\uAC70\uB798\uCC98 \uB2F4\uB2F9\uC790\uAC00 URL\uB85C \uC811\uC18D\uD558\uC5EC \uC9C1\uC811 \uBC1C\uC8FC\uD558\uB294 \uBC29\uC2DD\uC774\uB2E4."),
        makeTable(
          ["\uD56D\uBAA9", "\uB0B4\uC6A9"],
          [
            ["\uC7A5\uC810", "\uB370\uC774\uD130 \uC815\uD615\uD654, \uC790\uB3D9\uD654 \uCC98\uB9AC \uC6A9\uC774, \uC624\uB958 \uCD5C\uC18C\uD654"],
            ["\uB2E8\uC810", "\uAC70\uB798\uCC98 \uB2F4\uB2F9\uC790 \uCD08\uAE30 \uC801\uC751 \uAE30\uAC04 \uD544\uC694"],
            ["\uCD94\uAC00 \uBE44\uC6A9", "\uC5C6\uC74C"],
          ],
          [2000, 7360]
        ),

        h3("\uC635\uC158 B \u2014 \uAE30\uC874 \uBC29\uC2DD \uC720\uC9C0 + AI \uD30C\uC2F1"),
        p("\uAC70\uB798\uCC98\uB294 \uAE30\uC874\uCC98\uB7FC \uCE74\uCE74\uC624\uD1A1\xB7\uC5D1\uC140\uB85C \uBC1C\uC8FC\uD558\uACE0, \uB0B4\uBD80\uC5D0\uC11C AI\uAC00 \uC790\uB3D9 \uD30C\uC2F1\uD558\uB294 \uBC29\uC2DD\uC774\uB2E4."),
        makeTable(
          ["\uD56D\uBAA9", "\uB0B4\uC6A9"],
          [
            ["\uC7A5\uC810", "\uAC70\uB798\uCC98 \uBCC0\uD654 \uC5C6\uC74C, \uAE30\uC874 \uBC29\uC2DD \uC720\uC9C0"],
            ["\uB2E8\uC810", "AI \uD30C\uC2F1 \uC815\uD655\uB3C4 \uD55C\uACC4, \uC218\uB3D9 \uC218\uC815 \uD544\uC694 \uCF00\uC774\uC2A4 \uBC1C\uC0DD"],
            ["\uCD94\uAC00 \uBE44\uC6A9", "AI API \uD1A0\uD070 \uBE44\uC6A9 \uBC1C\uC0DD (\uBC1C\uC8FC \uAC74\uC218 \uBE44\uB840)"],
          ],
          [2000, 7360]
        ),
        quote("\uAD8C\uC7A5\uC548: \uC635\uC158 A\uB97C \uAE30\uBCF8\uC73C\uB85C \uC81C\uACF5\uD55C\uB2E4. \uC635\uC158 B\uB294 \uD2B9\uC815 \uAC70\uB798\uCC98\uC758 \uAC15\uD55C \uC694\uCCAD\uC774 \uC788\uC744 \uACBD\uC6B0 \uBCC4\uB3C4 \uCD94\uAC00 \uACC4\uC57D\uC73C\uB85C \uC801\uC6A9\uD55C\uB2E4."),

        h2("5-4. \uBC30\uC1A1\uBE44 \uC790\uB3D9 \uACC4\uC0B0"),
        bullet("**\uAE30\uBCF8 \uAE30\uC900**: \uD488\uBAA9\uAD70\uBCC4 \uACE0\uC815 \uBC30\uC1A1\uBE44 \uC801\uC6A9"),
        bullet("**\uAC70\uB798\uCC98\uBCC4 \uBA74\uC81C \uC870\uAC74**: \uD2B9\uC815 \uAC70\uB798\uCC98\uC5D0 \uBC30\uC1A1\uBE44 \uBA74\uC81C \uB610\uB294 \uBCC4\uB3C4 \uAE30\uC900 \uC124\uC815 \uAC00\uB2A5"),
        bullet("**\uAE08\uC561 \uAE30\uC900 \uBA74\uC81C**: \uC8FC\uBB38 \uAE08\uC561 \uC77C\uC815 \uAE30\uC900 \uC774\uC0C1 \uC2DC \uBC30\uC1A1\uBE44 \uC790\uB3D9 \uBA74\uC81C \uC124\uC815 \uAC00\uB2A5"),
        bullet("**\uC124\uC815 \uC8FC\uCCB4**: \uACBD\uC601\uC9C0\uC6D0\uD300 \uC5B4\uB4DC\uBBFC \uD654\uBA74\uC5D0\uC11C \uC9C1\uC811 \uB4F1\uB85D\xB7\uC218\uC815"),

        h2("5-5. \uAC70\uB798\uCC98\uBCC4 \uC608\uC678 \uC815\uCC45"),
        p("partner_policies \uD14C\uC774\uBE14\uC5D0\uC11C \uAC70\uB798\uCC98\uBCC4\uB85C \uC544\uB798 \uC720\uD615\uC758 \uC608\uC678\uB97C \uC124\uC815\xB7\uAD00\uB9AC\uD55C\uB2E4."),
        bullet("\uD560\uC778\uC728 (\uD488\uBAA9\uBCC4 \uB610\uB294 \uC804\uCCB4 \uC801\uC6A9)"),
        bullet("\uBC30\uC1A1\uBE44 \uBA74\uC81C \uC5EC\uBD80 \uBC0F \uAE30\uC900"),
        bullet("\uC678\uC0C1 \uD55C\uB3C4 (\uBBF8\uC218\uAE08 \uD5C8\uC6A9 \uD55C\uB3C4)"),
        bullet("\uC815\uC0B0 \uC8FC\uAE30 (\uC6D4\uB9D0 \uB9C8\uAC10, 60\uC77C, \uC785\uAE08 \uD655\uC778 \uD6C4 \uB4F1)"),
        bullet("\uD2B9\uC815 \uD488\uBAA9\uAD70 \uC811\uADFC \uC81C\uD55C"),

        h2("5-6. \uC815\uC0B0 \uC8FC\uAE30 \uAD00\uB9AC"),
        makeTable(
          ["\uC815\uC0B0 \uC720\uD615", "\uC608\uC2DC \uC801\uC6A9 \uAC70\uB798\uCC98"],
          [
            ["\uC6D4\uB9D0 \uC77C\uAD04 \uB9C8\uAC10", "\uB300\uBD80\uBD84\uC758 \uB300\uB9AC\uC810"],
            ["N\uC77C \uD6C4 \uC815\uC0B0 (\uC608: 60\uC77C)", "\uC77C\uBD80 \uBCD1\uC6D0"],
            ["\uC785\uAE08 \uD655\uC778 \uD6C4 \uC815\uC0B0", "\uC18C\uADDC\uBAA8 \uAC70\uB798\uCC98"],
            ["\uAC1C\uBCC4 \uBC1C\uC8FC \uAC74\uBCC4 \uC815\uC0B0", "\uD2B9\uC218 \uACC4\uC57D \uAC70\uB798\uCC98"],
          ],
          [4680, 4680]
        ),
        p("\uC815\uC0B0 \uC8FC\uAE30\uB294 \uC5B4\uB4DC\uBBFC\uC5D0\uC11C \uAC70\uB798\uCC98\uBCC4\uB85C \uC790\uC720\uB86D\uAC8C \uC124\uC815\uD558\uBA70, \uB9C8\uAC10 \uC2DC\uC810\uC774 \uB418\uBA74 \uC2DC\uC2A4\uD15C\uC774 \uC790\uB3D9\uC73C\uB85C \uD574\uB2F9 \uAE30\uAC04 \uBC1C\uC8FC\uB97C \uC9D1\uACC4\uD558\uC5EC \uC815\uC0B0 \uB0B4\uC5ED\uC744 \uC0DD\uC131\uD55C\uB2E4."),

        h2("5-7. \uACBD\uC601\uC9C0\uC6D0\uD300 \uC77C\uBCC4 \uC5C5\uBB34 \uD50C\uB85C\uC6B0"),
        ...codeBlock([
          "\uCD9C\uADFC",
          " \u251C\u2500 1. \uB300\uC2DC\uBCF4\uB4DC\uC5D0\uC11C \uC2E0\uADDC \uBC1C\uC8FC \uD655\uC778",
          " \u251C\u2500 2. \uBC1C\uC8FC \uB0B4\uC6A9 \uAC80\uD1A0 \uBC0F \uD655\uC815 (\uD074\uB9AD \uD55C \uBC88)",
          " \u251C\u2500 3. \uCD9C\uACE0 \uD655\uC778 \uD6C4 \uAC70\uB798\uBA85\uC138\uC11C \uC790\uB3D9 \uBC1C\uC1A1",
          " \u251C\u2500 4. \uBBF8\uC218\uAE08\xB7\uC815\uC0B0 \uD604\uD669 \uD655\uC778",
          " \u2514\u2500 (\uC6D4\uB9D0) \uB9C8\uAC10 \uBCF4\uACE0\uC11C \uC790\uB3D9 \uC0DD\uC131 \u2192 \uBC1C\uC1A1",
        ]),
        p("\uD604\uC7AC: \uD558\uB8E8 \uC57D 30\uAC74 \uC218\uAE30 \uCC98\uB9AC \u2192 \uBAA9\uD45C: \uD655\uC815 \uD074\uB9AD\uB9CC\uC73C\uB85C \uCC98\uB9AC"),

        // 6. 단계별 기능 로드맵
        new Paragraph({ children: [new PageBreak()] }),
        h1("6. \uB2E8\uACC4\uBCC4 \uAE30\uB2A5 \uB85C\uB4DC\uB9F5"),
        quote("\uD83D\uDCCC \uD604\uC7A5 \uD504\uB85C\uC138\uC2A4 \uD30C\uC545 \uD6C4 \uAE30\uB2A5 \uD655\uC815 \uC548\uB0B4 \u2014 \uC544\uB798 \uAE30\uB2A5 \uBAA9\uB85D\uC740 \uD604\uC7AC\uAE4C\uC9C0 \uD30C\uC545\uB41C \uC815\uBCF4\uB97C \uAE30\uBC18\uC73C\uB85C \uC791\uC131\uD55C \uCD08\uC548(\uC608\uBE44 \uD504\uB808\uC784\uC6CC\uD06C)\uC774\uB2E4. \uACC4\uC57D \uD655\uC815 \uD6C4 \uD558\uB9C8\uB2E4\uB7A9\uC2A4 PM\uC774 RTBIO \uD604\uC7A5\uC5D0 \uC0C1\uC8FC\uD558\uBA70 \uAC01 \uBD80\uC11C \uC2E4\uBB34\uC790\uC640 \uD568\uAED8 \uC2E4\uC81C \uC5C5\uBB34 \uD504\uB85C\uC138\uC2A4\uB97C \uC9C1\uC811 \uD30C\uC545\uD55C\uB2E4. \uC774 \uACFC\uC815\uC5D0\uC11C \uAE30\uC874 \uC5D1\uC140\xB7\uC218\uAE30 \uC5C5\uBB34\uC758 \uC138\uBD80 \uD750\uB984, \uC608\uC678 \uCF00\uC774\uC2A4, \uD604\uC7A5 \uC694\uAD6C\uC0AC\uD56D \uB4F1\uC744 \uBC18\uC601\uD558\uC5EC \uAE30\uB2A5\uC744 \uC7AC\uC815\uC758\xB7\uCD94\uAC00\xB7\uC870\uC815\uD560 \uC608\uC815\uC774\uB2E4. Phase\uBCC4 \uC138\uBD80 \uAE30\uB2A5\uC740 \uD604\uC7A5 \uD504\uB85C\uC138\uC2A4 \uD30C\uC545 \uC644\uB8CC \uD6C4 \uCD5C\uC885 \uD655\uC815\uB418\uBA70, \uD604\uC7AC \uBA85\uC2DC\uB41C \uD56D\uBAA9\uC740 \uBCC0\uACBD\uB420 \uC218 \uC788\uB2E4."),
        spacer(),
        h2("Phase 1 \u2014 \uACBD\uC601\uC9C0\uC6D0\uD300 \uC790\uB3D9\uD654 (1\uCC28 \uACC4\uC57D \uBC94\uC704)"),
        quote("\uBAA9\uD45C: \uD558\uB8E8 30\uAC74 \uC218\uAE30 \uCC98\uB9AC \u2192 \uD074\uB9AD \uAE30\uBC18 \uC790\uB3D9 \uCC98\uB9AC / \uC608\uC0C1 \uAC1C\uBC1C \uAE30\uAC04: \uBCC4\uB3C4 \uACAC\uC801\uC11C \uCC38\uC870"),
        makeTable(
          ["\uAE30\uB2A5", "\uC124\uBA85"],
          [
            ["\uAC70\uB798\uCC98 \uAD00\uB9AC", "\uB300\uB9AC\uC810/\uBCD1\uC6D0 \uB4F1\uB85D, \uACB0\uC81C \uC870\uAC74\xB7\uBC30\uC1A1\uBE44 \uAE30\uC900\xB7\uC608\uC678 \uC815\uCC45 \uC124\uC815"],
            ["\uD488\uBAA9 \uAD00\uB9AC", "\uD488\uBAA9\uAD70\uBCC4 \uB4F1\uB85D, \uC0AC\uC774\uC988\xB7\uC0C9\uC0C1\xB7\uAC00\uACA9 \uAD00\uB9AC"],
            ["\uBC1C\uC8FC \uC811\uC218", "\uBC1C\uC8FC \uC635\uC158 A(\uC6F9\uD3FC) \uAE30\uBCF8, \uBC1C\uC8FC \uC635\uC158 B(AI \uD30C\uC2F1)\uB294 \uCD94\uAC00 \uACC4\uC57D"],
            ["\uBC1C\uC8FC \uCC98\uB9AC", "\uC790\uB3D9 \uBC1C\uC8FC\uBC88\uD638, \uBC30\uC1A1\uBE44 \uC790\uB3D9 \uACC4\uC0B0, \uC608\uC678 \uC815\uCC45 \uC790\uB3D9 \uC801\uC6A9"],
            ["\uAC70\uB798\uBA85\uC138\uC11C", "PDF \uC790\uB3D9 \uC0DD\uC131 + \uBA54\uC77C \uC790\uB3D9 \uBC1C\uC1A1"],
            ["\uC815\uC0B0 \uAD00\uB9AC", "\uAC70\uB798\uCC98\uBCC4 \uC815\uC0B0 \uC8FC\uAE30 \uAD00\uB9AC, \uBBF8\uC218\uAE08 \uC9D1\uACC4"],
            ["\uC6D4 \uB9C8\uAC10", "\uAC70\uB798\uCC98\uBCC4 \uC6D0\uC7A5 \uC790\uB3D9 \uC0B0\uCD9C, \uBCF4\uACE0\uC11C \uC0DD\uC131"],
            ["\uC5B4\uB4DC\uBBFC \uB300\uC2DC\uBCF4\uB4DC", "\uC2E0\uADDC \uBC1C\uC8FC \uD604\uD669, \uCC98\uB9AC \uB300\uAE30 \uBAA9\uB85D, \uBBF8\uC218\uAE08 \uC694\uC57D"],
            ["\uAD8C\uD55C/\uACC4\uC815 \uAD00\uB9AC", "\uC5ED\uD560\uBCC4 \uC811\uADFC \uC81C\uC5B4 (RBAC), \uAC70\uB798\uCC98 \uACC4\uC815 \uCD08\uB300 \uBC1C\uC1A1"],
          ],
          [2500, 6860]
        ),

        h2("Phase 2 \u2014 \uD488\uC9C8\uAD00\uB9AC\uD300 \uC7AC\uACE0 \uC790\uB3D9\uD654"),
        quote("\uBAA9\uD45C: \uC5D1\uC140 \uC218\uAE30 \uC7AC\uACE0 \uAD00\uB9AC \u2192 \uC2E4\uC2DC\uAC04 \uC790\uB3D9 \uBC18\uC601"),
        makeTable(
          ["\uAE30\uB2A5", "\uC124\uBA85"],
          [
            ["\uC7AC\uACE0 \uC790\uB3D9 \uBC18\uC601", "\uBC1C\uC8FC \uD655\uC815 \uC2DC \uCD9C\uACE0 \uC7AC\uACE0 \uC790\uB3D9 \uCC28\uAC10"],
            ["\uC785\uACE0 \uAD00\uB9AC", "\uC785\uACE0 \uB4F1\uB85D, \uC774\uB825 \uAD00\uB9AC"],
            ["\uCD9C\uACE0 \uAD00\uB9AC", "\uCD9C\uACE0 \uC804 \uC7AC\uACE0 \uD655\uC778, \uBD80\uC871 \uC2DC \uACBD\uACE0"],
            ["\uC7AC\uACE0 \uD604\uD669 \uB300\uC2DC\uBCF4\uB4DC", "\uD488\uBAA9\xB7\uC0AC\uC774\uC988\xB7\uC0C9\uC0C1\uBCC4 \uC2E4\uC2DC\uAC04 \uC870\uD68C"],
            ["\uC77C\uBCC4 \uC7AC\uACE0 \uBCF4\uACE0", "\uC790\uB3D9 \uC9D1\uACC4 \uBC0F \uBCF4\uACE0\uC11C \uC0DD\uC131"],
          ],
          [2500, 6860]
        ),

        h2("Phase 3 \u2014 \uC601\uC5C5\uBD80 \uB300\uC2DC\uBCF4\uB4DC"),
        quote("\uBAA9\uD45C: \uACBD\uC601\uC9C0\uC6D0\uD300\uC774 \uB300\uC2E0 \uCC98\uB9AC\uD558\uB358 \uC601\uC5C5 \uB370\uC774\uD130 \u2192 \uC601\uC5C5\uBD80 \uC140\uD504 \uC870\uD68C"),
        makeTable(
          ["\uAE30\uB2A5", "\uC124\uBA85"],
          [
            ["\uAC70\uB798\uCC98\uBCC4 \uB9E4\uCD9C \uD604\uD669", "\uAE30\uAC04\uBCC4 \uB9E4\uCD9C \uC870\uD68C"],
            ["\uBBF8\uC218\uAE08 \uD604\uD669", "\uAC70\uB798\uCC98\uBCC4 \uBBF8\uC218\uAE08 \uBC0F \uACB0\uC81C \uC0C1\uD0DC"],
            ["\uACB0\uC81C \uC870\uAC74 \uC870\uD68C", "\uAC70\uB798\uCC98\uBCC4 \uACC4\uC57D \uC870\uAC74 \uD655\uC778"],
            ["\uC601\uC5C5 \uB300\uC2DC\uBCF4\uB4DC", "\uC601\uC5C5\uC0AC\uC6D0\uBCC4 \uC2E4\uC801 \uC694\uC57D"],
          ],
          [2500, 6860]
        ),

        h2("Phase 4 \u2014 \uBCA0\uD2B8\uB0A8 \uC0DD\uC0B0\xB7\uD574\uC678 \uC7AC\uACE0 \uC5F0\uB3D9"),
        makeTable(
          ["\uAE30\uB2A5", "\uC124\uBA85"],
          [
            ["\uC0DD\uC0B0 \uC7AC\uACE0 \uB370\uC774\uD130 \uC5F0\uB3D9", "\uBCA0\uD2B8\uB0A8 \uACF5\uC7A5 \uC7AC\uACE0 \uC5C5\uB85C\uB4DC/\uC5F0\uB3D9"],
            ["\uC6D0\uC790\uC7AC \uC18C\uC9C4 \uC608\uCE21", "\uD310\uB9E4 \uCD94\uC774 \uAE30\uBC18 \uBD80\uC871 \uC2DC\uC810 \uC608\uCE21"],
            ["\uBD80\uC871 \uC608\uC0C1 \uC54C\uB9BC", "\uC784\uACC4\uCE58 \uB3C4\uB2EC \uC2DC \uC790\uB3D9 \uC54C\uB9BC"],
            ["\uC0DD\uC0B0\xB7\uD310\uB9E4 \uB370\uC774\uD130 \uD1B5\uD569 \uC870\uD68C", "\uAD6D\uB0B4 \uC7AC\uACE0 + \uD574\uC678 \uC0DD\uC0B0 \uD1B5\uD569 \uBDF0"],
          ],
          [2500, 6860]
        ),

        h2("Phase 5 \u2014 \uADDC\uC81C \uB300\uC751\xB7\uC758\uB8CC\uAE30\uAE30 \uCD94\uC801 (\uC7A5\uAE30)"),
        makeTable(
          ["\uAE30\uB2A5", "\uC124\uBA85"],
          [
            ["\uACF5\uAE09 \uB0B4\uC5ED \uBCF4\uACE0", "\uBCD1\uC6D0 \uB0A9\uD488 \uC774\uB825 \uC790\uB3D9 \uAE30\uB85D"],
            ["\uC7A5\uBE44 \uCD94\uC801 \uC2DC\uC2A4\uD15C", "\uC2DC\uB9AC\uC5BC \uAE30\uBC18 \uC7A5\uBE44 \uC774\uB825 \uAD00\uB9AC"],
            ["\uC720\uC9C0\uBCF4\uC218 \uC774\uB825", "\uC7A5\uBE44\uBCC4 A/S \uC774\uB825 \uAD00\uB9AC"],
            ["UDI \uB300\uC751", "\uC758\uB8CC\uAE30\uAE30 \uACE0\uC720\uC2DD\uBCC4\uC790 \uAD00\uB9AC"],
          ],
          [2500, 6860]
        ),

        h2("\uC804\uCCB4 \uD0C0\uC784\uB77C\uC778 (\uC548)"),
        ...codeBlock([
          "Phase 1  \u2500\u2500 \uACBD\uC601\uC9C0\uC6D0\uD300 \uC790\uB3D9\uD654       \u2190 1\uCC28 \uACC4\uC57D \uBC94\uC704  (\uACAC\uC801\uC11C \uCC38\uC870)",
          "Phase 2  \u2500\u2500 \uD488\uC9C8\uAD00\uB9AC\uD300 \uC7AC\uACE0 \uC790\uB3D9\uD654   \u2190 Phase 1 \uC644\uB8CC \uD6C4 \uCD94\uAC00 \uACC4\uC57D",
          "Phase 3  \u2500\u2500 \uC601\uC5C5\uBD80 \uB300\uC2DC\uBCF4\uB4DC         \u2190 Phase 2 \uC644\uB8CC \uD6C4 \uCD94\uAC00 \uACC4\uC57D",
          "Phase 4  \u2500\u2500 \uBCA0\uD2B8\uB0A8 \uC0DD\uC0B0\xB7\uD574\uC678 \uC7AC\uACE0    \u2190 \uD544\uC694 \uC2DC\uC810\uC5D0 \uCD94\uAC00 \uACC4\uC57D",
          "Phase 5  \u2500\u2500 \uADDC\uC81C \uB300\uC751\xB7\uC758\uB8CC\uAE30\uAE30 \uCD94\uC801  \u2190 \uC7A5\uAE30 \uACFC\uC81C",
        ]),
        quote("Phase 1 \uB0A9\uD488 \uD6C4 \uD604\uC7A5 \uD53C\uB4DC\uBC31\uC744 \uBC18\uC601\uD558\uBA74\uC11C Phase 2\uBD80\uD130\uB294 \uCD94\uAC00 \uACC4\uC57D\uC73C\uB85C \uC9C4\uD589\uD558\uB294 \uAD6C\uC870\uB97C \uAD8C\uC7A5\uD55C\uB2E4."),

        // 7. DB 구조
        new Paragraph({ children: [new PageBreak()] }),
        h1("7. DB \uAD6C\uC870"),
        h2("\uC124\uACC4 \uC6D0\uCE59"),
        bullet("**\uB2E8\uC77C PostgreSQL DB** \u2014 \uBAA8\uB4E0 \uBD80\uC11C \uACF5\uC720, \uBDF0/\uAD8C\uD55C\uC73C\uB85C \uBD84\uB9AC"),
        bullet("**\uB3C4\uBA54\uC778 \uB2E8\uC704 \uD14C\uC774\uBE14 \uC124\uACC4** \u2014 Phase\uBCC4 \uD14C\uC774\uBE14 \uCD94\uAC00 \uBC29\uC2DD\uC73C\uB85C \uD655\uC7A5"),
        bullet("**\uC18C\uD504\uD2B8 \uB51C\uB9AC\uD2B8** \u2014 \uB370\uC774\uD130 \uC0AD\uC81C \uC5C6\uC774 deleted_at \uCC98\uB9AC (\uC774\uB825 \uBCF4\uC874)"),
        bullet("**\uAC10\uC0AC \uB85C\uADF8** \u2014 \uC8FC\uC694 \uD14C\uC774\uBE14 \uC804\uCCB4\uC5D0 created_by, updated_by, created_at, updated_at \uC801\uC6A9"),

        h2("Phase 1 \uD575\uC2EC \uD14C\uC774\uBE14"),
        h3("\uC778\uC99D/\uAD8C\uD55C"),
        makeTable(["\uD14C\uC774\uBE14", "\uC124\uBA85"], [["users", "\uACC4\uC815 (\uB0B4\uBD80 \uC9C1\uC6D0 + \uC678\uBD80 \uAC70\uB798\uCC98 \uD1B5\uD569)"], ["roles", "\uC5ED\uD560 \uC815\uC758"], ["user_roles", "\uC720\uC800-\uC5ED\uD560 \uB9E4\uD551"]], [3000, 6360]),
        h3("\uAC70\uB798\uCC98"),
        makeTable(["\uD14C\uC774\uBE14", "\uC124\uBA85"], [["partners", "\uB300\uB9AC\uC810/\uBCD1\uC6D0 \uAE30\uBCF8 \uC815\uBCF4"], ["partner_policies", "\uAC70\uB798\uCC98\uBCC4 \uACB0\uC81C \uC870\uAC74\xB7\uC815\uC0B0 \uC8FC\uAE30\xB7\uC608\uC678 \uC815\uCC45"], ["partner_contacts", "\uAC70\uB798\uCC98 \uB2F4\uB2F9\uC790 \uC5F0\uB77D\uCC98"]], [3000, 6360]),
        h3("\uD488\uBAA9"),
        makeTable(["\uD14C\uC774\uBE14", "\uC124\uBA85"], [["products", "\uD488\uBAA9 \uAE30\uBCF8 \uC815\uBCF4 (\uD488\uBAA9\uAD70, \uB2E8\uAC00)"], ["product_variants", "\uC0AC\uC774\uC988\xB7\uC0C9\uC0C1\uBCC4 SKU"], ["shipping_rules", "\uD488\uBAA9\uAD70\uBCC4 \uBC30\uC1A1\uBE44 \uAE30\uC900"]], [3000, 6360]),
        h3("\uBC1C\uC8FC"),
        makeTable(["\uD14C\uC774\uBE14", "\uC124\uBA85"], [["orders", "\uBC1C\uC8FC \uD5E4\uB354 (\uBC1C\uC8FC\uBC88\uD638, \uAC70\uB798\uCC98, \uC0C1\uD0DC)"], ["order_items", "\uBC1C\uC8FC \uD488\uBAA9 \uC0C1\uC138 (\uD488\uBAA9, \uC218\uB7C9, \uB2E8\uAC00)"], ["order_logs", "\uBC1C\uC8FC \uC0C1\uD0DC \uBCC0\uACBD \uC774\uB825"]], [3000, 6360]),
        h3("\uC815\uC0B0"),
        makeTable(["\uD14C\uC774\uBE14", "\uC124\uBA85"], [["invoices", "\uAC70\uB798\uBA85\uC138\uC11C (\uBC1C\uC8FC \uC5F0\uACB0, PDF \uACBD\uB85C)"], ["settlements", "\uC815\uC0B0 \uD68C\uCC28\uBCC4 \uD569\uC0B0"], ["payments", "\uC785\uAE08 \uAE30\uB85D"], ["receivables", "\uBBF8\uC218\uAE08 \uC9D1\uACC4"]], [3000, 6360]),

        h2("\uD14C\uC774\uBE14 \uAD00\uACC4 \uC694\uC57D"),
        ...codeBlock([
          "partners \u2500\u2500< orders \u2500\u2500< order_items >\u2500\u2500 product_variants",
          "                \u2502                              \u2502",
          "                \u25BC                              \u25BC",
          "            invoices                        products",
          "                \u2502",
          "                \u25BC",
          "          settlements",
          "                \u2502",
          "                \u25BC",
          "            payments",
        ]),

        // 8. 보안 설계
        new Paragraph({ children: [new PageBreak()] }),
        h1("8. \uBCF4\uC548 \uC124\uACC4"),
        makeTable(
          ["\uD56D\uBAA9", "\uBC29\uC2DD"],
          [
            ["\uBE44\uBC00\uBC88\uD638", "bcrypt \uD574\uC2F1"],
            ["\uAC1C\uC778\uC815\uBCF4", "\uBBFC\uAC10 \uCEEC\uB7FC AES \uC554\uD638\uD654"],
            ["\uC811\uADFC \uC81C\uC5B4", "Row-level Security (RLS) \u2014 \uC678\uBD80 \uAC70\uB798\uCC98\uB294 \uBCF8\uC778 \uB370\uC774\uD130\uB9CC \uC870\uD68C"],
            ["API \uBCF4\uC548", "JWT \uD1A0\uD070 \uB9CC\uB8CC \uAD00\uB9AC, Refresh Token \uC801\uC6A9"],
            ["\uAC10\uC0AC \uB85C\uADF8", "\uC8FC\uC694 \uB370\uC774\uD130 \uBCC0\uACBD \uC2DC audit_logs \uD14C\uC774\uBE14 \uC790\uB3D9 \uAE30\uB85D"],
            ["\uD1B5\uC2E0", "HTTPS \uD544\uC218"],
            ["\uBC31\uC5C5", "\uC77C\uBCC4 \uC790\uB3D9 \uBC31\uC5C5, 30\uC77C \uBCF4\uAD00"],
            ["\uAC1C\uC778\uC815\uBCF4\uBCF4\uD638\uBC95", "\uAC1C\uC778\uC815\uBCF4\uBCF4\uD638\uBC95(PIPA) \uC900\uC218, \uAC1C\uC778\uC815\uBCF4 \uCC98\uB9AC\uBC29\uCE68 \uC801\uC6A9"],
            ["\uC758\uB8CC\uAE30\uAE30 \uADDC\uC81C", "Phase 5 \uC774\uD6C4 \uC2DD\uC57D\uCC98 \uAD00\uB828 \uADDC\uC81C \uB300\uC751 \uAD6C\uC870 \uD655\uBCF4 \uC608\uC815"],
          ],
          [2500, 6860]
        ),

        // 9. 서비스 운영 및 지원
        spacer(),
        h1("9. \uC11C\uBE44\uC2A4 \uC6B4\uC601 \uBC0F \uC9C0\uC6D0"),
        h2("\uC778\uD504\uB77C \uC6B4\uC601"),
        p("\uC2DC\uC2A4\uD15C \uC778\uD504\uB77C(\uC11C\uBC84, DB, \uC2A4\uD1A0\uB9AC\uC9C0, \uBAA8\uB2C8\uD130\uB9C1, \uBC30\uD3EC)\uB294 \uD558\uB9C8\uB2E4\uB7A9\uC2A4\uAC00 \uC804\uB2F4 \uC6B4\uC601\uD55C\uB2E4. RTBIO\uB294 \uC778\uD504\uB77C\uB97C \uC9C1\uC811 \uAD00\uB9AC\uD560 \uD544\uC694 \uC5C6\uC774, \uC6D4 \uAD6C\uB3C5\uB8CC\uC5D0 \uC544\uB798 \uD56D\uBAA9\uC774 \uBAA8\uB450 \uD3EC\uD568\uB41C\uB2E4."),
        makeTable(
          ["\uD3EC\uD568 \uD56D\uBAA9", "\uB0B4\uC6A9"],
          [
            ["AWS \uC778\uD504\uB77C", "\uC11C\uBC84(\uCEE8\uD14C\uC774\uB108), DB, S3 \uC2A4\uD1A0\uB9AC\uC9C0, SES \uBA54\uC77C \uBC1C\uC1A1"],
            ["\uBAA8\uB2C8\uD130\uB9C1\xB7\uBC30\uD3EC", "\uC11C\uBC84 \uC0C1\uD0DC \uBAA8\uB2C8\uD130\uB9C1, \uC7A5\uC560 \uAC10\uC9C0, \uBC30\uD3EC \uAD00\uB9AC"],
            ["\uBC31\uC5C5", "\uC77C\uBCC4 \uC790\uB3D9 \uBC31\uC5C5, 30\uC77C \uBCF4\uAD00"],
            ["AI LLM \uD1A0\uD070 \uBE44\uC6A9", "\uBC1C\uC8FC \uC635\uC158 B(AI \uD30C\uC2F1) \uC0AC\uC6A9 \uC2DC \uBC1C\uC0DD\uD558\uB294 AI API \uD1A0\uD070 \uBE44\uC6A9 \uD3EC\uD568"],
          ],
          [2500, 6860]
        ),
        quote("RTBIO\uB294 \uBCC4\uB3C4 \uC778\uD504\uB77C \uBE44\uC6A9 \uC5C6\uC774 \uC6D4 \uAD6C\uB3C5\uB8CC \uD558\uB098\uB85C \uC2DC\uC2A4\uD15C \uC804\uCCB4\uB97C \uC774\uC6A9\uD560 \uC218 \uC788\uB2E4."),

        h2("\uC7A5\uC560 \uB300\uC751 \uAE30\uC900"),
        makeTable(
          ["\uB4F1\uAE09", "\uAE30\uC900", "\uB300\uC751 \uBAA9\uD45C \uC2DC\uAC04"],
          [
            ["\uAE34\uAE09 (P1)", "\uC2DC\uC2A4\uD15C \uC804\uCCB4 \uB2E4\uC6B4, \uBC1C\uC8FC \uCC98\uB9AC \uBD88\uAC00", "4\uC2DC\uAC04 \uC774\uB0B4 \uBCF5\uAD6C \uBAA9\uD45C"],
            ["\uB192\uC74C (P2)", "\uC8FC\uC694 \uAE30\uB2A5 \uC77C\uBD80 \uC624\uC791\uB3D9", "1\uC601\uC5C5\uC77C \uC774\uB0B4 \uB300\uC751"],
            ["\uC77C\uBC18 (P3)", "\uAE30\uB2A5 \uAC1C\uC120, \uBE44\uD575\uC2EC \uC624\uB958", "\uD611\uC758 \uD6C4 \uCC98\uB9AC"],
          ],
          [2000, 4360, 3000]
        ),
        bullet("\uC9C0\uC6D0 \uCC44\uB110: \uC5C5\uBB34 \uC2DC\uAC04 \uB0B4 \uB2F4\uB2F9\uC790 \uC9C1\uD1B5 \uC5F0\uB77D"),
        bullet("\uBC31\uC5C5 \uBCF5\uAD6C: RPO(\uBCF5\uAD6C \uC2DC\uC810 \uBAA9\uD45C) 24\uC2DC\uAC04, RTO(\uBCF5\uAD6C \uC2DC\uAC04 \uBAA9\uD45C) 8\uC2DC\uAC04"),
        bullet("**\uACC4\uC57D \uC885\uB8CC \uC2DC \uB370\uC774\uD130 \uCC98\uB9AC**: \uACC4\uC57D \uC885\uB8CC \uC2DC \uBC31\uC5C5 \uB370\uC774\uD130\uB97C \uD3EC\uD568\uD55C \uBAA8\uB4E0 \uB370\uC774\uD130\uB97C RTBIO\uC5D0 \uC774\uAD00\uD558\uAC70\uB098 RTBIO\uC758 \uC694\uCCAD\uC5D0 \uB530\uB77C \uC0AD\uC81C\uD55C\uB2E4."),

        h2("\uC720\uC9C0\uBCF4\uC218 \uACC4\uC57D \uAD6C\uC870"),
        p("Phase 1 \uB0A9\uD488 \uD6C4 \uC720\uC9C0\uBCF4\uC218 \uACC4\uC57D\uC744 \uBCC4\uB3C4 \uCCB4\uACB0\uD55C\uB2E4. \uC720\uC9C0\uBCF4\uC218 \uBC94\uC704 \uBC0F \uC6D4 \uBE44\uC6A9\uC740 \uACAC\uC801\uC11C\uC5D0\uC11C \uD655\uC778\uD55C\uB2E4."),
        makeTable(
          ["\uD56D\uBAA9", "\uD3EC\uD568 \uC5EC\uBD80"],
          [
            ["\uBC84\uADF8 \uC218\uC815", "\uD3EC\uD568"],
            ["\uBCF4\uC548 \uD328\uCE58", "\uD3EC\uD568"],
            ["\uC778\uD504\uB77C \uC6B4\uC601", "\uC6D4 \uAD6C\uB3C5\uB8CC\uC5D0 \uD3EC\uD568 (AWS + AI LLM \uD1A0\uD070)"],
            ["\uAE30\uB2A5 \uAC1C\uC120\xB7\uCD94\uAC00", "\uBCC4\uB3C4 \uACAC\uC801"],
          ],
          [4680, 4680]
        ),

        // 10. 가격 및 계약
        new Paragraph({ children: [new PageBreak()] }),
        h1("10. \uAC00\uACA9 \uBC0F \uACC4\uC57D"),
        quote("\uC0C1\uC138 \uAC00\uACA9\uC740 \uBCC4\uB3C4 \uACAC\uC801\uC11C\uB97C \uCC38\uC870\uD55C\uB2E4."),
        p("\uC544\uB798\uB294 \uACC4\uC57D \uAD6C\uC870\uC758 \uAE30\uBCF8 \uBC29\uD5A5\uC774\uB2E4."),
        makeTable(
          ["\uD56D\uBAA9", "\uBC29\uC2DD"],
          [
            ["Phase 1 \uAC1C\uBC1C\uBE44", "\uACE0\uC815 \uACAC\uC801 (\uBC94\uC704 \uAE30\uC900)"],
            ["Phase 2~ \uCD94\uAC00 \uAE30\uB2A5", "Phase\uBCC4 \uCD94\uAC00 \uACC4\uC57D"],
            ["\uC6D4 \uAD6C\uB3C5\uB8CC (\uB0A9\uD488 \uD6C4)", "\uC778\uD504\uB77C \uC6B4\uC601 + \uC720\uC9C0\uBCF4\uC218 + AI LLM \uD1A0\uD070 \uBE44\uC6A9 \uC77C\uAD04 \uD3EC\uD568"],
            ["\uBC1C\uC8FC \uC635\uC158 B (AI \uD30C\uC2F1) \uAC1C\uBC1C\uBE44", "\uBCC4\uB3C4 \uCD94\uAC00 \uACAC\uC801 (\uC6B4\uC601 \uC2DC \uD1A0\uD070 \uBE44\uC6A9\uC740 \uC6D4 \uAD6C\uB3C5\uB8CC\uC5D0 \uD3EC\uD568)"],
          ],
          [3000, 6360]
        ),

        // 11. 후속 협의 사항
        spacer(),
        h1("11. \uD6C4\uC18D \uD611\uC758 \uC0AC\uD56D"),
        p("\uC544\uB798 \uD56D\uBAA9\uC740 \uACC4\uC57D \uC804 RTBIO\uC640 \uCD94\uAC00 \uD655\uC778\uC774 \uD544\uC694\uD558\uB2E4."),
        checkItem("\uBC1C\uC8FC \uBC29\uC2DD \uCD5C\uC885 \uC120\uD0DD (\uC635\uC158 A \uB2E8\uB3C5 / \uC635\uC158 A + \uC635\uC158 B \uBCD1\uD589)"),
        checkItem("\uAE30\uC874 ERP \uD65C\uC6A9 \uBC94\uC704 \uBC0F \uB370\uC774\uD130 \uB9C8\uC774\uADF8\uB808\uC774\uC158 \uBC94\uC704 \uD655\uC815"),
        checkItem("\uAE30\uC874 \uBC1C\uC8FC\uC11C\xB7\uAC70\uB798\uBA85\uC138\uC11C\xB7\uC7AC\uACE0 \uC5D1\uC140\xB7\uB9C8\uAC10 \uC790\uB8CC \uC0D8\uD50C \uACF5\uC720"),
        checkItem("\uAC70\uB798\uCC98\uBCC4 \uACB0\uC81C \uC870\uAC74\xB7\uBC30\uC1A1\uBE44 \uAE30\uC900\xB7\uC608\uC678 \uC815\uCC45 \uC815\uB9AC \uC790\uB8CC \uACF5\uC720"),
        checkItem("Phase 1 \uB0A9\uAE30 \uBC0F \uACC4\uC57D \uBC94\uC704 \uCD5C\uC885 \uD569\uC758 (\uACAC\uC801\uC11C \uAE30\uC900)"),
        checkItem("\uC6D4 \uAD6C\uB3C5\uB8CC \uAE08\uC561 \uBC0F \uBC94\uC704 \uCD5C\uC885 \uD569\uC758"),
      ]
    }
  ]
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync("C:/Users/user/Desktop/Project/RTBIO/docs/RTBIO_업무자동화시스템_설계문서_v1.2.docx", buffer);
  console.log("DOCX created successfully");
});
