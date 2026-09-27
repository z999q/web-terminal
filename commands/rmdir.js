export default {

    description: "Remove empty directory",

    execute(args, terminal) {

        if (!args.length) {

            terminal.print(
                "rmdir: missing operand"
            );

            return;

        }

        for (const arg of args) {

            const node =
                terminal.getNode(arg);

            if (!node) {

                terminal.print(
                    `rmdir: failed to remove '${arg}': No such file or directory`
                );

                continue;

            }

            if (node.type !== "dir") {

                terminal.print(
                    `rmdir: failed to remove '${arg}': Not a directory`
                );

                continue;

            }

            if (
                Object.keys(
                    node.children
                ).length
            ) {

                terminal.print(
                    `rmdir: failed to remove '${arg}': Directory not empty`
                );

                continue;

            }

            terminal.fs.remove(
                arg,
                terminal.cwd
            );

        }

    }

};
