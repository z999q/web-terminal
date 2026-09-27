/*
 * ============================================================
 * WEBTERM MV
 * Browser-only move / rename command
 *
 * Supported:
 *
 * mv SOURCE DEST
 * mv file.txt newname.txt
 * mv file.txt Documents/
 * mv project project-backup
 * mv -f source destination
 * ============================================================
 */

export default {

    description: "Move or rename files and directories",

    execute(args, terminal) {

        if (args.length < 2) {

            terminal.print(
                "mv: missing destination file operand"
            );

            terminal.print(
                "Usage: mv SOURCE DEST"
            );

            return;
        }


        /*
         * ----------------------------------------------------
         * Parse options
         * ----------------------------------------------------
         */

        let force = false;

        const paths = [];

        for (const arg of args) {

            if (arg === "-f") {

                force = true;

                continue;
            }

            /*
             * Basic combined options such as -fv
             */

            if (
                arg.startsWith("-") &&
                !arg.startsWith("--") &&
                arg !== "-"
            ) {

                if (arg.includes("f")) {

                    force = true;

                    continue;
                }

            }

            paths.push(arg);

        }


        if (paths.length < 2) {

            terminal.print(
                "mv: missing destination file operand"
            );

            return;
        }


        /*
         * ----------------------------------------------------
         * Last argument = destination
         * ----------------------------------------------------
         */

        const destination =
            paths[paths.length - 1];

        const sources =
            paths.slice(0, -1);


        /*
         * ----------------------------------------------------
         * Destination
         * ----------------------------------------------------
         */

        const destinationNode =
            terminal.getNode(
                destination
            );


        /*
         * Multiple sources require directory
         */

        if (
            sources.length > 1 &&
            (
                !destinationNode ||
                destinationNode.type !== "dir"
            )
        ) {

            terminal.print(
                `mv: target '${destination}' is not a directory`
            );

            return;
        }


        /*
         * ----------------------------------------------------
         * Move each source
         * ----------------------------------------------------
         */

        for (const source of sources) {

            moveSource(
                source,
                destination,
                force,
                terminal
            );

        }

    }

};


/*
 * ============================================================
 * MOVE SOURCE
 * ============================================================
 */

function moveSource(
    sourcePath,
    destinationPath,
    force,
    terminal
) {

    /*
     * --------------------------------------------------------
     * Get source
     * --------------------------------------------------------
     */

    const source =
        terminal.getNode(
            sourcePath
        );


    if (!source) {

        terminal.print(
            `mv: cannot stat '${sourcePath}': No such file or directory`
        );

        return;
    }


    /*
     * --------------------------------------------------------
     * Normalize source
     * --------------------------------------------------------
     */

    const sourceAbsolute =
        terminal.normalizePath(
            sourcePath
        );


    /*
     * --------------------------------------------------------
     * Resolve destination
     * --------------------------------------------------------
     */

    const destinationNode =
        terminal.getNode(
            destinationPath
        );


    let finalPath;


    /*
     * Destination is directory
     *
     * mv file Documents/
     *
     * becomes
     *
     * Documents/file
     */

    if (
        destinationNode &&
        destinationNode.type === "dir"
    ) {

        finalPath =
            terminal.normalizePath(
                destinationPath +
                "/" +
                terminal.fs.basename(
                    sourcePath,
                    terminal.cwd
                )
            );

    } else {

        finalPath =
            terminal.normalizePath(
                destinationPath
            );

    }


    /*
     * --------------------------------------------------------
     * Same source/destination
     * --------------------------------------------------------
     */

    if (
        sourceAbsolute === finalPath
    ) {

        terminal.print(
            `mv: '${sourcePath}' and '${destinationPath}' are the same file`
        );

        return;
    }


    /*
     * --------------------------------------------------------
     * Prevent moving directory into itself
     * --------------------------------------------------------
     */

    if (
        source.type === "dir" &&
        finalPath.startsWith(
            sourceAbsolute + "/"
        )
    ) {

        terminal.print(
            `mv: cannot move '${sourcePath}' into itself`
        );

        return;
    }


    /*
     * --------------------------------------------------------
     * Destination parent
     * --------------------------------------------------------
     */

    const parentPath =
        terminal.fs.parent(
            finalPath
        );

    const parent =
        terminal.getNode(
            parentPath
        );


    if (
        !parent ||
        parent.type !== "dir"
    ) {

        terminal.print(
            `mv: cannot move '${sourcePath}': No such file or directory`
        );

        return;
    }


    /*
     * --------------------------------------------------------
     * Existing destination
     * --------------------------------------------------------
     */

    const existing =
        terminal.getNode(
            finalPath
        );


    if (existing) {

        /*
         * Without -f, browser version behaves conservatively.
         */

        if (!force) {

            const replace =
                confirm(
                    `mv: overwrite '${destinationPath}'?`
                );

            if (!replace) {

                return;

            }

        }


        /*
         * Cannot overwrite non-empty directory
         * with another node.
         */

        if (
            existing.type === "dir" &&
            source.type === "file"
        ) {

            terminal.print(
                `mv: cannot overwrite directory '${destinationPath}'`
            );

            return;
        }


        /*
         * Remove destination first.
         */

        delete parent.children[
            terminal.fs.basename(
                finalPath
            )
        ];

    }


    /*
     * --------------------------------------------------------
     * Get source parent
     * --------------------------------------------------------
     */

    const sourceParentPath =
        terminal.fs.parent(
            sourceAbsolute
        );

    const sourceParent =
        terminal.getNode(
            sourceParentPath
        );


    if (
        !sourceParent ||
        sourceParent.type !== "dir"
    ) {

        terminal.print(
            `mv: cannot move '${sourcePath}'`
        );

        return;
    }


    /*
     * --------------------------------------------------------
     * Remove source from old location
     * --------------------------------------------------------
     */

    const sourceName =
        terminal.fs.basename(
            sourceAbsolute
        );


    /*
     * Keep the actual node.
     *
     * No cloning is necessary for mv.
     */

    const movingNode =
        sourceParent.children[
            sourceName
        ];


    delete sourceParent.children[
        sourceName
    ];


    /*
     * --------------------------------------------------------
     * Put node in destination
     * --------------------------------------------------------
     */

    const destinationName =
        terminal.fs.basename(
            finalPath
        );


    parent.children[
        destinationName
    ] = movingNode;

}
