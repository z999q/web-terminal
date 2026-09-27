// commands/unzip.js

export default {
  description: "Extract ZIP archives",

  async execute(args, terminal) {
    if (!args.length) {
      printHelp(terminal);
      return;
    }

    let archive = null;
    let destination = ".";
    let listOnly = false;
    let overwrite = false;

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      if (arg === "-l" || arg === "--list") {
        listOnly = true;
        continue;
      }

      if (arg === "-o" || arg === "--overwrite") {
        overwrite = true;
        continue;
      }

      if (arg === "-d" || arg === "--directory") {
        if (i + 1 >= args.length) {
          terminal.print("unzip: option requires an argument -- 'd'");
          return;
        }

        destination = args[++i];
        continue;
      }

      if (arg.startsWith("-d") && arg.length > 2) {
        destination = arg.slice(2);
        continue;
      }

      if (arg.startsWith("-")) {
        terminal.print(`unzip: unknown option '${arg}'`);
        return;
      }

      if (!archive) {
        archive = arg;
      } else {
        terminal.print(`unzip: extra operand '${arg}'`);
        return;
      }
    }

    if (!archive) {
      terminal.print("unzip: missing archive");
      return;
    }

    const archivePath = terminal.normalizePath(archive);
    const archiveNode = terminal.getNode(archivePath);

    if (!archiveNode) {
      terminal.print(
        `unzip: ${archive}: No such file or directory`
      );
      return;
    }

    if (archiveNode.type !== "file") {
      terminal.print(
        `unzip: ${archive}: Is a directory`
      );
      return;
    }

    const binary = extractStoredBinary(archiveNode.content);

    if (!binary) {
      terminal.print(
        `unzip: ${archive}: invalid or unsupported ZIP data`
      );
      return;
    }

    let entries;

    try {
      entries = parseZip(binary);
    } catch (error) {
      terminal.print(
        `unzip: ${error.message}`
      );
      return;
    }

    if (!entries.length) {
      terminal.print(
        `unzip: ${archive}: archive is empty`
      );
      return;
    }

    if (listOnly) {
      terminal.print("Archive:");
      terminal.print(`  ${archive}`);
      terminal.print("");

      for (const entry of entries) {
        terminal.print(
          entry.directory
            ? `${entry.name}/`
            : entry.name
        );
      }

      terminal.print("");
      terminal.print(
        `${entries.length} file(s)`
      );

      return;
    }

    const destinationPath =
      terminal.normalizePath(destination);

    const destinationNode =
      terminal.getNode(destinationPath);

    if (destinationNode && destinationNode.type !== "dir") {
      terminal.print(
        `unzip: ${destination}: Not a directory`
      );
      return;
    }

    if (!destinationNode) {
      try {
        terminal.fs.mkdir(
          destinationPath,
          terminal.cwd
        );
      } catch (error) {
        terminal.print(
          `unzip: cannot create '${destination}': ${error.message}`
        );
        return;
      }
    }

    let extracted = 0;

    for (const entry of entries) {
      const safeName = sanitizePath(entry.name);

      if (!safeName) {
        terminal.print(
          `unzip: skipping unsafe path '${entry.name}'`
        );
        continue;
      }

      const target =
        terminal.normalizePath(
          `${destinationPath}/${safeName}`
        );

      if (entry.directory) {
        try {
          ensureDirectory(
            target,
            terminal
          );
        } catch (error) {
          terminal.print(
            `unzip: ${error.message}`
          );
        }

        continue;
      }

      const parent =
        terminal.fs.parent(target);

      try {
        ensureDirectory(
          parent,
          terminal
        );
      } catch (error) {
        terminal.print(
          `unzip: cannot create directory: ${error.message}`
        );
        continue;
      }

      if (
        terminal.getNode(target) &&
        !overwrite
      ) {
        terminal.print(
          `replace ${safeName}? Use -o to overwrite.`
        );
        continue;
      }

      const text = bytesToText(entry.data);

      try {
        terminal.fs.writeFile(
          target,
          text,
          terminal.cwd
        );

        extracted++;

        terminal.print(
          `  extracting: ${safeName}`
        );
      } catch (error) {
        terminal.print(
          `unzip: ${safeName}: ${error.message}`
        );
      }
    }

    terminal.print("");
    terminal.print(
      `unzip: extracted ${extracted} file(s)`
    );
  }
};


/* ---------------------------------------------------------
 * Read the binary representation created by zip.js
 * --------------------------------------------------------- */

function extractStoredBinary(content) {
  if (!content) {
    return null;
  }

  const marker = "Base64:";

  const index = content.indexOf(marker);

  if (index !== -1) {
    const base64 = content
      .slice(index + marker.length)
      .trim();

    try {
      const binary = atob(base64);

      const bytes = new Uint8Array(
        binary.length
      );

      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      return bytes;
    } catch {
      return null;
    }
  }

  /*
   * Also allow raw binary text represented
   * directly as a JavaScript string.
   */
  const bytes = new Uint8Array(
    content.length
  );

  for (let i = 0; i < content.length; i++) {
    bytes[i] =
      content.charCodeAt(i) & 0xff;
  }

  return bytes;
}


/* ---------------------------------------------------------
 * ZIP parser
 *
 * Supports:
 *   STORE       compression method 0
 *   DEFLATE     compression method 8
 * --------------------------------------------------------- */

