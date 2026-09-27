export default {

    description: "Show command history",

    execute(args, terminal) {

        terminal.history.forEach(
            (command, index) => {

                terminal.print(
                    `${index + 1}  ${command}`
                );

            }
        );

    }

};
