export default {

    description: "Remove files",

    execute(args, terminal) {

        if (!args.length) {

            terminal.print(
                "rm: missing operand"
            );

            return;

        }

        for (const arg of args) {

            if (arg.startsWith("-")) {
                continue;
            }

            try {

                const node =
                    terminal.getNode(arg);

                if (!node) {

                    throw new Error(
                        "No such file or directory"
                    );

                }

                if (node.type === "dir") {

                    throw new Error(
                        "Is a directory"
                    );

                }

                terminal.fs.remove(
                    arg,
                    terminal.cwd
                );

            } catch (error) {

                terminal.print(
                    `rm: cannot remove '${arg}': ${error.message}`
                );

            }

        }

    }

};
