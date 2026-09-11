import { z } from 'zod';

// Mirrors CreateQuestionDto: a required body, trimmed so whitespace alone fails.
export const questionSchema = z.object({
  body: z.string().trim().min(1, 'Type your question first.'),
});

export type QuestionFormValues = z.input<typeof questionSchema>;
