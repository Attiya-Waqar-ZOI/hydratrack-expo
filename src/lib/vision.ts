import AsyncStorage from '@react-native-async-storage/async-storage';

import { BEVERAGES, Beverage, beverageById } from './engines';

/// Photo drink detection via the Anthropic Messages API (Claude Haiku 4.5,
/// the cheapest vision-capable model). The API key is entered by the user
/// in the You tab and lives only in this device's storage — never in the
/// bundle, since the app is shared publicly through EAS Update.

const KEY_STORAGE = 'anthropicApiKey';

export async function getApiKey(): Promise<string | null> {
  const k = await AsyncStorage.getItem(KEY_STORAGE);
  return k && k.trim().length > 0 ? k.trim() : null;
}

export async function setApiKey(key: string) {
  const k = key.trim();
  if (k) await AsyncStorage.setItem(KEY_STORAGE, k);
  else await AsyncStorage.removeItem(KEY_STORAGE);
}

export interface DrinkGuess {
  beverage: Beverage;
  label: string;      // what the model called it, e.g. "iced latte"
  amountMl: number;   // estimated container/drink size, clamped to the ruler
  confidence: 'low' | 'medium' | 'high';
}

const TYPE_IDS = BEVERAGES.map((b) => b.id);

const SCHEMA = {
  type: 'object',
  properties: {
    drink_type: {
      type: 'string',
      enum: [...TYPE_IDS, 'other'],
      description: 'Closest matching category for the drink',
    },
    label: {
      type: 'string',
      description: 'Short natural name of the drink as seen, e.g. "iced latte", "cola can"',
    },
    amount_ml: {
      type: 'integer',
      description: 'Estimated volume of the drink/container in millilitres',
    },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
  },
  required: ['drink_type', 'label', 'amount_ml', 'confidence'],
  additionalProperties: false,
} as const;

const PROMPT = `Identify the drink in this photo for a water-tracking app.
- drink_type: pick the closest category. Use "sparkling" for carbonated water, "soda" for sugary fizzy drinks, "alcohol" for beer/wine/cocktails, "other" only if nothing fits.
- amount_ml: estimate the drink volume from the container. Typical sizes: espresso cup 60, glass 250, mug 350, can 330, small bottle 500, large bottle 1000. If the container is partly empty, estimate the liquid actually visible.
- confidence: how sure you are overall.`;

export async function detectDrink(base64Jpeg: string, apiKey: string): Promise<DrinkGuess> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      // allows the call from the web preview too; harmless on native
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64Jpeg } },
          { type: 'text', text: PROMPT },
        ],
      }],
      output_config: { format: { type: 'json_schema', schema: SCHEMA } },
    }),
  });

  if (res.status === 401) throw new Error('key');
  if (!res.ok) throw new Error(`api ${res.status}`);

  const data = await res.json();
  if (data.stop_reason === 'refusal') throw new Error('refused');
  const text: string | undefined = (data.content ?? []).find(
    (b: { type: string }) => b.type === 'text',
  )?.text;
  if (!text) throw new Error('empty');

  const raw = JSON.parse(text) as {
    drink_type: string; label: string; amount_ml: number; confidence: DrinkGuess['confidence'];
  };

  const beverage = raw.drink_type === 'other'
    ? beverageById('water')
    : beverageById(raw.drink_type);
  const amountMl = Math.min(1000, Math.max(50, Math.round((raw.amount_ml || 250) / 5) * 5));

  return { beverage, label: raw.label || beverage.name, amountMl, confidence: raw.confidence };
}
