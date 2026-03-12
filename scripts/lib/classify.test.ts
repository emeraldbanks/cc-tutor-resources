import { describe, it, expect } from 'vitest';
import { extractCycle, extractWeek, extractWeeks, classifySubject, isNotRelevant } from './classify.js';

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

describe('extractWeeks', () => {
	it('handles ranges: "Weeks 2-12"', () => {
		const result = extractWeeks('CC Cycle 1 Weeks 2-12 History');
		expect(result).toEqual(['2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']);
	});

	it('handles comma lists: "Weeks 16, 17, 18"', () => {
		expect(extractWeeks('CC Weeks 16, 17, 18 Science')).toEqual(['16', '17', '18']);
	});

	it('handles mixed combos: "Weeks 20, 22-24"', () => {
		expect(extractWeeks('CC Weeks 20, 22-24 Math')).toEqual(['20', '22', '23', '24']);
	});

	it('falls back to single week extraction', () => {
		expect(extractWeeks('CC Cycle 1 Week 5 History')).toEqual(['5']);
	});

	it('returns empty array when no week found', () => {
		expect(extractWeeks('CC Cycle 1 Overview')).toEqual([]);
	});

	it('handles "Week 3" (singular) as single week', () => {
		expect(extractWeeks('CC Week 3 Latin')).toEqual(['3']);
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
});

describe('word-boundary matching', () => {
	it('"Parts of an Atom" should NOT be Fine Arts', () => {
		expect(classifySubject('CC Cycle 1 Week 5 Parts of an Atom')).not.toBe('Fine Arts');
	});

	it('"Latin Participle" should NOT be Fine Arts', () => {
		expect(classifySubject('CC Latin Participle Endings Week 10')).not.toBe('Fine Arts');
	});

	it('"Start Here" should NOT be Fine Arts', () => {
		expect(classifySubject('CC Start Here Overview')).not.toBe('Fine Arts');
	});

	it('"CC Art Week 5" should be Fine Arts', () => {
		expect(classifySubject('CC Art Week 5')).toBe('Fine Arts');
	});

	it('"Fine Arts Week 12" should be Fine Arts', () => {
		expect(classifySubject('Fine Arts Week 12')).toBe('Fine Arts');
	});

	it('"Drawing Lesson" should be Fine Arts', () => {
		expect(classifySubject('CC Drawing Lesson Week 3')).toBe('Fine Arts');
	});

	it('"Example sentences" should NOT be Geography', () => {
		expect(classifySubject('CC Example sentences Week 3')).not.toBe('Geography');
	});

	it('"CC Map Week 5" should be Geography', () => {
		expect(classifySubject('CC Map Week 5')).toBe('Geography');
	});

	it('"Map of Europe" should be Geography', () => {
		expect(classifySubject('CC Map of Europe Week 12')).toBe('Geography');
	});
});

describe('General category', () => {
	it('"Tutor Ideas" should be General', () => {
		expect(classifySubject('CC Tutor Ideas for Week 5')).toBe('General');
	});

	it('"Memory Work" should be General', () => {
		expect(classifySubject('CC Cycle 1 Memory Work Review')).toBe('General');
	});

	it('"Memory Master" should be General', () => {
		expect(classifySubject('Memory Master Tips Cycle 2')).toBe('General');
	});

	it('"Review Game" should be General', () => {
		expect(classifySubject('CC Review Game Week 10')).toBe('General');
	});

	it('specific subjects should still override General', () => {
		expect(classifySubject('CC History Tutor Week 5')).toBe('History');
	});
});

describe('isNotRelevant', () => {
	it('rejects "thank you" videos', () => {
		expect(isNotRelevant('Thank You CC Families!')).toBe(true);
	});

	it('rejects finale videos', () => {
		expect(isNotRelevant('CC Cycle 3 Finale Celebration')).toBe(true);
	});

	it('rejects goodbye videos', () => {
		expect(isNotRelevant('Saying Goodbye to Our CC Community')).toBe(true);
	});

	it('rejects "when are the ... coming" videos', () => {
		expect(isNotRelevant('When Are The New Materials Coming?')).toBe(true);
	});

	it('rejects "week in the life" vlogs', () => {
		expect(isNotRelevant('A Week in the Life of a CC Tutor')).toBe(true);
	});

	it('rejects "day in the life" vlogs', () => {
		expect(isNotRelevant('Day in the Life - CC Community Day')).toBe(true);
	});

	it('rejects "a peek into" vlogs', () => {
		expect(isNotRelevant('A Peek Into Our CC Day')).toBe(true);
	});

	it('rejects registration videos', () => {
		expect(isNotRelevant('CC Registration Info for 2024')).toBe(true);
	});

	it('rejects info session videos', () => {
		expect(isNotRelevant('Classical Conversations Info Session')).toBe(true);
	});

	it('keeps curriculum videos', () => {
		expect(isNotRelevant('CC Cycle 1 Week 5 History')).toBe(false);
	});

	it('keeps science videos', () => {
		expect(isNotRelevant('CC Cycle 2 Week 10 Science Experiment')).toBe(false);
	});
});

describe('misclassification cases from database', () => {
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
