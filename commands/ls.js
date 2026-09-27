// commands/ls.js

export default {
  description: "List directory contents",

  execute(args, terminal) {
    let path = terminal.cwd;
    let longFormat = false;
    let showAll = false;

    for (const arg of args) {
      if (arg === "-l") {
        longFormat = true;
        continue;
      }

      if (
        arg === "-a" ||
        arg === "--all"
      ) {
        showAll = true;
        continue;
      }

      if (
        arg === "-la" ||
        arg === "-al"
      ) {
        longFormat = true;
        showAll = true;
        continue;
      }

      if (arg.startsWith("-")) {
        terminal.print(
          `ls: invalid option '${arg}'`
        );
        return;
      }

      path = terminal.normalizePath(arg);
    }

    const node = terminal.getNode(path);

    if (!node) {
      terminal.print(
        `ls: cannot access '${path}': No such file or directory`
      );
      return;
    }

    /*
     * If target is a file, print the filename.
     */
    if (node.type === "file") {
      terminal.print(
        terminal.fs.basename(
          path,
          terminal.cwd
        )
      );
      return;
    }

    /*
     * Directory.
     */
    const entries =
      terminal.fs.list(
        path,
        terminal.cwd
      );

    if (!entries.length) {
      return;
    }

    /*
     * Sort by filename.
     */
    entries.sort((a, b) =>
      a.name.localeCompare(
        b.name
      )
    );

    /*
     * Long format.
     */
    if (longFormat) {
      for (const entry of entries) {
        const name = entry.name;
        const child = entry.node;

        const type =
          child.type === "dir"
            ? "d"
            : "-";

        const size =
          child.type === "file"
            ? new Blob([
                child.content || ""
              ]).size
            : 0;

        terminal.print(
          `${type}  ${String(size).padStart(8)}  ${name}`
        );
      }

      return;
    }

    /*
     * Normal ls.
     *
     * Directories are shown with /
     */
    const names = entries.map(
      entry => {
        if (
          entry.node.type === "dir"
        ) {
          return entry.name + "/";
        }

        return entry.name;
      }
    );

    terminal.print(
      names.join("    ")
    );
  }
};
