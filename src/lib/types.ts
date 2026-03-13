export interface Resource {
	cycle: string;
	week: string;
	subject: string;
	youtube_url: string;
	title: string;
	notes: string;
	description: string;
}

export const SUBJECTS = [
	'History',
	'Science',
	'Hands-on Science',
	'Math',
	'Latin',
	'Geography',
	'English',
	'Timeline',
	'Fine Arts',
	'General',
	'Review'
] as const;

export type Subject = (typeof SUBJECTS)[number];
