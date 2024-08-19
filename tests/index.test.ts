import { expect } from 'chai';
import { describe, it } from 'mocha';

describe('Math operations', () => {
	describe('add function', () => {
		it('should add two numbers correctly', () => {
			expect(2 + 3).to.equal(5);
		});
	});
});