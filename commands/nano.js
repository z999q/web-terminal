// commands/nano.js

export default {
    description: "Edit a file",

    execute(args, terminal) {

        if (!args.length) {

            terminal.print(
                "nano: missing file operand"
            );

            return;
        }


        const filename = args[0];

        const path =
            terminal.normalizePath(
                filename
            );

        let node =
            terminal.getNode(path);


        /*
         * Create file if it doesn't exist
         */

        if (!node) {

            try {

                terminal.fs.touch(
                    filename,
                    terminal.cwd
                );

                node =
                    terminal.getNode(path);

            } catch (error) {

                terminal.print(
                    `nano: ${filename}: ${error.message}`
                );

                return;
            }
        }


        /*
         * Directory cannot be edited
         */

        if (node.type !== "file") {

            terminal.print(
                `nano: ${filename}: Is a directory`
            );

            return;
        }


        openEditor(
            path,
            node.content || "",
            terminal
        );
    }
};


/* ============================================================
 * EDITOR
 * ============================================================
 */

function openEditor(
    path,
    content,
    terminal
) {

    const terminalElement =
        document.getElementById(
            "terminal"
        );

    const input =
        document.getElementById(
            "commandInput"
        );


    /*
     * Hide normal terminal input
     */

    input.style.display = "none";


    /*
     * Create editor
     */

    const editor =
        document.createElement("div");

    editor.className =
        "nano-editor";


    /*
     * Header
     */

    const header =
        document.createElement("div");

    header.className =
        "nano-header";


    header.textContent =
        `GNU nano    ${path}`;


    /*
     * Toolbar
     */

    const toolbar =
        document.createElement("div");

    toolbar.className =
        "nano-toolbar";


    /*
     * SAVE BUTTON
     */

    const saveButton =
        document.createElement("button");

    saveButton.type =
        "button";

    saveButton.className =
        "nano-button nano-save";

    saveButton.textContent =
        "💾 Save";


    /*
     * EXIT BUTTON
     */

    const exitButton =
        document.createElement("button");

    exitButton.type =
        "button";

    exitButton.className =
        "nano-button nano-exit";

    exitButton.textContent =
        "✕ Exit";


    /*
     * Add buttons
     */

    toolbar.appendChild(
        saveButton
    );

    toolbar.appendChild(
        exitButton
    );


    /*
     * Text area
     */

    const textarea =
        document.createElement("textarea");

    textarea.className =
        "nano-textarea";

    textarea.value =
        content;

    textarea.spellcheck =
        false;

    textarea.autocomplete =
        "off";

    textarea.autocorrect =
        "off";

    textarea.autocapitalize =
        "off";


    /*
     * Status
     */

    const status =
        document.createElement("div");

    status.className =
        "nano-status";

    status.textContent =
        "Saved";


    /*
     * Footer
     */

    const footer =
        document.createElement("div");

    footer.className =
        "nano-footer";


    footer.innerHTML = `
        <span>Save: Button</span>
        <span>Exit: Button</span>
        <span>Search: Ctrl+W</span>
        <span>Cut: Ctrl+K</span>
        <span>Paste: Ctrl+U</span>
    `;


    /*
     * Assemble editor
     */

    editor.appendChild(
        header
    );

    editor.appendChild(
        toolbar
    );

    editor.appendChild(
        textarea
    );

    editor.appendChild(
        status
    );

    editor.appendChild(
        footer
    );


    terminalElement.appendChild(
        editor
    );


    /*
     * Focus editor
     */

    textarea.focus();


    /*
     * Track changes
     */

    let modified = false;


    textarea.addEventListener(
        "input",
        () => {

            modified = true;

            status.textContent =
                "Modified";

        }
    );


    /* ========================================================
     * SAVE
     * ========================================================
     */

    async function saveFile() {

        try {

            terminal.fs.writeFile(
                path,
                textarea.value,
                terminal.cwd
            );


            /*
             * If the filesystem provides
             * an explicit save method, wait
             * for it too.
             */

            if (
                typeof terminal.fs.save ===
                "function"
            ) {

                await terminal.fs.save();

            }


            modified = false;


            status.textContent =
                `Saved • ${textarea.value.length} characters`;


        } catch (error) {

            status.textContent =
                `Error: ${error.message}`;

        }


        textarea.focus();

    }


    /* ========================================================
     * EXIT
     * ========================================================
     */

    function exitEditor() {

        /*
         * If there are unsaved changes,
         * ask before leaving.
         */

        if (modified) {

            const save =
                confirm(
                    "Save changes before exiting?"
                );


            if (save) {

                saveFile()
                    .then(() => {

                        closeEditor();

                    });

                return;

            }

        }


        closeEditor();

    }


    /* ========================================================
     * CLOSE EDITOR
     * ========================================================
     */

    function closeEditor() {

        editor.remove();

        input.style.display =
            "";

        input.focus();

        terminal.updatePrompt();

        terminal.scrollBottom();

    }


    /* ========================================================
     * SAVE BUTTON
     * ========================================================
     */

    saveButton.addEventListener(
        "click",
        async event => {

            event.preventDefault();

            event.stopPropagation();

            await saveFile();

        }
    );


    /* ========================================================
     * EXIT BUTTON
     * ========================================================
     */

    exitButton.addEventListener(
        "click",
        event => {

            event.preventDefault();

            event.stopPropagation();

            exitEditor();

        }
    );


    /* ========================================================
     * KEYBOARD SHORTCUTS
     *
     * IMPORTANT:
     *
     * Ctrl+X = REMOVED
     * Ctrl+O = REMOVED
     *
     * Saving is now done with the
     * visible Save button.
     * ========================================================
     */

    textarea.addEventListener(
        "keydown",
        event => {

            /*
             * Ctrl + W
             * Search
             */

            if (
                event.ctrlKey &&
                event.key.toLowerCase() === "w"
            ) {

                event.preventDefault();

                searchText();

                return;

            }


            /*
             * Ctrl + K
             * Cut current line
             */

            if (
                event.ctrlKey &&
                event.key.toLowerCase() === "k"
            ) {

                event.preventDefault();

                cutLine();

                return;

            }


            /*
             * Ctrl + U
             * Paste previously cut line
             */

            if (
                event.ctrlKey &&
                event.key.toLowerCase() === "u"
            ) {

                event.preventDefault();

                pasteLine();

                return;

            }


            /*
             * Ctrl + X
             *
             * INTENTIONALLY NOT HANDLED.
             *
             * It will behave as normal keyboard
             * input / browser handling.
             */


            /*
             * Ctrl + O
             *
             * INTENTIONALLY NOT HANDLED.
             *
             * Save is done using the button.
             */

        }
    );


    /* ========================================================
     * SEARCH
     * ========================================================
     */

    function searchText() {

        const search =
            window.prompt(
                "Search:"
            );


        if (!search) {

            textarea.focus();

            return;

        }


        const index =
            textarea.value.indexOf(
                search
            );


        if (index === -1) {

            window.alert(
                `"${search}" not found`
            );

            textarea.focus();

            return;

        }


        textarea.focus();


        textarea.setSelectionRange(
            index,
            index + search.length
        );

    }


    /* ========================================================
     * CUT LINE
     * ========================================================
     */

    let clipboard = "";


    function cutLine() {

        const value =
            textarea.value;


        const position =
            textarea.selectionStart;


        const lineStart =
            value.lastIndexOf(
                "\n",
                position - 1
            ) + 1;


        let lineEnd =
            value.indexOf(
                "\n",
                position
            );


        if (lineEnd === -1) {

            lineEnd =
                value.length;

        } else {

            lineEnd++;

        }


        clipboard =
            value.substring(
                lineStart,
                lineEnd
            );


        textarea.value =
            value.substring(
                0,
                lineStart
            ) +
            value.substring(
                lineEnd
            );


        textarea.selectionStart =
            lineStart;


        textarea.selectionEnd =
            lineStart;


        modified = true;


        status.textContent =
            "Modified";

    }


    /* ========================================================
     * PASTE
     * ========================================================
     */

    function pasteLine() {

        if (!clipboard) {

            textarea.focus();

            return;

        }


        const start =
            textarea.selectionStart;


        const end =
            textarea.selectionEnd;


        textarea.value =
            textarea.value.substring(
                0,
                start
            ) +
            clipboard +
            textarea.value.substring(
                end
            );


        textarea.selectionStart =
            start + clipboard.length;


        textarea.selectionEnd =
            start + clipboard.length;


        modified = true;


        status.textContent =
            "Modified";

    }

}
