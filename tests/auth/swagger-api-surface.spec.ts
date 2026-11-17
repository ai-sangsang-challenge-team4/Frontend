import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const snapshot = JSON.parse(readFileSync('tests/fixtures/swagger-api-surface.json', 'utf8')) as { operations: string[] };

const adapters = [
  'auth/api/httpAuthApi.ts', 'auth/api/httpSignupOptionsApi.ts',
  'message/api/httpTeacherInboxApi.ts', 'escalation/api/httpEscalationApi.ts',
  'parent-message/api/httpParentComplaintApi.ts', 'risk-analysis/riskTagCatalog.ts',
];
const normalize = (path: string) => path.replace(/\{[^}]*\}/g, '{}');

test('사용 중인 모든 API 경로와 메서드가 현재 Swagger에 있으며 서비스 상태 API만 화면에서 제외한다', () => {
  const actual = new Set<string>();
  for (const adapter of adapters) {
    const filename = `src/features/${adapter}`;
    const source = ts.createSourceFile(filename, readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true);
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) &&
          node.expression.expression.getText(source) === 'apiClient') {
        const arg = node.arguments[0];
        const path = ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg) ? arg.text
          : ts.isTemplateExpression(arg) ? arg.head.text + arg.templateSpans.map((span) => '{}' + span.literal.text).join('') : null;
        expect(path, filename).not.toBeNull();
        actual.add(`${node.expression.name.text.toUpperCase()} ${path}`);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  const documented = new Set(snapshot.operations.map(normalize));
  for (const operation of actual) expect(documented.has(operation), operation).toBe(true);
  // GET /health is infrastructure monitoring, with no product action or screen.
  expect([...documented].filter((operation) => !actual.has(operation))).toEqual(['GET /health']);
});
