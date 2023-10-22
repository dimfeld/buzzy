import type { ChatCompletionMessage } from 'openai/resources/chat';

async function runWebSearch(params: { query: string }) {
  // TODO run the search and return results
  return '';
}

async function runDaysUntil(params: {
  month?: string;
  year?: number;
  day_of_month?: number;
}): Promise<FunctionResult> {
  // TODO return the number of days from now to the specified date
  return '';
}

export interface FunctionResult {
  text: string;
  /** True if the output from the function should be passed back to the LLM again.
   * False if the output can be sent directly back to the user. */
  replay: boolean;
}
export type FunctionRunner = (params: object) => Promise<FunctionResult>;

export const functions = {
  web_search: {
    description: 'Search the internet to help answer factual questions',
    fn: runWebSearch,
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'A search query that can provide information to help answer the question',
        },
      },
      required: ['query'],
    },
  },
  days_until: {
    description: 'Get the number of days until a specific date',
    fn: runDaysUntil,
    parameters: {
      type: 'object',
      properties: {
        month: {
          type: 'string',
          enum: [
            'January',
            'February',
            'March',
            'April',
            'May',
            'June',
            'July',
            'August',
            'September',
            'October',
            'November',
            'December',
          ],
          description: 'The month that the date falls in',
        },
        year: {
          type: 'integer',
          description: 'The year that the date falls in',
        },
        day_of_month: {
          type: 'integer',
          description: 'The day of the month that the date falls in',
        },
      },
      required: ['month'],
    },
  },
};

export const openAIFunctionList = Object.entries(functions).map((f) => ({
  name: f[0],
  description: f[1].description,
  parameters: f[1].parameters,
}));

export async function runLlmFunction(
  fnCall: ChatCompletionMessage.FunctionCall
): Promise<FunctionResult | null> {
  const args = JSON.parse(fnCall.arguments);

  const runner = functions[fnCall.name as keyof typeof functions];
  if (!runner) {
    // TODO throw and log an error here
    return null;
  }

  return runner.fn(args);
}
