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

test('한국 휴대전화 형식이 아닌 번호는 변경하지 않는다', () => {
  for (const text of ['+1 10-1234-5678', '+82 20-1234-5678', '+82 10-12-5678', '+8210123456789', '001012345678']) {
    expect(maskContactInfo(text), text).toEqual({ text, count: 0 });
  }
});
