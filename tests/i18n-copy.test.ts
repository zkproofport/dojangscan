import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import ts from 'typescript';
import catalog from '../lib/translations.json';
import {tr} from '../lib/i18n';
import {setLanguage} from '../lib/preferences';

test('literal Korean UI translation keys are present in the English catalog', () => {
  const missing: string[] = [];
  for (const file of readdirSync(new URL('../components/', import.meta.url)).filter(f => f.endsWith('.tsx'))) {
    const tree = ts.createSourceFile(file, readFileSync(new URL(`../components/${file}`, import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(node: ts.Node) {
      if (ts.isCallExpression(node) && node.expression.getText(tree) === 'tr') {
        const arg = node.arguments[0];
        if (arg && ts.isStringLiteral(arg) && /[가-힣]/.test(arg.text) && !(arg.text in catalog)) missing.push(`${file}: ${arg.text}`);
      }
      ts.forEachChild(node, visit);
    }
    visit(tree);
  }
  assert.deepEqual(missing, []);
});
test('translation placeholders survive the copy revision', () => {
  for (const [ko, en] of Object.entries(catalog)) {
    const placeholders = (s: string) => [...s.matchAll(/\{\d+\}/g)].map(m => m[0]).sort();
    assert.deepEqual(placeholders(en), placeholders(ko), ko);
  }
  try {
    setLanguage('en');
    assert.equal(tr('공개 데이터 서비스 응답 오류 (503) · 재조회 필요'), 'Public data service error (503) · retry required');
    assert.equal(tr('공개 데이터 서비스 응답 오류 ({0}) · 재조회 필요', [429]), 'Public data service error (429) · retry required');
    setLanguage('ko');
    assert.equal(tr('Enter a nonzero address.'), '0이 아닌 주소 필요');
  } finally {setLanguage('ko');}
});
