// Flat binary pack of many files: [u32 count] then per file [u32 pathLen][path utf-8][u32 dataLen][data].
// One fetch instead of ~2000, and decoding is a single pass over one ArrayBuffer.

export type Tree = { [name: string]: Tree | Uint8Array };

export function encodePack(files: ReadonlyArray<readonly [string, Uint8Array]>): Uint8Array {
  const encoder = new TextEncoder();
  const paths = files.map(([path]) => encoder.encode(path));
  const size = files.reduce((n, [, data], i) => n + 8 + paths[i]!.length + data.length, 4);
  const out = new Uint8Array(size);
  const view = new DataView(out.buffer);
  let offset = 0;
  view.setUint32(offset, files.length, true);
  offset += 4;
  files.forEach(([, data], i) => {
    const path = paths[i]!;
    view.setUint32(offset, path.length, true);
    out.set(path, offset + 4);
    offset += 4 + path.length;
    view.setUint32(offset, data.length, true);
    out.set(data, offset + 4);
    offset += 4 + data.length;
  });
  return out;
}

export function decodePack(buffer: ArrayBuffer): Tree {
  const view = new DataView(buffer);
  const decoder = new TextDecoder();
  const tree: Tree = {};
  let offset = 0;
  const count = view.getUint32(offset, true);
  offset += 4;
  for (let i = 0; i < count; i++) {
    const pathLength = view.getUint32(offset, true);
    const path = decoder.decode(new Uint8Array(buffer, offset + 4, pathLength));
    offset += 4 + pathLength;
    const dataLength = view.getUint32(offset, true);
    const data = new Uint8Array(buffer, offset + 4, dataLength);
    offset += 4 + dataLength;
    insert(tree, path, data);
  }
  return tree;
}

function insert(tree: Tree, path: string, data: Uint8Array): void {
  const parts = path.split('/');
  const name = parts.pop()!;
  let node = tree;
  for (const part of parts) {
    const child = node[part];
    if (child instanceof Uint8Array) throw new Error(`pack: ${path} conflicts with a file`);
    node = node[part] = child ?? {};
  }
  node[name] = data;
}

export function fromEntries(files: ReadonlyArray<readonly [string, Uint8Array]>): Tree {
  const tree: Tree = {};
  for (const [path, data] of files) insert(tree, path, data);
  return tree;
}
