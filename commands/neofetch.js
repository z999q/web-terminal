export default {

    description: "Display system information",

    execute(args, terminal) {

        terminal.print("");

        terminal.print(
            "       .---."
        );

        terminal.print(
            "      /     \\"
        );

        terminal.print(
            "     |  o o  |"
        );

        terminal.print(
            "      \\  ^  /"
        );

        terminal.print(
            "       |||||"
        );

        terminal.print("");

        terminal.print(
            `OS: WebTerm Linux`
        );

        terminal.print(
            `User: ${terminal.username}`
        );

        terminal.print(
            `Host: ${terminal.hostname}`
        );

        terminal.print(
            `Shell: webterm`
        );

        terminal.print(
            `PWD: ${terminal.cwd}`
        );

        terminal.print("");

    }

};
