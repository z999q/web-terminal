// commands/curl.js

export default {
  description: "Transfer data from or to a URL",

  async execute(args, terminal) {
    if (!args.length) {
      printHelp(terminal);
      return;
    }

    let url = null;
    let method = "GET";
    let outputFile = null;
    let headers = {};
    let data = null;
    let silent = false;
    let headOnly = false;
    let includeHeaders = false;
    let followRedirects = true;
    let showHeadersOnly = false;

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      // Silent
      if (arg === "-s" || arg === "--silent") {
        silent = true;
        continue;
      }

      // HEAD
      if (arg === "-I" || arg === "--head") {
        method = "HEAD";
        headOnly = true;
        continue;
      }

      // Include response headers
      if (arg === "-i" || arg === "--include") {
        includeHeaders = true;
        continue;
      }

      // Follow redirects
      if (arg === "-L" || arg === "--location") {
        followRedirects = true;
        continue;
      }

      // Do not follow redirects
      if (arg === "--max-redirs" && args[i + 1] === "0") {
        followRedirects = false;
        i++;
        continue;
      }

      // Output file
      if (arg === "-o" || arg === "--output") {
        if (i + 1 >= args.length) {
          terminal.print("curl: option requires an argument -- 'o'");
          return;
        }

        outputFile = args[++i];
        continue;
      }

      // Write output to file
      if (arg.startsWith("-o") && arg.length > 2) {
        outputFile = arg.slice(2);
        continue;
      }

      // HEAD shorthand
      if (arg === "--request") {
        if (i + 1 >= args.length) {
          terminal.print("curl: option '--request' requires an argument");
          return;
        }

        method = args[++i].toUpperCase();
        continue;
      }

      // -XGET / -XPOST
      if (arg.startsWith("-X") && arg.length > 2) {
        method = arg.slice(2).toUpperCase();
        continue;
      }

      // -X POST
      if (arg === "-X") {
        if (i + 1 >= args.length) {
          terminal.print("curl: option '-X' requires an argument");
          return;
        }

        method = args[++i].toUpperCase();
        continue;
      }

      // Header
      if (arg === "-H" || arg === "--header") {
        if (i + 1 >= args.length) {
          terminal.print("curl: option '-H' requires an argument");
          return;
        }

        const header = args[++i];
        const separator = header.indexOf(":");

        if (separator === -1) {
          terminal.print(
            `curl: invalid header '${header}'`
          );
          return;
        }

        const name = header.slice(0, separator).trim();
        const value = header.slice(separator + 1).trim();

        headers[name] = value;
        continue;
      }

      // Compact header form
      if (arg.startsWith("-H") && arg.length > 2) {
        const header = arg.slice(2);
        const separator = header.indexOf(":");

        if (separator === -1) {
          terminal.print(
            `curl: invalid header '${header}'`
          );
          return;
        }

        const name = header.slice(0, separator).trim();
        const value = header.slice(separator + 1).trim();

        headers[name] = value;
        continue;
      }

      // POST data
      if (
        arg === "-d" ||
        arg === "--data" ||
        arg === "--data-raw"
      ) {
        if (i + 1 >= args.length) {
          terminal.print(
            `curl: option '${arg}' requires an argument`
          );
          return;
        }

        data = args[++i];

        if (method === "GET") {
          method = "POST";
        }

        continue;
      }

      // Compact data form
      if (arg.startsWith("-d") && arg.length > 2) {
        data = arg.slice(2);

        if (method === "GET") {
          method = "POST";
        }

        continue;
      }

      // JSON shortcut
      if (arg === "--json") {
        if (i + 1 >= args.length) {
          terminal.print(
            "curl: option '--json' requires an argument"
          );
          return;
        }

        data = args[++i];

        headers["Content-Type"] = "application/json";
        headers["Accept"] = "application/json";

        if (method === "GET") {
          method = "POST";
        }

        continue;
      }

      // URL
      if (!arg.startsWith("-")) {
        if (!url) {
          url = arg;
        } else {
          terminal.print(
            `curl: extra operand '${arg}'`
          );
          return;
        }

        continue;
      }

      terminal.print(`curl: unknown option '${arg}'`);
      return;
    }

    if (!url) {
      terminal.print("curl: no URL specified!");
      return;
    }

    // Add HTTPS if protocol is omitted
    if (!/^https?:\/\//i.test(url)) {
      url = "https://" + url;
    }

    let parsedURL;

    try {
      parsedURL = new URL(url);
    } catch {
      terminal.print(`curl: malformed URL '${url}'`);
      return;
    }

    if (
      parsedURL.protocol !== "http:" &&
      parsedURL.protocol !== "https:"
    ) {
      terminal.print(
        `curl: unsupported protocol '${parsedURL.protocol}'`
      );
      return;
    }

    const options = {
      method,
      headers,
      redirect: followRedirects ? "follow" : "manual",
      cache: "no-store"
    };

    if (
      data !== null &&
      !["GET", "HEAD"].includes(method)
    ) {
      options.body = data;
    }

    if (!silent) {
      terminal.print(
        `> ${method} ${parsedURL.pathname || "/"} HTTP/1.1`
      );
    }

    let response;

    try {
      response = await fetch(url, options);
    } catch (error) {
      terminal.print(
        `curl: (7) Failed to connect to ${parsedURL.hostname}`
      );

      if (!silent) {
        terminal.print(`curl: ${error.message}`);
        terminal.print(
          "Note: The server may block browser requests with CORS."
        );
      }

      return;
    }

    if (includeHeaders || headOnly || showHeadersOnly) {
      terminal.print(
        `HTTP/${getHTTPVersion(response)} ${response.status} ${response.statusText}`
      );

      for (const [name, value] of response.headers.entries()) {
        terminal.print(`${name}: ${value}`);
      }

      terminal.print("");
    }

    if (headOnly) {
      return;
    }

    let body;

    try {
      body = await response.text();
    } catch (error) {
      terminal.print(
        `curl: failed to read response: ${error.message}`
      );
      return;
    }

    // Save response to virtual filesystem
    if (outputFile) {
      const destination =
        terminal.normalizePath(outputFile);

      const parent =
        terminal.fs.parent(destination);

      const parentNode =
        terminal.getNode(parent);

      if (!parentNode || parentNode.type !== "dir") {
        terminal.print(
          `curl: cannot create '${outputFile}': No such directory`
        );
        return;
      }

      try {
        terminal.fs.writeFile(
          destination,
          body,
          terminal.cwd
        );
      } catch (error) {
        terminal.print(
          `curl: failed to save '${outputFile}': ${error.message}`
        );
        return;
      }

      if (!silent) {
        terminal.print(
          `Saved ${formatBytes(
            new Blob([body]).size
          )} to ${outputFile}`
        );
      }

      return;
    }

    if (!silent) {
      if (!includeHeaders) {
        terminal.print(body);
      } else {
        terminal.print(body);
      }
    }

    if (!silent) {
      terminal.print("");
      terminal.print(
        `curl: HTTP ${response.status} (${formatBytes(
          new Blob([body]).size
        )})`
      );
    }
  }
};

function getHTTPVersion(response) {
  // Browser Fetch API does not expose the actual HTTP version.
  return "2";
}

function formatBytes(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KiB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

function printHelp(terminal) {
  terminal.print("Usage: curl [OPTIONS] URL");
  terminal.print("");
  terminal.print("Options:");
  terminal.print("  -X METHOD       HTTP method");
  terminal.print("  -H HEADER       Add HTTP header");
  terminal.print("  -d DATA         Send request data");
  terminal.print("  --json DATA     Send JSON data");
  terminal.print("  -o FILE         Save response to FILE");
  terminal.print("  -I              Fetch headers only");
  terminal.print("  -i              Include response headers");
  terminal.print("  -L              Follow redirects");
  terminal.print("  -s              Silent mode");
  terminal.print("");
  terminal.print("Examples:");
  terminal.print("  curl https://example.com");
  terminal.print("  curl -I https://example.com");
  terminal.print("  curl -o page.html https://example.com");
  terminal.print("  curl -X POST -d 'hello=world' https://example.com");
  terminal.print("  curl -H 'Accept: application/json' https://example.com/api");
  terminal.print("  curl --json '{\"name\":\"Aashu\"}' https://example.com/api");
}
