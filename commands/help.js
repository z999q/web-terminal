// commands/help.js

export default {
    description: "Show available commands",

    async execute(args, terminal) {

        terminal.print("");
        terminal.print("Available commands:");
        terminal.print("");

        /*
         * Try to discover every .js file
         * inside ../commands/
         */
        const commandNames =
            await discoverCommands();


        /*
         * Load every discovered command.
         */
        for (const name of commandNames) {

            await terminal.loadCommand(name);

        }


        /*
         * Build final command list.
         *
         * This includes:
         * - dynamically discovered commands
         * - commands already loaded
         */
        const commands =
            Array.from(
                terminal.commands.entries()
            ).sort(
                ([a], [b]) =>
                    a.localeCompare(b)
            );


        /*
         * Display commands.
         */
        for (
            const [name, command]
            of commands
        ) {

            const description =
                command &&
                command.description
                    ? command.description
                    : "";


            terminal.print(
                `  ${name.padEnd(12)} ${description}`
            );

        }


        terminal.print("");

        terminal.print(
            `${commands.length} command(s) available`
        );

        terminal.print("");
    }
};


/* ============================================================
 * DISCOVER COMMAND FILES
 * ============================================================
 */

async function discoverCommands() {

    try {

        /*
         * Request the commands directory.
         *
         * With a simple HTTP server such as:
         *
         * python -m http.server 9090
         *
         * the directory normally returns an HTML
         * listing containing the .js files.
         */
        const response =
            await fetch("../commands/");


        if (!response.ok) {

            return [];

        }


        const html =
            await response.text();


        /*
         * Parse directory listing.
         */
        const parser =
            new DOMParser();


        const document =
            parser.parseFromString(
                html,
                "text/html"
            );


        const links =
            Array.from(
                document.querySelectorAll(
                    "a[href]"
                )
            );


        const names = [];


        for (const link of links) {

            const href =
                link.getAttribute("href");


            if (!href) {
                continue;
            }


            /*
             * Only accept simple JS filenames.
             */
            const match =
                href.match(
                    /\/?([a-zA-Z0-9_-]+)\.js$/
                );


            if (!match) {
                continue;
            }


            const name =
                match[1];


            /*
             * Avoid duplicates.
             */
            if (
                !names.includes(name)
            ) {

                names.push(name);

            }

        }


        return names;

    } catch (error) {

        console.debug(
            "WebTerm: command discovery failed",
            error
        );


        return [];

    }
}
