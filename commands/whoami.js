export default {

    description: "Print current user",

    execute(args, terminal) {

        terminal.print(
            terminal.username
        );

    }

};
