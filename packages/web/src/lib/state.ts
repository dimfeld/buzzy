import { assign, createMachine, type InterpreterFrom } from 'xstate';

export interface StateMachineContext {
  recording: boolean;
}

export type StateMachineEvents =
  | { type: 'INITIALIZED' }
  | { type: 'WAKE_WORD' }
  | { type: 'VOICE_END' }
  | { type: 'GOT_ANSWER' }
  | { type: 'ANSWERED' }
  | { type: 'entry' | 'exit' };

export type States = 'initializing' | 'waiting' | 'listening' | 'processing';

export const machine = createMachine(
  {
    id: 'state',
    predictableActionArguments: true,
    initial: 'initializing',
    tsTypes: {} as import('./state.typegen').Typegen0,
    schema: {
      context: {} as StateMachineContext,
      events: {} as StateMachineEvents,
    },
    context: {
      recording: false,
    },
    states: {
      initializing: {
        on: {
          INITIALIZED: 'waiting',
        },
      },
      waiting: {
        on: {
          WAKE_WORD: 'listening',
        },
      },
      listening: {
        on: {
          entry: { actions: 'startRecording' },
          exit: { actions: 'stopRecording' },
          VOICE_END: 'processing',
        },
      },
      processing: {
        on: {
          GOT_ANSWER: 'answering',
        },
      },
      answering: {
        on: {
          ANSWERED: 'waiting',
        },
      },
    },
  },
  {
    actions: {
      startRecording: assign({
        recording: true,
      }),
      stopRecording: assign({
        recording: false,
      }),
    },
  }
);

export type StateMachine = InterpreterFrom<typeof machine>;
