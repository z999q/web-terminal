export default {

    description: "Create directory",

    execute(args, terminal) {

        if (!args.length) {

            terminal.print(
                "mkdir: missing operand"
            );

            return;

        }

        for (const arg of args) {

            try {

                terminal.fs.mkdir(
                    arg,
                    terminal.cwd
                );

            } catch (error) {

                terminal.print(
                    `mkdir: cannot create directory '${arg}': ${error.message}`
                );

            }

        }

    }

};
