import { PUBLIC_PICOVOICE_KEY } from '$env/static/public';
import WakeWordModel from './models/Buzzy-Bee_en_wasm_v2_2_0.ppn?url';
import PorcupineParams from './models/porcupine_params.pv?url';
import { PorcupineWorker } from '@picovoice/porcupine-web';
import { CobraWorker } from '@picovoice/cobra-web';
import { WebVoiceProcessor, type WvpMessageEvent } from '@picovoice/web-voice-processor';
import { writable } from 'svelte/store';

export type ListenerState = 'initializing' | 'waiting' | 'active';

const VOICE_PROB_THRESHOLD = 0.7;
const SILENCE_THRESHOLD_MS = 1500;
const FRAMES_PER_SECOND = 16000 / 512;
const SECONDS_INACTIVE_DATA = 0.1;
const INACTIVE_FRAMES = Math.ceil(SECONDS_INACTIVE_DATA * FRAMES_PER_SECOND);

export type AudioCallback = (data: Int16Array) => void | Promise<void>;

export function listenAudio(cb: AudioCallback) {
  let state: ListenerState = 'initializing';
  let stateStore = writable<ListenerState>(state);

  let inputBuffer: Int16Array[] = [];
  let lastInactiveFrames: Int16Array[] = [];
  const recorder = {
    onmessage: (e: MessageEvent<WvpMessageEvent>) => {
      switch (e.data.command) {
        case 'process':
          if (state === 'active') {
            inputBuffer.push(e.data.inputFrame);
          } else {
            // Save the last SECONDS_INACTIVE_DATA of audio so that we don't lose the start of the sentence after the
            // wake word if the user talks fast.
            lastInactiveFrames.push(e.data.inputFrame);
            if (lastInactiveFrames.length > INACTIVE_FRAMES) {
              lastInactiveFrames.shift();
            }
          }
      }
    },
  };

  function setState(newState: ListenerState) {
    state = newState;
    stateStore.set(newState);
  }

  async function keywordDetected() {
    if (state === 'active') {
      return;
    }

    startRecording();
  }

  let silenceStart = 0;
  async function voiceProbability(probability: number) {
    if (state !== 'active') {
      return;
    }

    if (probability < VOICE_PROB_THRESHOLD) {
      let now = Date.now();
      if (silenceStart && now - silenceStart > SILENCE_THRESHOLD_MS) {
        stopRecording();
      } else if (!silenceStart) {
        silenceStart = now;
      }
    } else {
      silenceStart = 0;
    }
  }

  async function startRecording() {
    if (state === 'active') {
      return;
    }

    silenceStart = 0;
    inputBuffer = lastInactiveFrames;
    lastInactiveFrames = [];
    setState('active');
    await WebVoiceProcessor.subscribe(cobra);
  }

  async function stopRecording() {
    if (state === 'waiting') {
      return;
    }

    setState('waiting');
    await WebVoiceProcessor.unsubscribe(cobra);

    let totalLength = inputBuffer.reduce((acc, b) => acc + b.length, 0);
    let output = new Int16Array(totalLength);

    let currentIndex = 0;
    for (let buffer of inputBuffer) {
      output.set(buffer, currentIndex);
      currentIndex += buffer.length;
    }

    inputBuffer = [];

    cb(output);
  }

  let porcupine: PorcupineWorker;
  let cobra: CobraWorker;

  async function init() {
    porcupine = await PorcupineWorker.create(
      PUBLIC_PICOVOICE_KEY,
      {
        label: 'buzzy-bee',
        publicPath: WakeWordModel,
        version: 1,
      },
      keywordDetected,
      {
        publicPath: PorcupineParams,
      }
    );

    cobra = await CobraWorker.create(PUBLIC_PICOVOICE_KEY, voiceProbability);

    await WebVoiceProcessor.subscribe([porcupine, recorder]);
    if (state === 'initializing') {
      setState('waiting');
    }
  }

  init();

  return {
    listenerState: stateStore,
    unsubscribe: async function () {
      await WebVoiceProcessor.reset();

      await Promise.all([porcupine.release(), cobra.release()]);

      porcupine.terminate();
      cobra.terminate();
    },
  };
}
