export default {

    description: "Change directory",

    execute(args, terminal) {

        const target =
            args[0] || "~";

        let path;

        if (target === "~") {

            path = terminal.home;

        } else {

            path =
                terminal.normalizePath(
                    target
                );

        }

        const node =
            terminal.getNode(path);

        if (!node) {

            terminal.print(
                `cd: ${target}: No such file or directory`
            );

            return;

        }

        if (node.type !== "dir") {

            terminal.print(
                `cd: ${target}: Not a directory`
            );

            return;

        }

        terminal.cwd = path;

        terminal.updatePrompt();

    }

};
