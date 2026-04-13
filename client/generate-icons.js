const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const l = Buffer.allocUnsafe(4); l.writeUInt32BE(data.length, 0);
  const c = Buffer.allocUnsafe(4); c.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([l, t, data, c]);
}

function makePNG(size, bg, accent) {
  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr.writeUInt8(8, 8); ihdr.writeUInt8(2, 9);
  ihdr.writeUInt8(0, 10); ihdr.writeUInt8(0, 11); ihdr.writeUInt8(0, 12);

  const rows = [];
  const cx = Math.floor(size / 2), cy = Math.floor(size / 2);
  const r1 = size * 0.28, r2 = size * 0.18;

  for (let y = 0; y < size; y++) {
    const row = Buffer.allocUnsafe(1 + size * 3);
    row[0] = 0;
    for (let x = 0; x < size; x++) {
      const dx = x - cx, dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      let col = bg;
      if (dist < r1 + 1) {
        const t = Math.max(0, Math.min(1, r1 - dist));
        col = [
          Math.round(bg[0] * (1 - t) + accent[0] * t),
          Math.round(bg[1] * (1 - t) + accent[1] * t),
          Math.round(bg[2] * (1 - t) + accent[2] * t),
        ];
        if (dist < r2) col = accent;
      }
      row[1 + x * 3] = col[0];
      row[2 + x * 3] = col[1];
      row[3 + x * 3] = col[2];
    }
    rows.push(row);
  }

  const raw = Buffer.concat(rows);
  const compressed = zlib.deflateSync(raw, { level: 6 });
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', compressed), chunk('IEND', Buffer.alloc(0))]);
}

const bg = [13, 13, 13];
const accent = [0, 200, 120];
const outDir = path.join(__dirname, 'public');
fs.mkdirSync(outDir, { recursive: true });

[192, 512].forEach(size => {
  const png = makePNG(size, bg, accent);
  const file = path.join(outDir, `icon-${size}.png`);
  fs.writeFileSync(file, png);
  console.log(`Generated ${file} (${png.length} bytes)`);
});
