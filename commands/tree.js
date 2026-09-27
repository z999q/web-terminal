export default {

    description: "Display directory tree",

    execute(args, terminal) {

        const root =
            terminal.getNode(".");

        if (!root || root.type !== "dir") {
            return;
        }

        terminal.print(
            terminal.getDisplayPath()
        );

        render(
            root,
            "",
            terminal
        );

    }

};


function render(node, prefix, terminal) {

    const names =
        Object.keys(
            node.children
        ).sort();

    names.forEach(
        (name, index) => {

            const last =
                index === names.length - 1;

            const child =
                node.children[name];

            terminal.print(
                prefix +
                (last ? "└── " : "├── ") +
                name
            );

            if (child.type === "dir") {

                render(
                    child,
                    prefix +
                    (last ? "    " : "│   "),
                    terminal
                );

            }

        }
    );

}
