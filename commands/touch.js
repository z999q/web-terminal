export default {

    description: "Create an empty file",

    execute(args, terminal) {

        if (!args.length) {

            terminal.print(
                "touch: missing file operand"
            );

            return;

        }

        for (const arg of args) {

            try {

                terminal.fs.touch(
                    arg,
                    terminal.cwd
                );

            } catch (error) {

                terminal.print(
                    `touch: cannot touch '${arg}': ${error.message}`
                );

            }

        }

    }

};
