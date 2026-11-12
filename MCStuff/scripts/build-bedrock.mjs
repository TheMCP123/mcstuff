import { readFile, writeFile } from 'node:fs/promises';
import wabtFactory from 'wabt';

const wabt = await wabtFactory();
const source = new URL('../engine/bedrock.wat', import.meta.url);
const module = wabt.parseWat('bedrock.wat', await readFile(source, 'utf8'));
try {
  module.resolveNames();
  module.validate();
  const { buffer } = module.toBinary({ canonicalize_lebs: true, write_debug_names: false });
  await writeFile(new URL('../public/bedrock-engine.wasm', import.meta.url), buffer);
  console.log(`Bedrock matcher: ${buffer.length} bytes`);
} finally { module.destroy(); }
