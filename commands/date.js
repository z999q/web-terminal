export default {

    description: "Print current date",

    execute(args, terminal) {

        terminal.print(
            new Date().toString()
        );

    }

};
