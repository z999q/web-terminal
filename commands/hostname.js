export default {

    description: "Print hostname",

    execute(args, terminal) {

        terminal.print(
            terminal.hostname
        );

    }

};
