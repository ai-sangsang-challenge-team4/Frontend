import { expect, test } from '@playwright/test';
import { messageTextSegments } from '../../src/shared/components/ui/messageTextSegments';

test('띄어쓰기가 없는 문장도 문장부호와 닫는 따옴표 뒤에서 줄바꿈할 수 있다', () => {
  expect(messageTextSegments('안녕하세요.준비물은 도시락,물입니다.「확인했어요.」감사합니다!')).toEqual([
    '안녕하세요.', '준비물은 도시락,', '물입니다.', '「확인했어요.」', '감사합니다!',
  ]);
});

test('숫자·날짜·주소·이메일과 직접 입력한 공백·줄바꿈을 그대로 유지한다', () => {
  const text = '준비물은 1,000원,기준은 3.14입니다.\n2026.11.17 일정입니다.\nhttps://example.com/a,b?q=1.2\nWWW.example.com\nparent@example.com\nreport.pdf';
  const segments = messageTextSegments(text);
  expect(segments.join('')).toBe(text);
  expect(segments).toEqual(['준비물은 1,000원,', text.slice('준비물은 1,000원,'.length)]);
});

