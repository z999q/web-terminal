/*
 * ============================================================
 * WEBTERM CP
 * Browser-only copy command
 *
 * Supported:
 *
 * cp source destination
 * cp file.txt backup.txt
 * cp file.txt Documents/
 * cp -r directory destination
 * cp -R directory destination
 * ============================================================
 */

export default {

    description: "Copy files and directories",

    execute(args, terminal) {

        if (args.length < 2) {

            terminal.print(
                "cp: missing destination file operand"
            );

            terminal.print(
                "Usage: cp [-r] SOURCE DEST"
            );

            return;
        }


        /*
         * ----------------------------------------------------
         * Parse options
         * ----------------------------------------------------
         */

        let recursive = false;

        const paths = [];

        for (const arg of args) {

            if (
                arg === "-r" ||
                arg === "-R"
            ) {

                recursive = true;

                continue;
            }

            /*
             * Basic combined form:
             *
             * -rf
             * -r
             */

            if (
                arg.startsWith("-") &&
                arg.includes("r") &&
                !arg.startsWith("--")
            ) {

                recursive = true;

                continue;
            }

            paths.push(arg);

        }


        if (paths.length < 2) {

            terminal.print(
                "cp: missing destination file operand"
            );

            return;
        }


        /*
         * ----------------------------------------------------
         * Last argument is destination
         * ----------------------------------------------------
         */

        const destination =
            paths[paths.length - 1];

        const sources =
            paths.slice(0, -1);


        /*
         * ----------------------------------------------------
         * Destination node
         * ----------------------------------------------------
         */

        const destinationNode =
            terminal.getNode(
                destination
            );


        /*
         * ----------------------------------------------------
         * Multiple sources
         *
         * Destination must be a directory
         * ----------------------------------------------------
         */

        if (
            sources.length > 1 &&
            (
                !destinationNode ||
                destinationNode.type !== "dir"
            )
        ) {

            terminal.print(
                `cp: target '${destination}' is not a directory`
            );

            return;
        }


        /*
         * ----------------------------------------------------
         * Copy each source
         * ----------------------------------------------------
         */

        for (const source of sources) {

            copySource(
                source,
                destination,
                recursive,
                terminal
            );

        }

    }

};


/*
 * ============================================================
 * COPY SOURCE
 * ============================================================
 */

function copySource(
    sourcePath,
    destinationPath,
    recursive,
    terminal
) {

    const source =
        terminal.getNode(
            sourcePath
        );


    /*
     * Source doesn't exist
     */

    if (!source) {

        terminal.print(
            `cp: cannot stat '${sourcePath}': No such file or directory`
        );

        return;
    }


    /*
     * --------------------------------------------------------
     * Resolve destination
     * --------------------------------------------------------
     */

    let destination =
        terminal.getNode(
            destinationPath
        );


    let finalPath;


    /*
     * Destination is an existing directory
     */

    if (
        destination &&
        destination.type === "dir"
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
     * Cannot copy directory without -r
     */

    if (
        source.type === "dir" &&
        !recursive
    ) {

        terminal.print(
            `cp: -r not specified; omitting directory '${sourcePath}'`
        );

        return;
    }


    /*
     * Same source and destination
     */

    const sourceAbsolute =
        terminal.normalizePath(
            sourcePath
        );

    if (
        sourceAbsolute === finalPath
    ) {

        terminal.print(
            `cp: '${sourcePath}' and '${destinationPath}' are the same file`
        );

        return;
    }


    /*
     * --------------------------------------------------------
     * Prevent copying directory into itself
     * --------------------------------------------------------
     */

    if (
        source.type === "dir" &&
        (
            finalPath === sourceAbsolute ||
            finalPath.startsWith(
                sourceAbsolute + "/"
            )
        )
    ) {

        terminal.print(
            `cp: cannot copy '${sourcePath}' into itself`
        );

        return;
    }


    /*
     * --------------------------------------------------------
     * Parent directory
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
            `cp: cannot create '${destinationPath}': No such file or directory`
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


    /*
     * Don't overwrite a directory with a file
     */

    if (
        existing &&
        existing.type === "dir" &&
        source.type === "file"
    ) {

        terminal.print(
            `cp: cannot overwrite directory '${destinationPath}' with non-directory`
        );

        return;
    }


    /*
     * --------------------------------------------------------
     * Clone source
     * --------------------------------------------------------
     */

    const copied =
        cloneNode(source);


    /*
     * Replace existing destination
     */

    parent.children[
        terminal.fs.basename(
            finalPath
        )
    ] = copied;

}


/*
 * ============================================================
 * CLONE VIRTUAL FILESYSTEM NODE
 * ============================================================
 */

function cloneNode(node) {

    /*
     * File
     */

    if (node.type === "file") {

        return {

            type: "file",

            content: node.content || ""

        };

    }


    /*
     * Directory
     */

    const directory = {

        type: "dir",

        children: {}

    };


    for (
        const [name, child]
        of Object.entries(node.children || {})
    ) {

        directory.children[name] =
            cloneNode(child);

    }


    return directory;

}
