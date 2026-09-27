export default {

    description: "Print text",

    execute(args, terminal) {

        terminal.print(
            args.join(" ")
        );

    }

};
