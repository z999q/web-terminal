// commands/wget.js

export default {
  description: "Download files from HTTP/HTTPS URLs",

  async execute(args, terminal) {
    if (!args.length) {
      terminal.print("Usage: wget [OPTIONS] URL");
      terminal.print("");
      terminal.print("Options:");
      terminal.print("  -O FILE       Save as FILE");
      terminal.print("  -q            Quiet mode");
      terminal.print("  -c            Show download progress");
      return;
    }

    let url = null;
    let outputFile = null;
    let quiet = false;
    let showProgress = false;

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      if (arg === "-q" || arg === "--quiet") {
        quiet = true;
        continue;
      }

      if (arg === "-c" || arg === "--progress") {
        showProgress = true;
        continue;
      }

      if (arg === "-O" || arg === "--output-document") {
        if (i + 1 >= args.length) {
          terminal.print("wget: option requires an argument -- 'O'");
          return;
        }

        outputFile = args[++i];
        continue;
      }

      if (arg.startsWith("-O") && arg.length > 2) {
        outputFile = arg.slice(2);
        continue;
      }

      if (arg.startsWith("-")) {
        terminal.print(`wget: unknown option '${arg}'`);
        return;
      }

      if (!url) {
        url = arg;
      } else {
        terminal.print(`wget: extra operand '${arg}'`);
        return;
      }
    }

    if (!url) {
      terminal.print("wget: missing URL");
      return;
    }

    // Add protocol if omitted
    if (!/^https?:\/\//i.test(url)) {
      url = "https://" + url;
    }

    let parsedURL;

    try {
      parsedURL = new URL(url);
    } catch {
      terminal.print(`wget: invalid URL '${url}'`);
      return;
    }

    if (!["http:", "https:"].includes(parsedURL.protocol)) {
      terminal.print(`wget: unsupported protocol '${parsedURL.protocol}'`);
      return;
    }

    // Determine filename
    if (!outputFile) {
      let filename = parsedURL.pathname.split("/").filter(Boolean).pop();

      if (!filename) {
        filename = "index.html";
      }

      // Decode URL encoded filenames
      try {
        filename = decodeURIComponent(filename);
      } catch {
        // Keep original filename
      }

      outputFile = filename;
    }

    // Prevent accidental absolute URL-like filenames
    if (outputFile === "." || outputFile === "..") {
      terminal.print(`wget: invalid output filename '${outputFile}'`);
      return;
    }

    const destination = terminal.normalizePath(outputFile);

    // Check parent directory
    const parent = terminal.fs.parent(destination);

    if (!parent) {
      terminal.print(`wget: cannot determine destination directory`);
      return;
    }

    const parentNode = terminal.getNode(parent);

    if (!parentNode || parentNode.type !== "dir") {
      terminal.print(
        `wget: cannot create file '${outputFile}': No such directory`
      );
      return;
    }

    if (!quiet) {
      terminal.print(`-- ${url}`);
      terminal.print(`Connecting to ${parsedURL.hostname}...`);
    }

    let response;

    try {
      response = await fetch(url, {
        method: "GET",
        redirect: "follow",
        cache: "no-store"
      });
    } catch (error) {
      terminal.print("");
      terminal.print(`wget: unable to download '${url}'`);
      terminal.print(`wget: ${error.message}`);
      terminal.print("");
      terminal.print(
        "Note: The server may block browser requests with CORS."
      );
      return;
    }

    if (!response.ok) {
      terminal.print("");
      terminal.print(
        `wget: server returned HTTP ${response.status} ${response.statusText}`
      );
      return;
    }

    if (!quiet) {
      terminal.print(`HTTP request sent, awaiting response...`);
      terminal.print(
        `HTTP ${response.status} ${response.statusText}`
      );
    }

    let content;

    try {
      // Try to download as text.
      //
      // Browser fetch cannot reliably determine whether a resource
      // is binary without looking at the content. For the virtual
      // filesystem we therefore store binary data as base64.
      const contentType =
        response.headers.get("content-type") || "";

      const isText =
        contentType.startsWith("text/") ||
        /json|javascript|xml|svg|css|html|csv|yaml|toml/i.test(
          contentType
        );

      if (isText) {
        content = await response.text();
      } else {
        const buffer = await response.arrayBuffer();

        const bytes = new Uint8Array(buffer);

        let binary = "";

        const chunkSize = 0x8000;

        for (let i = 0; i < bytes.length; i += chunkSize) {
          binary += String.fromCharCode(
            ...bytes.subarray(i, i + chunkSize)
          );
        }

        const base64 = btoa(binary);

        content =
          `[BINARY FILE]\n` +
          `Content-Type: ${contentType || "application/octet-stream"}\n` +
          `Base64:\n${base64}`;
      }
    } catch (error) {
      terminal.print(`wget: failed to read response: ${error.message}`);
      return;
    }

    // Show approximate progress information
    if (showProgress && !quiet) {
      const size = new Blob([content]).size;

      terminal.print(
        `Downloaded: ${formatBytes(size)}`
      );
    }

    try {
      terminal.fs.writeFile(
        destination,
        content,
        terminal.cwd
      );
    } catch (error) {
      terminal.print(
        `wget: cannot write '${outputFile}': ${error.message}`
      );
      return;
    }

    if (!quiet) {
      terminal.print("");
      terminal.print(
        `'${outputFile}' saved [${formatBytes(
          new Blob([content]).size
        )}]`
      );
    }
  }
};

function formatBytes(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KiB`;
  }

  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
  }

  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GiB`;
}
