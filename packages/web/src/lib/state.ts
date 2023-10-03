import { assign, createMachine, type InterpreterFrom, type StateFrom } from 'xstate';

export interface StateMachineContext {
  recording: boolean;
  initialized: {
    ws: boolean;
    audio: boolean;
  };
}

export type StateMachineEvents =
  | { type: 'INITIALIZED'; module: 'ws' | 'audio' }
  | { type: 'WAKE_WORD' }
  | { type: 'VOICE_END' }
  | { type: 'SUBMITTED_AS_TEXT' }
  | { type: 'ANSWER_START' }
  | { type: 'ANSWERED' }
  | { type: 'entry' | 'exit' };

export type States = 'initializing' | 'maybeFinished' | 'waiting' | 'listening' | 'processing';

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
      initialized: {
        ws: false,
        audio: false,
      },
    },
    states: {
      initializing: {
        on: {
          INITIALIZED: [
            {
              actions: ['handleInit'],
              target: 'maybeFinished',
            },
          ],
        },
      },
      maybeFinished: {
        always: [
          {
            target: 'waiting',
            cond: 'initDone',
          },
          {
            target: 'initializing',
          },
        ],
      },
      waiting: {
        on: {
          WAKE_WORD: 'listening',
          SUBMITTED_AS_TEXT: 'processing',
        },
      },
      listening: {
        entry: 'startRecording',
        exit: 'stopRecording',
        on: {
          VOICE_END: 'processing',
        },
      },
      processing: {
        on: {
          ANSWER_START: 'answering',
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
    guards: {
      initDone: (context: StateMachineContext, event: StateMachineEvents) => {
        return Object.values(context.initialized).every(Boolean);
      },
    },
    actions: {
      handleInit: assign({
        initialized: (context: StateMachineContext, event: StateMachineEvents) => {
          if (event.type !== 'INITIALIZED') {
            return context.initialized;
          }

          return {
            ...context.initialized,
            [event.module]: true,
          };
        },
      }),

      startRecording: assign({
        recording: true,
      }),
      stopRecording: assign({
        recording: false,
      }),
    },
  }
);

export type StateMachineState = StateFrom<typeof machine>;
export type StateMachine = InterpreterFrom<typeof machine>;