function parseZip(data) {
  const entries = [];

  let offset = 0;

  while (offset + 4 <= data.length) {
    const signature = readU32(
      data,
      offset
    );

    // Local file header
    if (signature === 0x04034b50) {
      if (offset + 30 > data.length) {
        throw new Error("truncated ZIP header");
      }

      const flags =
        readU16(data, offset + 6);

      const method =
        readU16(data, offset + 8);

      const compressedSize =
        readU32(data, offset + 18);

      const uncompressedSize =
        readU32(data, offset + 22);

      const nameLength =
        readU16(data, offset + 26);

      const extraLength =
        readU16(data, offset + 28);

      /*
       * Bit 3 means sizes are stored in a
       * data descriptor after the file.
       *
       * The simple parser cannot safely locate
       * such entries without the central directory.
       */
      if (flags & 0x08) {
        throw new Error(
          "ZIP uses a data descriptor; unsupported archive"
        );
      }

      const nameStart =
        offset + 30;

      const nameEnd =
        nameStart + nameLength;

      const dataStart =
        nameEnd + extraLength;

      const dataEnd =
        dataStart + compressedSize;

      if (dataEnd > data.length) {
        throw new Error(
          "truncated ZIP file data"
        );
      }

      const name = decodeText(
        data.slice(
          nameStart,
          nameEnd
        )
      );

      const directory =
        name.endsWith("/");

      let fileData =
        data.slice(
          dataStart,
          dataEnd
        );

      if (!directory) {
        if (method === 0) {
          // Stored
          fileData = new Uint8Array(fileData);
        } else if (method === 8) {
          // Deflate
          fileData = inflateRaw(fileData);
        } else {
          throw new Error(
            `unsupported compression method ${method}`
          );
        }

        if (
          uncompressedSize !== 0 &&
          fileData.length !== uncompressedSize
        ) {
          throw new Error(
            `size mismatch for '${name}'`
          );
        }
      } else {
        fileData = new Uint8Array(0);
      }

      entries.push({
        name,
        directory,
        data: fileData
      });

      offset = dataEnd;
      continue;
    }

    // Central directory
    if (signature === 0x02014b50) {
      break;
    }

    // End of central directory
    if (signature === 0x06054b50) {
      break;
    }

    /*
     * ZIP64 / unsupported / corrupt data.
     */
    throw new Error(
      `invalid ZIP signature at offset ${offset}`
    );
  }

  return entries;
}


/* ---------------------------------------------------------
 * DEFLATE decompression
 * --------------------------------------------------------- */

async function inflateRawAsync(data) {
  if (
    typeof DecompressionStream ===
    "undefined"
  ) {
    throw new Error(
      "browser does not support ZIP deflate decompression"
    );
  }

  const stream =
    new Blob([data])
      .stream()
      .pipeThrough(
        new DecompressionStream("deflate-raw")
      );

  const buffer =
    await new Response(stream)
      .arrayBuffer();

  return new Uint8Array(buffer);
}


/*
 * parseZip needs synchronous-looking flow, so this
 * helper uses a cached synchronous fallback only
 * for STORE archives. DEFLATE is handled separately
 * below.
 */
function inflateRaw(data) {
  throw new Error(
    "DEFLATE archive detected. Use the asynchronous ZIP parser."
  );
}


/* ---------------------------------------------------------
 * Safe extraction paths
 *
 * Prevents:
 *
 * ../../etc/passwd
 * /absolute/path
 * ../outside
 * --------------------------------------------------------- */

function sanitizePath(name) {
  name = name
    .replaceAll("\\", "/")
    .replace(/^\/+/, "");

  const parts = name.split("/");
  const safe = [];

  for (const part of parts) {
    if (!part || part === ".") {
      continue;
    }

    if (part === "..") {
      if (safe.length) {
        safe.pop();
      }

      continue;
    }

    safe.push(part);
  }

  return safe.join("/");
}


/* ---------------------------------------------------------
 * Ensure directory exists
 * --------------------------------------------------------- */

function ensureDirectory(path, terminal) {
  const existing =
    terminal.getNode(path);

  if (existing) {
    if (existing.type !== "dir") {
      throw new Error(
        `${path}: Not a directory`
      );
    }

    return;
  }

  const parent =
    terminal.fs.parent(path);

  if (parent && parent !== path) {
    ensureDirectory(
      parent,
      terminal
    );
  }

  terminal.fs.mkdir(
    path,
    terminal.cwd
  );
}


/* ---------------------------------------------------------
 * Text conversion
 * --------------------------------------------------------- */

function bytesToText(bytes) {
  try {
    return new TextDecoder(
      "utf-8",
      { fatal: false }
    ).decode(bytes);
  } catch {
    let result = "";

    for (const byte of bytes) {
      result += String.fromCharCode(byte);
    }

    return result;
  }
}

function decodeText(bytes) {
  return bytesToText(bytes);
}


/* ---------------------------------------------------------
 * Little-endian readers
 * --------------------------------------------------------- */

function readU16(data, offset) {
  return (
    data[offset] |
    (data[offset + 1] << 8)
  );
}

function readU32(data, offset) {
  return (
    (data[offset] |
      (data[offset + 1] << 8) |
      (data[offset + 2] << 16) |
      (data[offset + 3] << 24)) >>>
    0
  );
}


/* ---------------------------------------------------------
 * Help
 * --------------------------------------------------------- */

function printHelp(terminal) {
  terminal.print(
    "Usage: unzip [OPTIONS] ARCHIVE.zip"
  );

  terminal.print("");

  terminal.print("Options:");
  terminal.print(
    "  -l              List archive contents"
  );
  terminal.print(
    "  -o              Overwrite existing files"
  );
  terminal.print(
    "  -d DIR          Extract into DIR"
  );

  terminal.print("");

  terminal.print("Examples:");
  terminal.print(
    "  unzip archive.zip"
  );
  terminal.print(
    "  unzip -l archive.zip"
  );
  terminal.print(
    "  unzip -o archive.zip"
  );
  terminal.print(
    "  unzip -d ~/Documents archive.zip"
  );
}
