import { expect, test } from '@playwright/test';
import { maskContactInfo } from '../../src/features/pii/masking';

test('국제 형식의 한국 휴대전화 번호를 국가 코드까지 마스킹한다', () => {
  for (const phone of [
    '+82 10-1234-5678',
    '+82-10-1234-5678',
    '+82.10.1234.5678',
    '+82 10 1234 5678',
    '+821012345678',
    '+82 11-123-4567',
  ]) {
    expect(maskContactInfo(`연락처: ${phone}`), phone).toEqual({ text: '연락처: [전화번호]', count: 1 });
  }
});

test('기존 국내 형식의 휴대전화 번호도 계속 마스킹한다', () => {
  for (const phone of ['010-1234-5678', '01012345678', '010 1234 5678', '010.1234.5678', '011-123-4567']) {
    expect(maskContactInfo(`연락처: ${phone}`), phone).toEqual({ text: '연락처: [전화번호]', count: 1 });
  }
});

test('국내·국제 번호와 이메일을 함께 마스킹하고 각각 한 건으로 집계한다', () => {
  const result = maskContactInfo('연락처: +82 10-1234-5678, 010-9876-5432 / parent@test.com');
  expect(result).toEqual({ text: '연락처: [전화번호], [전화번호] / [이메일]', count: 3 });
  expect(maskContactInfo(result.text)).toEqual({ text: result.text, count: 0 });
});

test('한국 전화번호 형식이 아닌 번호는 변경하지 않는다', () => {
  for (const text of ['+1 10-1234-5678', '+82 20-1234-5678', '+82 10-12-5678', '001012345678', '2026-10-29', '주문번호 1234-5678']) {
    expect(maskContactInfo(text), text).toEqual({ text, count: 0 });
  }
});

test('일반·인터넷 전화와 붙어 쓴 번호도 서버처럼 마스킹한다', () => {
  for (const phone of ['02-123-4567', '02-1234-5678', '031-123-4567', '064 1234 5678', '070-1234-5678', '+82 2-123-4567', '+82-31-123-4567']) {
    expect(maskContactInfo(`연락처: ${phone}`), phone).toEqual({ text: '연락처: [전화번호]', count: 1 });
  }
  expect(maskContactInfo('tel010-1234-5678입니다')).toEqual({ text: 'tel[전화번호]입니다', count: 1 });
});

test('서버처럼 이메일을 전화번호보다 먼저 마스킹한다', () => {
  expect(maskContactInfo('01012345678@mail.com')).toEqual({ text: '[이메일]', count: 1 });
});

// Copied from the backend PiiMaskingServiceImpl (dev). The server stores the text it receives, so for every
// format the server supports the front must mask the same parts.
function serverMask(content: string) {
  return content
    .replace(/(?<![0-9])[0-9]{6}[-\s]?[1-8][0-9]{6}(?![0-9])/g, '[주민등록번호]')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[이메일]')
    .replace(/(?<![0-9])(?:\+82[-\s]?(?:10|2|[3-6][1-5]|70)|0(?:1[016789]|2|[3-6][1-5]|70))[-\s]?[0-9]{3,4}[-\s]?[0-9]{4}(?![0-9])/g, '[전화번호]');
}

test('서버 마스킹 규칙이 가리는 부분은 프론트도 똑같이 가린다', () => {
  for (const text of [
    '연락은 010-1234-5678 또는 parent@test.com 으로 부탁드립니다.',
    '아이 주민번호 150101-3123456, 집 02-123-4567',
    '+82 10 1234 5678 / +82-2-1234-5678 / 0311234567',
    '+8210123456789',
    '번호는010-1234-5678이고 메일은a.b+c@school.kr',
    '9001011234567@test.com',
    '상담 일정은 10월 29일 14:00, 학번 20261029입니다.',
  ]) {
    expect(maskContactInfo(text).text, text).toBe(serverMask(text));
  }
});

test('주민등록번호는 서버와 같은 규칙으로 가장 먼저 마스킹한다', () => {
  for (const id of ['900101-1234567', '900101 1234567', '9001011234567', '051231-8123456']) {
    expect(maskContactInfo(`주민번호 ${id} 입니다`), id).toEqual({ text: '주민번호 [주민등록번호] 입니다', count: 1 });
  }
  expect(maskContactInfo('900101-1234567, 010-1234-5678')).toEqual({ text: '[주민등록번호], [전화번호]', count: 2 });
});

test('주민등록번호 형태가 아닌 숫자는 그대로 둔다', () => {
  for (const text of ['900101-9234567', '900101-123456', '1900101-1234567', '주문번호 20261029']) {
    expect(maskContactInfo(text), text).toEqual({ text, count: 0 });
  }
});
