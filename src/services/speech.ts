import { TextToSpeech, QueueStrategy } from '@capacitor-community/text-to-speech';

// Indian English reads names like "Kiran" and "Ravi" more naturally; fall back to the
// phone's default voice when that language isn't installed.
export async function speak(text: string): Promise<void> {
  const options = { text, rate: 0.95, queueStrategy: QueueStrategy.Flush };
  try {
    await TextToSpeech.speak({ ...options, lang: 'en-IN' });
  } catch {
    await TextToSpeech.speak(options);
  }
}
