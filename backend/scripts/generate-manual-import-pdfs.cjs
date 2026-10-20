const fs = require('node:fs');
const path = require('node:path');
const PDFDocument = require('pdfkit');

const outputDir = 'C:/INFORMATIQUE/ENVAL/Memoire/Import manuel';
fs.mkdirSync(outputDir, { recursive: true });
const font = 'C:/Windows/Fonts/arial.ttf';

function writePdf(filename, items) {
  return new Promise((resolve, reject) => {
    const target = path.join(outputDir, filename);
    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    const stream = fs.createWriteStream(target);
    stream.on('finish', resolve);
    stream.on('error', reject);
    doc.pipe(stream);
    doc.font(font).fontSize(11);
    items.forEach((item, index) => {
      if (index && doc.y > 690) doc.addPage();
      doc.fontSize(14).text(item.title, { paragraphGap: 10 });
      doc.fontSize(11).text(item.summary, { paragraphGap: 10 });
      doc.text(`URL: ${item.url}`);
      doc.text(`Date: ${item.date}`);
      doc.moveDown(1.5);
    });
    doc.end();
  });
}

const languages = [
  ['français', 'Évolution des exigences de qualité en laboratoire', 'Cette veille présente les nouvelles pratiques de suivi et de validation des résultats.', 'fr'],
  ['anglais', 'New guidance for laboratory quality management', 'This watch item presents updated practices for monitoring and validating laboratory results.', 'en'],
  ['espagnol', 'Nuevas prácticas para la calidad del laboratorio', 'Esta vigilancia presenta prácticas actualizadas para controlar y validar los resultados.', 'es'],
  ['allemand', 'Neue Leitlinien für das Qualitätsmanagement im Labor', 'Diese Meldung beschreibt neue Verfahren zur Überwachung und Validierung von Ergebnissen.', 'de'],
  ['russe', 'Новые требования к качеству лаборатории', 'В этой публикации представлены новые методы контроля и подтверждения результатов.', 'ru'],
];

const item = (title, summary, n) => ({ title, summary, url: `https://example.org/veille/${n}`, date: `2026-10-${String((n % 28) + 1).padStart(2, '0')}` });
const single = [item('Nouvelles exigences de traçabilité des résultats', 'Cette veille présente les exigences essentielles pour documenter les mesures, conserver les preuves et améliorer la traçabilité au laboratoire.', 1)];
const french25 = Array.from({ length: 25 }, (_, i) => item(`Veille française sur la qualité analytique ${i + 1}`, `Cette publication française décrit une évolution concernant les méthodes d’essai, la compétence du personnel ou le système de management du laboratoire.`, i + 101));
const multilingual60 = [];
for (let i = 0; i < 60; i++) {
  const group = i < 10 ? languages[0] : i < 30 ? languages[1] : i < 40 ? languages[2] : i < 50 ? languages[3] : languages[4];
  multilingual60.push(item(`${group[1]} ${i + 1}`, `${group[2]} Publication ${i + 1} en ${group[0]}.`, i + 201));
}

Promise.all([
  writePdf('veille-unique-francais.pdf', single),
  writePdf('60-veilles-multilingues.pdf', multilingual60),
  writePdf('25-veilles-francaises.pdf', french25),
]).then(() => console.log(`PDF générés dans ${outputDir}`)).catch((error) => { console.error(error); process.exitCode = 1; });
