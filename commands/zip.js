// commands/zip.js

export default {
  description: "Create a ZIP archive from files and directories",

  async execute(args, terminal) {
    if (!args.length) {
      terminal.print("Usage: zip ARCHIVE.zip FILE...");
      return;
    }

    const files = [];
    let archive = null;

    for (const arg of args) {
      if (arg.startsWith("-")) {
        if (arg === "-r" || arg === "--recursive") {
          continue;
        }

        if (arg === "-q" || arg === "--quiet") {
          continue;
        }

        terminal.print(`zip: unknown option '${arg}'`);
        return;
      }

      if (!archive) {
        archive = arg;
      } else {
        files.push(arg);
      }
    }

    if (!archive) {
      terminal.print("zip: missing archive name");
      return;
    }

    if (!files.length) {
      terminal.print("zip: Nothing to do!");
      return;
    }

    if (!archive.toLowerCase().endsWith(".zip")) {
      archive += ".zip";
    }

    const archivePath = terminal.normalizePath(archive);

    if (terminal.getNode(archivePath)) {
      terminal.print(`zip: ${archive}: File already exists`);
      return;
    }

    /*
     * This command creates a ZIP archive in the browser using
     * the Compression Streams API where available.
     *
     * The virtual filesystem is first converted into a list
     * of files and directories.
     */

    const entries = [];

    for (const source of files) {
      const sourcePath = terminal.normalizePath(source);
      const node = terminal.getNode(sourcePath);

      if (!node) {
        terminal.print(
          `zip: ${source}: No such file or directory`
        );
        continue;
      }

      collectEntries(
        node,
        sourcePath,
        entries,
        terminal
      );
    }

    if (!entries.length) {
      terminal.print("zip: Nothing to do!");
      return;
    }

    terminal.print(
      `  adding: ${entries.length} file(s)`
    );

    /*
     * A ZIP file needs an actual ZIP container.
     * JavaScript's CompressionStream('deflate-raw') only
     * compresses data; it does not create ZIP structures.
     *
     * Build a minimal ZIP archive manually.
     */

    try {
      const zipData = await createZip(entries);

      const binaryString = String.fromCharCode(
        ...zipData
      );

      const base64 = btoa(binaryString);

      const content =
        `[BINARY FILE]\n` +
        `Content-Type: application/zip\n` +
        `Base64:\n${base64}`;

      terminal.fs.writeFile(
        archivePath,
        content,
        terminal.cwd
      );

      terminal.print(
        `  ${archive}: ${formatBytes(zipData.length)}`
      );

      terminal.print(
        `zip: created '${archive}'`
      );
    } catch (error) {
      terminal.print(
        `zip: error creating archive: ${error.message}`
      );
    }
  }
};


/* ---------------------------------------------------------
 * Collect virtual filesystem entries
 * --------------------------------------------------------- */

function collectEntries(node, path, entries, terminal) {
  if (node.type === "file") {
    entries.push({
      name: path.replace(/^\/+/, ""),
      data: new TextEncoder().encode(node.content || "")
    });

    return;
  }

  if (node.type !== "dir") {
    return;
  }

  const children = node.children || {};

  for (const [name, child] of Object.entries(children)) {
    const childPath =
      path === "/"
        ? `/${name}`
        : `${path}/${name}`;

    collectEntries(
      child,
      childPath,
      entries,
      terminal
    );
  }
}


/* ---------------------------------------------------------
 * ZIP creation
 *
 * Creates a valid ZIP archive using STORE compression.
 * This avoids requiring external libraries.
 * --------------------------------------------------------- */

async function createZip(entries) {
  const localParts = [];
  const centralParts = [];

  let offset = 0;

  for (const entry of entries) {
    const nameBytes =
      new TextEncoder().encode(entry.name);

    const data = entry.data;

    const crc = crc32(data);

    const localHeader = new Uint8Array(30);
    const localView = new DataView(
      localHeader.buffer
    );

    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0, true);
    localView.setUint16(8, 0, true); // STORE
    localView.setUint16(10, 0, true);
    localView.setUint16(12, 0, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, data.length, true);
    localView.setUint32(22, data.length, true);
    localView.setUint16(26, nameBytes.length, true);
    localView.setUint16(28, 0, true);

    const local = concat(
      localHeader,
      nameBytes,
      data
    );

    localParts.push(local);

    const centralHeader = new Uint8Array(46);
    const centralView = new DataView(
      centralHeader.buffer
    );

    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, 0, true);
    centralView.setUint16(14, 0, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, data.length, true);
    centralView.setUint32(24, data.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, offset, true);

    centralParts.push(
      concat(
        centralHeader,
        nameBytes
      )
    );

    offset += local.length;
  }

  const centralDirectory = concat(...centralParts);

  const localData = concat(...localParts);

  const end = new Uint8Array(22);
  const endView = new DataView(
    end.buffer
  );

  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(
    12,
    centralDirectory.length,
    true
  );
  endView.setUint32(
    16,
    localData.length,
    true
  );
  endView.setUint16(20, 0, true);

  return concat(
    localData,
    centralDirectory,
    end
  );
}


/* ---------------------------------------------------------
 * CRC32
 * --------------------------------------------------------- */

function crc32(data) {
  let crc = 0xffffffff;

  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];

    for (let j = 0; j < 8; j++) {
      crc =
        (crc >>> 1) ^
        (0xedb88320 &
          -(crc & 1));
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}


/* ---------------------------------------------------------
 * Concatenate Uint8Arrays
 * --------------------------------------------------------- */

function concat(...arrays) {
  const total = arrays.reduce(
    (sum, array) => sum + array.length,
    0
  );

  const result = new Uint8Array(total);

  let offset = 0;

  for (const array of arrays) {
    result.set(array, offset);
    offset += array.length;
  }

  return result;
}


/* ---------------------------------------------------------
 * Formatting
 * --------------------------------------------------------- */

function formatBytes(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KiB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}
