import { describe, it, expect } from 'vitest';
import { extractCycle, extractWeek, classifySubject } from './classify.js';

describe('extractCycle', () => {
	it('extracts "Cycle 1" from title', () => {
		expect(extractCycle('CC Cycle 1 Week 18 History')).toBe('1');
	});

	it('extracts "Cycle 2" from title', () => {
		expect(extractCycle('CC Cycle 2 Week 5 Science')).toBe('2');
	});

	it('extracts "Cycle 3" from title', () => {
		expect(extractCycle('CC Cycle 3 Week 18 History Pearl Harbor 5th Ed')).toBe('3');
	});

	it('extracts cycle when it appears after week', () => {
		expect(extractCycle('CC Week 18, Cycle 3, Math')).toBe('3');
	});

	it('extracts cycle from "cycle1" (no space)', () => {
		expect(extractCycle('CC cycle1 week 5')).toBe('1');
	});

	it('returns null when no cycle mentioned', () => {
		expect(extractCycle('Classical Conversations Week 18 History')).toBeNull();
	});

	it('extracts from abbreviated "c2" format', () => {
		expect(extractCycle('CC c2 w18 history')).toBe('2');
	});
});

describe('extractWeek', () => {
	it('extracts "Week 18" from title', () => {
		expect(extractWeek('CC Cycle 2 Week 18 History')).toBe('18');
	});

	it('extracts "week18" (no space)', () => {
		expect(extractWeek('CC Cycle 2 week18 History')).toBe('18');
	});

	it('extracts "Wk 5"', () => {
		expect(extractWeek('CC Cycle 1 Wk 5 Science')).toBe('5');
	});

	it('extracts "w18" abbreviated', () => {
		expect(extractWeek('CC c2 w18 history')).toBe('18');
	});

	it('returns null when no week mentioned', () => {
		expect(extractWeek('Classical Conversations Cycle 2 Overview')).toBeNull();
	});
});

describe('classifySubject', () => {
	it('classifies history', () => {
		expect(classifySubject('CC Cycle 1 Week 18 History')).toBe('History');
	});

	it('classifies science', () => {
		expect(classifySubject('CC Cycle 2 Week 5 Science')).toBe('Science');
	});

	it('classifies hands-on science over plain science', () => {
		expect(classifySubject('CC Cycle 2 Hands-on Science Experiment')).toBe('Hands-on Science');
	});

	it('classifies latin', () => {
		expect(classifySubject('Latin Conjugations Week 10')).toBe('Latin');
	});

	it('classifies geography', () => {
		expect(classifySubject('CC Geography Song, Week 18')).toBe('Geography');
	});

	it('returns Unknown for unclassifiable titles', () => {
		expect(classifySubject('Random video about nothing')).toBe('Unknown');
	});

	it('classifies "Science: Parts Of The Sun" as Science, not Fine Arts', () => {
		expect(classifySubject('Cycle 2 Week 9 Science: Parts Of The Sun')).toBe('Science');
	});

	it('classifies fine arts when actually about art', () => {
		expect(classifySubject('CC Cycle 2 Week 9 Fine Arts: Monet')).toBe('Fine Arts');
	});
});

describe('misclassification cases from database', () => {
	// These are real titles that were stored under the wrong cycle
	// because searchBroad didn't check extractCycle against the search cycle

	const misclassified = [
		{ title: 'CC Cycle 1 Week 18 History', searchCycle: '2', expectedCycle: '1', expectedWeek: '18' },
		{ title: 'CC Cycle 3 Week 18 History', searchCycle: '2', expectedCycle: '3', expectedWeek: '18' },
		{ title: 'CC Cycle 3 Week 18 History Pearl Harbor 5th Ed', searchCycle: '2', expectedCycle: '3', expectedWeek: '18' },
		{ title: 'CC Week 18, Cycle 3, Math', searchCycle: '2', expectedCycle: '3', expectedWeek: '18' },
		{ title: 'Cycle 3 Week 18- Roy Lichtenstein', searchCycle: '2', expectedCycle: '3', expectedWeek: '18' },
		{
			title: 'UPDATED!  CC Geography Song, Week 18, Mesoamerica Regions, Cycle 1, CCHappymom',
			searchCycle: '2',
			expectedCycle: '1',
			expectedWeek: '18',
		},
	];

	for (const { title, searchCycle, expectedCycle, expectedWeek } of misclassified) {
		it(`"${title.slice(0, 50)}..." should be cycle ${expectedCycle} week ${expectedWeek}, not cycle ${searchCycle}`, () => {
			const detectedCycle = extractCycle(title);
			expect(detectedCycle).toBe(expectedCycle);
			expect(detectedCycle).not.toBe(searchCycle);

			const detectedWeek = extractWeek(title);
			expect(detectedWeek).toBe(expectedWeek);
		});
	}
});
