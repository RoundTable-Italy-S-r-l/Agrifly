import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_DIR = path.resolve(__dirname, '../db');

// Ensure DB directory exists
async function ensureDbDir() {
  try {
    await fs.mkdir(DB_DIR, { recursive: true });
  } catch (error) {
    console.error('Failed to create DB directory:', error);
  }
}

// Read data from a JSON file
export async function readData<T>(filename: string, defaultValue: T): Promise<T> {
  await ensureDbDir();
  const filePath = path.join(DB_DIR, filename);
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data) as T;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      // File not found, return default value and create file
      await writeData(filename, defaultValue);
      return defaultValue;
    }
    console.error(`Error reading ${filename}:`, error);
    throw error;
  }
}

// Write data to a JSON file
export async function writeData<T>(filename: string, data: T): Promise<void> {
  await ensureDbDir();
  const filePath = path.join(DB_DIR, filename);
  try {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error(`Error writing ${filename}:`, error);
    throw error;
  }
}
