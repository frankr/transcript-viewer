import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import readline from 'readline';

const PAYLOAD_LOG_PATH = path.join(os.homedir(), '.clawdbot', 'logs', 'anthropic-payload.jsonl');

export async function GET(
  request: Request,
  { params }: { params: Promise<{ digest: string }> }
) {
  const { digest } = await params;

  try {
    if (!fs.existsSync(PAYLOAD_LOG_PATH)) {
      return NextResponse.json({ error: 'Payload log not found' }, { status: 404 });
    }

    const fileStream = fs.createReadStream(PAYLOAD_LOG_PATH);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    for await (const line of rl) {
      if (line.trim()) {
        try {
          const entry = JSON.parse(line);
          if (entry.payloadDigest === digest) {
            rl.close();
            fileStream.destroy();
            return NextResponse.json(entry);
          }
        } catch {
          // Skip malformed lines
        }
      }
    }

    return NextResponse.json({ error: 'Payload not found' }, { status: 404 });
  } catch (error) {
    console.error('Error reading payload:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
