import test from 'node:test';
import assert from 'node:assert/strict';
import { formatScore100 } from '../src/utils/scoreDisplay.js';

test('unavailable SEO scores display as unknown without throwing', () => {
  for (const value of [null, undefined, NaN, Infinity, -Infinity, '', 'invalid', {}, '85']) {
    assert.equal(formatScore100(value), 'نامشخص');
  }
});

test('measured SEO scores retain zero and round to one decimal', () => {
  assert.equal(formatScore100(0), '0/100');
  assert.equal(formatScore100(100), '100/100');
  assert.equal(formatScore100(73.456), '73.5/100');
});
