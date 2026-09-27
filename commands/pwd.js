export default {

    description: "Print working directory",

    execute(args, terminal) {

        terminal.print(
            terminal.cwd
        );

    }

};
