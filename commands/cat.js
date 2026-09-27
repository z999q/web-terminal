export default {

    description: "Display file contents",

    execute(args, terminal) {

        if (!args.length) {

            terminal.print(
                "cat: missing file operand"
            );

            return;

        }

        for (const arg of args) {

            try {

                const content =
                    terminal.fs.readFile(
                        arg,
                        terminal.cwd
                    );

                terminal.print(
                    content
                );

            } catch (error) {

                terminal.print(
                    `cat: ${arg}: ${error.message}`
                );

            }

        }

    }

};
